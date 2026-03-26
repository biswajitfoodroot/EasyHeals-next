/**
 * POST /api/admin/providers/network  — Mark a hospital/doctor as EasyHeals Network partner
 * DELETE /api/admin/providers/network — Remove network status (terminates the agreement)
 *
 * Auth: owner/admin only
 *
 * POST body:
 *   entityId:      string (hospital or doctor id)
 *   entityType:    'hospital' | 'doctor'
 *   tierCode:      'basic' | 'partner' | 'premium'
 *   agreementType?: 'network_partnership' | 'referral_only' | 'destination_only'
 *   notes?:        string
 *   commissionPercent?: number
 *
 * DELETE body:
 *   agreementId: string  (provider_agreements.id)
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals, doctors, providerAgreements, agreementEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

const addSchema = z.object({
  entityId:         z.string().uuid(),
  entityType:       z.enum(["hospital", "doctor"]),
  tierCode:         z.enum(["basic", "partner", "premium"]).default("partner"),
  agreementType:    z.enum(["network_partnership", "referral_only", "destination_only"]).default("network_partnership"),
  notes:            z.string().max(1000).optional(),
  commissionPercent: z.number().int().min(0).max(100).optional(),
});

const removeSchema = z.object({
  agreementId: z.string().uuid(),
});

// ── POST — add to network ─────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const { entityId, entityType, tierCode, agreementType, notes, commissionPercent } = parsed.data;

  // Verify entity exists
  if (entityType === "hospital") {
    const [h] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, entityId)).limit(1);
    if (!h) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  } else {
    const [d] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, entityId)).limit(1);
    if (!d) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  // Check for an existing agreement for this entity
  const existing = await db
    .select({ id: providerAgreements.id, status: providerAgreements.status })
    .from(providerAgreements)
    .where(
      entityType === "hospital"
        ? eq(providerAgreements.hospitalId, entityId)
        : eq(providerAgreements.doctorId, entityId),
    )
    .limit(1);

  const now = new Date();
  let agreementId: string;

  if (existing.length > 0) {
    // Update existing agreement to accepted
    agreementId = existing[0]!.id;
    await db
      .update(providerAgreements)
      .set({
        status: "accepted",
        tierCode,
        agreementType,
        notes: notes ?? null,
        commissionPercent: commissionPercent ?? null,
        acceptedAt: now,
        acceptedByUserId: auth.userId,
        updatedAt: now,
      })
      .where(eq(providerAgreements.id, agreementId));
  } else {
    // Create new agreement
    const [inserted] = await db
      .insert(providerAgreements)
      .values({
        hospitalId:      entityType === "hospital" ? entityId : null,
        doctorId:        entityType === "doctor"   ? entityId : null,
        entityType,
        agreementType,
        tierCode,
        status:          "accepted",
        termsVersion:    "v1",
        notes:           notes ?? null,
        commissionPercent: commissionPercent ?? null,
        acceptedAt:      now,
        acceptedByUserId: auth.userId,
        createdBy:       auth.userId,
      })
      .returning({ id: providerAgreements.id });
    agreementId = inserted!.id;
  }

  // Audit event
  await db.insert(agreementEvents).values({
    agreementId,
    eventType: "accepted",
    actorId: auth.userId,
    note: `Manually marked as EasyHeals Network partner (${tierCode}) by admin`,
  }).catch(() => null); // non-fatal

  // Also mark the entity as verified
  if (entityType === "hospital") {
    await db.update(hospitals).set({ verified: true, updatedAt: now }).where(eq(hospitals.id, entityId));
  } else {
    await db.update(doctors).set({ verified: true, updatedAt: now }).where(eq(doctors.id, entityId));
  }

  return NextResponse.json({
    ok: true,
    agreementId,
    message: `${entityType === "hospital" ? "Hospital" : "Doctor"} added to EasyHeals Network as ${tierCode}.`,
  });
});

// ── DELETE — remove from network ──────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "agreementId (UUID) required" }, { status: 400 });
  }

  const { agreementId } = parsed.data;

  const [ag] = await db
    .select({ id: providerAgreements.id, status: providerAgreements.status })
    .from(providerAgreements)
    .where(eq(providerAgreements.id, agreementId))
    .limit(1);

  if (!ag) return NextResponse.json({ error: "Agreement not found" }, { status: 404 });

  await db
    .update(providerAgreements)
    .set({ status: "terminated", updatedAt: new Date() })
    .where(eq(providerAgreements.id, agreementId));

  await db.insert(agreementEvents).values({
    agreementId,
    eventType: "terminated",
    actorId: auth.userId,
    note: "Removed from EasyHeals Network by admin",
  }).catch(() => null);

  return NextResponse.json({ ok: true, message: "Provider removed from EasyHeals Network." });
});
