/**
 * Hospital invitations for doctor portal.
 *
 * GET  /api/v1/portal/doctors/invitations
 *   → doctor sees pending hospital invitations
 *
 * PATCH /api/v1/portal/doctors/invitations
 *   body: { affiliationId, action: "accept" | "decline" }
 *   → doctor accepts or declines the invitation
 *
 * Auth: doctor (own invitations) | admin/owner (any)
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["doctor", "owner", "admin"]);
  if (forbidden) return forbidden;

  const doctorId =
    auth.role === "doctor"
      ? (auth.entityId ?? undefined)
      : (new URL(req.url).searchParams.get("doctorId") ?? undefined);

  if (!doctorId) {
    throw new AppError("SYS_UNHANDLED", "Missing doctorId", "No linked doctor profile.", 400);
  }

  const rows = await db
    .select({
      affiliationId: doctorHospitalAffiliations.id,
      status: doctorHospitalAffiliations.affiliationStatus,
      role: doctorHospitalAffiliations.role,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      invitationNote: doctorHospitalAffiliations.invitationNote,
      createdAt: doctorHospitalAffiliations.createdAt,
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      hospitalPhone: hospitals.phone,
      hospitalEmail: hospitals.email,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(hospitals, eq(hospitals.id, doctorHospitalAffiliations.hospitalId))
    .where(
      and(
        eq(doctorHospitalAffiliations.doctorId, doctorId),
        eq(doctorHospitalAffiliations.affiliationStatus, "pending_doctor_accept"),
      ),
    );

  return NextResponse.json({ data: rows });
});

const patchSchema = z.object({
  affiliationId: z.string().min(1),
  action: z.enum(["accept", "decline"]),
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["doctor", "owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { affiliationId, action } = parsed.data;

  // Fetch the affiliation
  const [affil] = await db
    .select()
    .from(doctorHospitalAffiliations)
    .where(eq(doctorHospitalAffiliations.id, affiliationId))
    .limit(1);

  if (!affil) throw new AppError("DB_NOT_FOUND", "Not found", "Invitation not found.", 404);

  // Doctor can only act on their own invitations
  if (auth.role === "doctor" && affil.doctorId !== auth.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "Not your invitation.", 403);
  }

  if (affil.affiliationStatus !== "pending_doctor_accept") {
    throw new AppError("SYS_UNHANDLED", "Already responded", "This invitation has already been responded to.", 409);
  }

  const now = new Date();

  await db
    .update(doctorHospitalAffiliations)
    .set({
      affiliationStatus: action === "accept" ? "active" : "declined",
      isActive: action === "accept",
      respondedAt: now,
      updatedAt: now,
    })
    .where(eq(doctorHospitalAffiliations.id, affiliationId));

  return NextResponse.json({
    message: action === "accept"
      ? "You are now affiliated with this hospital."
      : "Invitation declined.",
    status: action === "accept" ? "active" : "declined",
  });
});
