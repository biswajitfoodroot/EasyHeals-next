/**
 * Smart Reminders — Patient Reminder Preferences
 *
 * GET  /api/v1/patients/reminders        — list active reminders
 * POST /api/v1/patients/reminders        — create reminder
 * PATCH /api/v1/patients/reminders       — toggle active / update schedule
 * DELETE /api/v1/patients/reminders      — deactivate reminder
 *
 * Flag: smart_reminders
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { patientReminders } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { encryptPHI, decryptPHI } from "@/lib/health/encryption";

const ALLOWED_TYPES = new Set(["medication", "appointment", "checkin", "lab_followup"]);
const ALLOWED_CHANNELS = new Set(["whatsapp", "push", "both"]);

function computeNextFire(cron: string | null): Date | null {
  // Simple next-fire computation for common cron patterns
  // e.g. "0 8 * * *" = daily at 08:00 UTC
  if (!cron) return null;
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date(now);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(Number(minute) || 0);
    next.setUTCHours(Number(hour) || 8);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  } catch {
    return null;
  }
}

// ── GET ────────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("smart_reminders");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const rows = await db
    .select({
      id: patientReminders.id,
      reminderType: patientReminders.reminderType,
      title: patientReminders.title,
      bodyEnc: patientReminders.bodyEnc,
      scheduleCron: patientReminders.scheduleCron,
      channel: patientReminders.channel,
      isActive: patientReminders.isActive,
      isAiGenerated: patientReminders.isAiGenerated,
      lastSentAt: patientReminders.lastSentAt,
      nextFireAt: patientReminders.nextFireAt,
      createdAt: patientReminders.createdAt,
    })
    .from(patientReminders)
    .where(eq(patientReminders.patientId, patientId));

  const reminders = rows.map((r) => {
    let body: string | null = null;
    try { if (r.bodyEnc) body = decryptPHI<string>(r.bodyEnc); } catch { /* skip */ }
    return { ...r, body, bodyEnc: undefined };
  });

  return NextResponse.json({ reminders });
});

// ── POST ───────────────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("smart_reminders");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as {
    reminderType: string;
    title: string;
    body?: string;
    scheduleCron?: string;
    channel?: string;
  } | null;

  if (!body?.reminderType || !body?.title) {
    throw new AppError("VALIDATION_ERROR", "reminderType and title required", "Please provide reminder type and title.", 400);
  }
  if (!ALLOWED_TYPES.has(body.reminderType)) {
    throw new AppError("VALIDATION_ERROR", "invalid reminderType", `Allowed: ${[...ALLOWED_TYPES].join(", ")}`, 400);
  }
  if (body.channel && !ALLOWED_CHANNELS.has(body.channel)) {
    throw new AppError("VALIDATION_ERROR", "invalid channel", `Allowed: ${[...ALLOWED_CHANNELS].join(", ")}`, 400);
  }

  const bodyEnc = body.body ? encryptPHI(body.body) : null;
  const nextFireAt = computeNextFire(body.scheduleCron ?? null);

  const [inserted] = await db
    .insert(patientReminders)
    .values({
      patientId,
      reminderType: body.reminderType,
      title: body.title.slice(0, 120),
      bodyEnc,
      scheduleCron: body.scheduleCron ?? null,
      channel: body.channel ?? "whatsapp",
      nextFireAt,
    })
    .returning({ id: patientReminders.id });

  return NextResponse.json({ id: inserted.id, ok: true }, { status: 201 });
});

// ── PATCH ──────────────────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("smart_reminders");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as {
    id: string;
    isActive?: boolean;
    scheduleCron?: string;
    channel?: string;
  } | null;

  if (!body?.id) {
    throw new AppError("VALIDATION_ERROR", "id required", "Provide reminder id.", 400);
  }

  const updateSet: Record<string, unknown> = {};
  if (body.isActive !== undefined) updateSet.isActive = body.isActive;
  if (body.scheduleCron !== undefined) {
    updateSet.scheduleCron = body.scheduleCron;
    updateSet.nextFireAt = computeNextFire(body.scheduleCron);
  }
  if (body.channel && ALLOWED_CHANNELS.has(body.channel)) updateSet.channel = body.channel;

  if (Object.keys(updateSet).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .update(patientReminders)
    .set(updateSet)
    .where(and(eq(patientReminders.id, body.id), eq(patientReminders.patientId, patientId)));

  return NextResponse.json({ ok: true });
});

// ── DELETE ─────────────────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("smart_reminders");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new AppError("VALIDATION_ERROR", "id required", "Provide ?id= query param.", 400);

  await db
    .update(patientReminders)
    .set({ isActive: false })
    .where(and(eq(patientReminders.id, id), eq(patientReminders.patientId, patientId)));

  return NextResponse.json({ ok: true });
});
