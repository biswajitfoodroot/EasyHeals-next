/**
 * POST /api/admin/broadcast
 * GET  /api/admin/broadcast
 *
 * P2 Day 4 — Admin mass broadcast tool (HLD §5.8)
 *
 * ⚡ CRM already has a broadcast tool (mass WhatsApp + SMS).
 * This endpoint gates it with patient consent: only patients who have
 * explicitly consented to "marketing" purpose receive broadcasts.
 *
 * DPDP compliance:
 *   - Recipients filtered by consentRecords WHERE purpose='marketing' AND active=true
 *   - No raw phone in response — only counts
 *   - Broadcast log stored in outbox_events for audit trail
 *
 * Auth:   owner/admin only (advisor cannot broadcast)
 * Gate:   mass_broadcast feature flag (P2 — OFF by default)
 *
 * POST body:
 *   {
 *     channel:      "whatsapp" | "sms"
 *     templateName: string     // registered WA template name OR DLT SMS template ID
 *     vars:         Record<string, string>  // template variable substitutions
 *     hospitalId?:  string     // if set, filter to patients with leads at this hospital
 *     city?:        string     // if set, filter to patients in this city
 *     previewOnly?: boolean    // if true, returns recipient count without sending
 *   }
 *
 * GET query params:
 *   ?limit=20  — recent broadcast history from outbox_events
 *
 * Response (POST):
 *   { queued: true, recipientCount: N }           (previewOnly=false)
 *   { preview: true, eligibleRecipients: N }       (previewOnly=true)
 */

import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { consentRecords, patients, leads, outboxEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getNotificationProvider } from "@/lib/notifications";
import { decryptPhone } from "@/lib/security/encryption";

// ── Schema ─────────────────────────────────────────────────────────────────

const postSchema = z.object({
  channel: z.enum(["whatsapp", "sms"]),
  templateName: z.string().min(1).max(200),
  vars: z.record(z.string(), z.string()).default({}),
  hospitalId: z.string().uuid().optional(),
  city: z.string().max(50).optional(),
  previewOnly: z.boolean().default(false),
});

// ── Resolve consented recipients ───────────────────────────────────────────

interface Recipient {
  patientId: string;
  phoneEncrypted: string;
  city: string | null;
}

async function resolveRecipients(
  hospitalId?: string,
  city?: string,
): Promise<Recipient[]> {
  // 1. Find all patients with active marketing consent
  const consentedPatientIds = await db
    .select({ patientId: consentRecords.patientId })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.purpose, "marketing"),
        eq(consentRecords.revokedAt, null as any),
      ),
    );

  if (consentedPatientIds.length === 0) return [];

  const patientIds = consentedPatientIds.map((r) => r.patientId);

  // 2. Filter by hospital (via leads table) if requested
  let filteredIds = patientIds;
  if (hospitalId) {
    const hospitalPatientIds = await db
      .select({ patientId: leads.patientId })
      .from(leads)
      .where(
        and(
          eq(leads.hospitalId, hospitalId),
          isNotNull(leads.patientId),
          inArray(leads.patientId, patientIds),
        ),
      );
    filteredIds = hospitalPatientIds.map((r) => r.patientId!).filter(Boolean);
  }

  if (filteredIds.length === 0) return [];

  // 3. Load patient phoneEncrypted (needed for WA/SMS)
  const patientConditions = [
    inArray(patients.id, filteredIds),
    isNotNull(patients.phoneEncrypted),
    eq(patients.leaderboardOptOut, false), // leaderboard opt-out ≠ marketing opt-out, but use as conservative proxy
  ];
  if (city) patientConditions.push(eq(patients.city, city));

  const patientRows = await db
    .select({
      id: patients.id,
      phoneEncrypted: patients.phoneEncrypted,
      city: patients.city,
    })
    .from(patients)
    .where(and(...patientConditions));

  return patientRows
    .filter((r): r is typeof r & { phoneEncrypted: string } => r.phoneEncrypted !== null)
    .map((r) => ({
      patientId: r.id,
      phoneEncrypted: r.phoneEncrypted,
      city: r.city,
    }));
}

// ── POST — send or preview broadcast ──────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const enabled = await getFeatureFlag("mass_broadcast");
  if (!enabled) {
    throw new AppError("SYS_CONFIG_MISSING", "Broadcast not available", "Mass broadcast is not enabled.", 503);
  }

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  const { channel, templateName, vars, hospitalId, city, previewOnly } = parsed.data;

  // Resolve consented recipients
  const recipients = await resolveRecipients(hospitalId, city);

  if (previewOnly) {
    return NextResponse.json({
      preview: true,
      eligibleRecipients: recipients.length,
      channel,
      templateName,
      filters: { hospitalId: hospitalId ?? null, city: city ?? null },
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      queued: false,
      recipientCount: 0,
      message: "No consented recipients found for the given filters.",
    });
  }

  // Decrypt phones — skip patients whose phone can't be decrypted
  const phones: string[] = [];
  let decryptFailed = 0;

  for (const r of recipients) {
    try {
      phones.push(decryptPhone(r.phoneEncrypted));
    } catch {
      decryptFailed++;
    }
  }

  if (phones.length === 0) {
    return NextResponse.json({
      queued: false,
      recipientCount: 0,
      message: "No decryptable phone numbers found.",
    });
  }

  // Send via notification provider
  const notif = getNotificationProvider();
  let sent = 0;
  let failed = 0;

  if (channel === "whatsapp") {
    if (!("sendBroadcast" in notif)) {
      throw new AppError("SYS_CONFIG_MISSING", "WA broadcast not supported", "Set NOTIFICATION_PROVIDER=msg91 for WhatsApp broadcasts.", 503);
    }
    const result = await (notif as any).sendBroadcast(phones, templateName, vars);
    sent = result.sent;
    failed = result.failed;
  } else {
    // SMS campaign
    if (!("sendSMSCampaign" in notif)) {
      throw new AppError("SYS_CONFIG_MISSING", "SMS campaign not supported", "Set NOTIFICATION_PROVIDER=msg91 for SMS campaigns.", 503);
    }
    const result = await (notif as any).sendSMSCampaign(phones, templateName, vars);
    sent = result.sent;
    failed = result.failed;
  }

  // Write audit record to outbox_events
  await db.insert(outboxEvents).values({
    topic: "broadcast.sent",
    payload: {
      channel,
      templateName,
      vars,
      hospitalId: hospitalId ?? null,
      city: city ?? null,
      totalRecipients: recipients.length,
      sent,
      failed,
      decryptFailed,
      sentBy: auth.userId,
      sentAt: new Date().toISOString(),
    },
    status: "processed",
    retryCount: 0,
    availableAt: new Date(),
  });

  return NextResponse.json({
    queued: true,
    recipientCount: phones.length,
    sent,
    failed,
    decryptFailed,
    channel,
    templateName,
  });
});

// ── GET — recent broadcast history ────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const limit = Math.min(
    parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10) || 20,
    100,
  );

  const rows = await db
    .select({
      id: outboxEvents.id,
      payload: outboxEvents.payload,
      createdAt: outboxEvents.createdAt,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.topic, "broadcast.sent"))
    .orderBy(desc(outboxEvents.createdAt))
    .limit(limit);

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      ...(r.payload as Record<string, unknown>),
      sentAt: r.createdAt,
    })),
    total: rows.length,
  });
});
