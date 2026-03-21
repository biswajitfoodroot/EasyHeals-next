/**
 * GET /api/admin/patients — List patients with health data stats (admin only)
 *
 * Auth: admin session (owner/admin role)
 * Returns: patient list with document + event + appointment counts
 * PHI: Patient phone/identity NOT returned — only aggregate counts
 */

import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { patients, healthDocuments, healthMemoryEvents, appointments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  // Get patients with aggregate stats
  const patientRows = await db
    .select({
      id: patients.id,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .orderBy(desc(patients.createdAt))
    .limit(limit)
    .offset(offset);

  // For each patient, get counts
  const enriched = await Promise.all(
    patientRows.map(async (p) => {
      const [docCount, eventCount, apptCount] = await Promise.all([
        db.select({ n: count() }).from(healthDocuments).where(eq(healthDocuments.patientId, p.id)),
        db.select({ n: count() }).from(healthMemoryEvents).where(eq(healthMemoryEvents.patientId, p.id)),
        db.select({ n: count() }).from(appointments).where(eq(appointments.patientId, p.id)),
      ]);
      return {
        id: p.id,
        createdAt: p.createdAt,
        documentCount: docCount[0]?.n ?? 0,
        eventCount: eventCount[0]?.n ?? 0,
        appointmentCount: apptCount[0]?.n ?? 0,
      };
    })
  );

  return NextResponse.json({ data: enriched, meta: { limit, offset, count: enriched.length } });
});

// ── PATCH — set subscription tier (admin/owner only, for testing & manual overrides) ──

const patchSchema = z.object({
  patientId: z.string().min(1),
  tier: z.enum(["free", "health_plus", "health_pro", "trial"]),
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { patientId, tier } = parsed.data;

  // 1 year expiry for paid tiers (dev/admin override, not real billing)
  const expiresAt = tier === "free" || tier === "trial"
    ? null
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const trialStartedAt = tier === "trial" ? new Date() : null;
  const subscriptionTier = tier === "trial" ? "free" : tier;

  await db
    .update(patients)
    .set({
      subscriptionTier,
      subscriptionExpiresAt: expiresAt,
      ...(tier === "trial" ? { trialStartedAt } : {}),
    })
    .where(eq(patients.id, patientId));

  return NextResponse.json({
    patientId,
    tier: subscriptionTier,
    subscriptionExpiresAt: expiresAt?.toISOString() ?? null,
    message: tier === "trial"
      ? "Trial reset — 21-day window starts now."
      : tier === "free"
      ? "Patient set to free tier."
      : `Patient upgraded to ${tier} (expires ${expiresAt?.toLocaleDateString()}).`,
  });
});
