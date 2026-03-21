/**
 * GET  /api/v1/portal/doctors   — list doctors affiliated with the hospital
 * POST /api/v1/portal/doctors   — add new doctor OR link existing doctor to hospital
 *
 * Auth: hospital_admin (own hospital) | admin/owner (any hospital via ?hospitalId=)
 *
 * POST body variants:
 *   { action: "link",   doctorId: string, role?: string }              — link existing
 *   { action: "create", fullName, specialization, phone?, email?, ... } — create new + link
 */

import { and, eq, like, or, SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, doctorHospitalAffiliations, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

// ── GET ────────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);

  // hospital_admin is scoped to own hospital; others can pass ?hospitalId=
  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  if (!hospitalId) {
    throw new AppError("SYS_UNHANDLED", "Missing hospitalId", "Provide ?hospitalId= param.", 400);
  }

  // Multi-field search for doctor linking flow
  const search      = url.searchParams.get("search") ?? "";
  const nameQ       = url.searchParams.get("name") ?? "";
  const phoneQ      = url.searchParams.get("phone") ?? "";
  const specialtyQ  = url.searchParams.get("specialty") ?? "";
  const cityQ       = url.searchParams.get("city") ?? "";

  const isSearchMode = search || nameQ || phoneQ || specialtyQ || cityQ;

  if (isSearchMode) {
    // Return doctors not yet linked to this hospital — for the "link existing" flow
    const linked = await db
      .select({ doctorId: doctorHospitalAffiliations.doctorId })
      .from(doctorHospitalAffiliations)
      .where(eq(doctorHospitalAffiliations.hospitalId, hospitalId));
    const linkedIds = linked.map((r) => r.doctorId);

    // Build filter clauses
    const clauses: SQL[] = [eq(doctors.isActive, true)];
    if (search) {
      clauses.push(or(
        like(doctors.fullName, `%${search}%`),
        like(doctors.specialization, `%${search}%`),
      ) as SQL);
    }
    if (nameQ)      clauses.push(like(doctors.fullName, `%${nameQ}%`));
    if (phoneQ)     clauses.push(like(doctors.phone, `%${phoneQ}%`));
    if (specialtyQ) clauses.push(like(doctors.specialization, `%${specialtyQ}%`));
    if (cityQ)      clauses.push(like(doctors.city, `%${cityQ}%`));

    const results = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        specialization: doctors.specialization,
        phone: doctors.phone,
        email: doctors.email,
        city: doctors.city,
        avatarUrl: doctors.avatarUrl,
        verified: doctors.verified,
        yearsOfExperience: doctors.yearsOfExperience,
        isActive: doctors.isActive,
      })
      .from(doctors)
      .where(and(...clauses))
      .limit(20);

    return NextResponse.json({
      data: results.filter((d) => !linkedIds.includes(d.id)),
    });
  }

  // Return affiliated doctors with affiliation metadata
  const rows = await db
    .select({
      affiliationId: doctorHospitalAffiliations.id,
      role: doctorHospitalAffiliations.role,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      isPrimary: doctorHospitalAffiliations.isPrimary,
      isActive: doctorHospitalAffiliations.isActive,
      createdAt: doctorHospitalAffiliations.createdAt,
      doctorId: doctors.id,
      fullName: doctors.fullName,
      specialization: doctors.specialization,
      specialties: doctors.specialties,
      phone: doctors.phone,
      email: doctors.email,
      avatarUrl: doctors.avatarUrl,
      yearsOfExperience: doctors.yearsOfExperience,
      verified: doctors.verified,
      doctorIsActive: doctors.isActive,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(doctors, eq(doctors.id, doctorHospitalAffiliations.doctorId))
    .where(
      and(
        eq(doctorHospitalAffiliations.hospitalId, hospitalId),
        eq(doctorHospitalAffiliations.isActive, true),
      ),
    )
    .orderBy(doctorHospitalAffiliations.createdAt);

  return NextResponse.json({ data: rows, hospitalId });
});

