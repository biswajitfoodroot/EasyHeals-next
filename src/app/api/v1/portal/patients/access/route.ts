/**
 * GET  /api/v1/portal/patients/access?patientId=&hospitalId=
 *   → list active access grants for a patient at this hospital
 *
 * POST /api/v1/portal/patients/access
 *   body: { patientId, grantedToUserId, accessLevel, hospitalId?, expiresInDays?, notes? }
 *   → doctor/admin grants staff access to patient records
 *
 * DELETE /api/v1/portal/patients/access?patientId=&grantedToUserId=&hospitalId=
 *   → revoke an access grant
 *
 * Auth: doctor (own patients only) | hospital_admin | owner/admin
 */

import { and, eq, isNull, or, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { patientRecordAccess, users, appointments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

// ── GET ────────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  if (!patientId) throw new AppError("SYS_UNHANDLED", "Missing param", "patientId required.", 400);

  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  const now = new Date();
  const conditions = [
    eq(patientRecordAccess.patientId, patientId),
    isNull(patientRecordAccess.revokedAt),
    or(isNull(patientRecordAccess.expiresAt), gt(patientRecordAccess.expiresAt, now)),
  ];
  if (hospitalId) conditions.push(eq(patientRecordAccess.hospitalId, hospitalId));

  const rows = await db
    .select({
      id: patientRecordAccess.id,
      grantedToUserId: patientRecordAccess.grantedToUserId,
      grantedToName: users.fullName,
      grantedToEmail: users.email,
      accessLevel: patientRecordAccess.accessLevel,
      expiresAt: patientRecordAccess.expiresAt,
      notes: patientRecordAccess.notes,
      createdAt: patientRecordAccess.createdAt,
    })
    .from(patientRecordAccess)
    .leftJoin(users, eq(users.id, patientRecordAccess.grantedToUserId))
    .where(and(...conditions));

  return NextResponse.json({ data: rows });
});

// ── POST ───────────────────────────────────────────────────────────────────────

const grantSchema = z.object({
  patientId: z.string().min(1),
  grantedToUserId: z.string().min(1),
  accessLevel: z.enum(["metadata", "full"]).default("full"),
  hospitalId: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  notes: z.string().max(500).optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { patientId, grantedToUserId, accessLevel, hospitalId, expiresInDays, notes } = parsed.data;

  const effectiveHospitalId =
    auth.role === "hospital_admin" ? (auth.entityId ?? hospitalId) : (hospitalId ?? null);

  // Doctor: verify the patient has at least one appointment with them
  if (auth.role === "doctor" && auth.entityId) {
    const [appt] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.patientId, patientId), eq(appointments.doctorId, auth.entityId)))
      .limit(1);
    if (!appt) {
      throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only grant access for your own patients.", 403);
    }
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400_000)
    : null;

  await db
    .insert(patientRecordAccess)
    .values({
      patientId,
      grantedToUserId,
      grantedByUserId: auth.userId,
      hospitalId: effectiveHospitalId,
      accessLevel,
      expiresAt,
      notes,
    })
    .onConflictDoUpdate({
      target: [
        patientRecordAccess.patientId,
        patientRecordAccess.grantedToUserId,
        patientRecordAccess.hospitalId,
      ],
      set: { accessLevel, expiresAt, revokedAt: null, notes },
    });

  return NextResponse.json({ message: "Access granted." }, { status: 201 });
});

// ── DELETE ─────────────────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const grantedToUserId = url.searchParams.get("grantedToUserId");

  if (!patientId || !grantedToUserId) {
    throw new AppError("SYS_UNHANDLED", "Missing params", "patientId and grantedToUserId required.", 400);
  }

  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? null)
      : (url.searchParams.get("hospitalId") ?? null);

  const conditions = [
    eq(patientRecordAccess.patientId, patientId),
    eq(patientRecordAccess.grantedToUserId, grantedToUserId),
  ];
  if (hospitalId) conditions.push(eq(patientRecordAccess.hospitalId, hospitalId));

  await db
    .update(patientRecordAccess)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));

  return NextResponse.json({ message: "Access revoked." });
});
