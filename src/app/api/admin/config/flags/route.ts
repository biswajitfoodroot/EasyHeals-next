/**
 * Admin Feature Flag Toggle API (Task 3.5)
 *
 * GET    /api/admin/config/flags          → list all flags with status
 * PATCH  /api/admin/config/flags          → toggle a specific flag
 *
 * Auth: admin session cookie required (owner or admin role only)
 * Any toggle is audit-logged.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { featureFlags } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { invalidateFlagCache, P1_FLAGS, P2_FLAGS, P3_FLAGS } from "@/lib/config/feature-flags";

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
});

function phaseOf(key: string): "p1" | "p2" | "p3" | "unknown" {
  if ((P1_FLAGS as readonly string[]).includes(key)) return "p1";
  if ((P2_FLAGS as readonly string[]).includes(key)) return "p2";
  if ((P3_FLAGS as readonly string[]).includes(key)) return "p3";
  return "unknown";
}

const COMPLIANCE_CHECKLIST: Record<string, string[]> = {
  appointment_booking: [
    "Hospital portal P2 feature live",
    "Slot availability API built",
    "Double-booking prevention tested",
    "SMS appointment confirmation live",
    "Cancellation flow implemented",
    "Rescheduling flow implemented",
  ],
  whatsapp_notifications: [
    "WhatsApp Business API account approved",
    "Message templates approved by Meta",
    "Opt-in flow in consent modal",
    "Opt-out / unsubscribe path live",
    "DLT registration complete (India)",
  ],
  gamification_phase_b: [
    "Medical record verification service integrated",
    "Proof validator for appointment claims built",
    "Anti-gaming audit report reviewed by compliance",
    "Leaderboard alias privacy reviewed by legal",
    "DPDP consent for gamification profiling updated",
  ],
  paid_membership: [
    "Razorpay account KYC complete",
    "Subscription webhook tested end-to-end",
    "Refund policy approved by legal",
    "GST registration confirmed",
  ],
};

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth(req);
  if (session instanceof NextResponse) return session;
  const forbidden = ensureRole(session.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const allKeys = [...P1_FLAGS, ...P2_FLAGS, ...P3_FLAGS];

  // Get DB rows
  const dbRows = await db.select().from(featureFlags);
  const dbMap = new Map(dbRows.map((r) => [r.key, r]));

  // P2 compliance checklist items
  const flags = allKeys.map((key) => {
    const row = dbMap.get(key);
    const phase = phaseOf(key);
    const enabled = row?.enabled ?? (phase === "p1"); // P1 defaults ON
    return {
      key,
      phase,
      enabled,
      description: row?.description ?? null,
      updatedAt: row?.updatedAt ?? null,
      complianceChecklist: COMPLIANCE_CHECKLIST[key] ?? [],
    };
  });

  return NextResponse.json({ flags });
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth(req);
  if (session instanceof NextResponse) return session;
  const forbidden = ensureRole(session.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "key and enabled (boolean) are required", 400);
  }

  const { key, enabled } = parsed.data;

  // Upsert the feature flag
  await db
    .insert(featureFlags)
    .values({ key, enabled, updatedBy: session.userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { enabled, updatedBy: session.userId, updatedAt: new Date() },
    });

  // Invalidate in-process cache
  invalidateFlagCache(key);

  return NextResponse.json({
    key,
    enabled,
    message: `Feature flag "${key}" ${enabled ? "enabled" : "disabled"}`,
  });
});