// ── POST ───────────────────────────────────────────────────────────────────────

const linkSchema = z.object({
  action: z.literal("link"),
  doctorId: z.string().min(1),
  role: z.string().max(100).optional().default("Visiting Consultant"),
  feeMin: z.number().min(0).optional(),
  feeMax: z.number().min(0).optional(),
  isPrimary: z.boolean().optional().default(false),
});

const createSchema = z.object({
  action: z.literal("create"),
  fullName: z.string().min(2).max(200),
  specialization: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
  role: z.string().max(100).optional().default("Visiting Consultant"),
  feeMin: z.number().min(0).optional(),
  feeMax: z.number().min(0).optional(),
  isPrimary: z.boolean().optional().default(false),
});

const postSchema = z.discriminatedUnion("action", [linkSchema, createSchema]);

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  if (!hospitalId) {
    throw new AppError("SYS_UNHANDLED", "Missing hospitalId", "Provide ?hospitalId= param.", 400);
  }

  // Verify hospital exists
  const [hosp] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  if (!hosp) throw new AppError("DB_NOT_FOUND", "Not found", "Hospital not found.", 404);

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const input = parsed.data;
  let doctorId: string;

  if (input.action === "create") {
    // Create new doctor + auto-link
    const slug = `dr-${input.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const [newDoc] = await db
      .insert(doctors)
      .values({
        fullName: input.fullName,
        slug,
        specialization: input.specialization,
        phone: input.phone,
        email: input.email,
        yearsOfExperience: input.yearsOfExperience,
        hospitalId,
        isActive: true,
      })
      .returning({ id: doctors.id });
    doctorId = newDoc.id;
  } else {
    // Link existing
    const [existing] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, input.doctorId)).limit(1);
    if (!existing) throw new AppError("DB_NOT_FOUND", "Not found", "Doctor not found.", 404);
    doctorId = input.doctorId;
  }

  // Determine affiliation status:
  // - "create" action (hospital creates new doctor) → directly active (hospital owns the record)
  // - "link" action (hospital inviting an existing doctor) → pending_doctor_accept (doctor must confirm)
  const affiliationStatus = input.action === "create" ? "active" : "pending_doctor_accept";
  const isActive = input.action === "create";

  // Create or restore affiliation
  await db
    .insert(doctorHospitalAffiliations)
    .values({
      doctorId,
      hospitalId,
      role: input.role ?? "Visiting Consultant",
      feeMin: input.feeMin,
      feeMax: input.feeMax,
      isPrimary: input.isPrimary ?? false,
      affiliationStatus,
      invitedBy: auth.userId,
      isActive,
      source: "portal",
    })
    .onConflictDoUpdate({
      target: [doctorHospitalAffiliations.doctorId, doctorHospitalAffiliations.hospitalId],
      set: {
        affiliationStatus,
        isActive,
        invitedBy: auth.userId,
        role: input.role ?? "Visiting Consultant",
        updatedAt: new Date(),
      },
    });

  const message = input.action === "create"
    ? "Doctor created and linked."
    : "Invitation sent. Doctor will be notified to accept.";

  return NextResponse.json({ doctorId, hospitalId, message, status: affiliationStatus }, { status: 201 });
});

// ── DELETE (remove affiliation) ────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");
  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  if (!doctorId || !hospitalId) {
    throw new AppError("SYS_UNHANDLED", "Missing params", "Provide ?doctorId= and ?hospitalId= params.", 400);
  }

  await db
    .update(doctorHospitalAffiliations)
    .set({ isActive: false, deletedAt: new Date() })
    .where(
      and(
        eq(doctorHospitalAffiliations.doctorId, doctorId),
        eq(doctorHospitalAffiliations.hospitalId, hospitalId),
      ),
    );

  return NextResponse.json({ message: "Doctor removed from hospital." });
});
