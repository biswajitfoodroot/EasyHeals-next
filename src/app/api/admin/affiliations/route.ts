/**
 * Admin: CRUD for doctor-hospital affiliations
 *
 * GET  /api/admin/affiliations?doctorId=xxx         — list affiliations for a doctor (with hospital details)
 * GET  /api/admin/affiliations?hospitalId=xxx       — list affiliations for a hospital (with doctor details)
 * GET  /api/admin/affiliations?searchDoctors=name   — search doctors by name (for autocomplete)
 * GET  /api/admin/affiliations?searchHospitals=q    — search hospitals by name/city (for autocomplete)
 * GET  /api/admin/affiliations?duplicates=hospitalId — find duplicate doctor entries at a hospital
 * POST /api/admin/affiliations                      — create / reactivate affiliation
 * POST /api/admin/affiliations/merge                — merge duplicate doctors (keepId + deleteId)
 * PATCH /api/admin/affiliations?id=xxx              — update role, isPrimary, isActive, fees
 * DELETE /api/admin/affiliations?id=xxx             — hard-delete affiliation record
 */
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");
  const hospitalId = url.searchParams.get("hospitalId");
  const searchDoctors = url.searchParams.get("searchDoctors");
  const searchHospitals = url.searchParams.get("searchHospitals");
  const duplicatesHospitalId = url.searchParams.get("duplicates");

  // ── Search doctors by name ─────────────────────────────────────────────────
  if (searchDoctors !== null) {
    if (searchDoctors.trim().length < 2) return NextResponse.json({ data: [] });
    const q = `%${searchDoctors.trim()}%`;
    const rows = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        city: doctors.city,
        state: doctors.state,
        specialization: doctors.specialization,
        isActive: doctors.isActive,
      })
      .from(doctors)
      .where(like(doctors.fullName, q))
      .orderBy(asc(doctors.fullName))
      .limit(20);
    return NextResponse.json({ data: rows });
  }

  // ── Search hospitals by name or city ──────────────────────────────────────
  if (searchHospitals !== null) {
    if (searchHospitals.trim().length < 2) return NextResponse.json({ data: [] });
    const q = `%${searchHospitals.trim()}%`;
    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        city: hospitals.city,
        state: hospitals.state,
        isActive: hospitals.isActive,
      })
      .from(hospitals)
      .where(or(like(hospitals.name, q), like(hospitals.city, q)))
      .orderBy(asc(hospitals.name))
      .limit(20);
    return NextResponse.json({ data: rows });
  }

  // ── Find duplicate doctors at a hospital ─────────────────────────────────
  // Groups doctors affiliated with the same hospital that share the same
  // normalized name (strips "Dr." prefix, case-insensitive, trims spaces).
  if (duplicatesHospitalId) {
    const rows = await db
      .select({
        affiliationId: doctorHospitalAffiliations.id,
        affiliationIsActive: doctorHospitalAffiliations.isActive,
        doctorId: doctors.id,
        doctorName: doctors.fullName,
        doctorCity: doctors.city,
        doctorSpecialization: doctors.specialization,
        doctorIsActive: doctors.isActive,
        doctorCreatedAt: doctors.createdAt,
        doctorSlug: doctors.slug,
      })
      .from(doctorHospitalAffiliations)
      .innerJoin(doctors, eq(doctorHospitalAffiliations.doctorId, doctors.id))
      .where(eq(doctorHospitalAffiliations.hospitalId, duplicatesHospitalId))
      .orderBy(asc(doctors.fullName));

    // Group by normalized name
    const normalize = (n: string) =>
      n.trim().replace(/^dr\.?\s+/i, "").replace(/\s+/g, " ").toLowerCase();

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = normalize(row.doctorName);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    // Only return groups with more than one entry (actual duplicates)
    const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);
    return NextResponse.json({ data: duplicateGroups });
  }

  // ── List affiliations for a doctor ─────────────────────────────────────────
  if (doctorId) {
    const rows = await db
      .select({
        id: doctorHospitalAffiliations.id,
        role: doctorHospitalAffiliations.role,
        isPrimary: doctorHospitalAffiliations.isPrimary,
        isActive: doctorHospitalAffiliations.isActive,
        affiliationStatus: doctorHospitalAffiliations.affiliationStatus,
        feeMin: doctorHospitalAffiliations.feeMin,
        feeMax: doctorHospitalAffiliations.feeMax,
        source: doctorHospitalAffiliations.source,
        createdAt: doctorHospitalAffiliations.createdAt,
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        hospitalState: hospitals.state,
        hospitalSlug: hospitals.slug,
        hospitalIsActive: hospitals.isActive,
      })
      .from(doctorHospitalAffiliations)
      .innerJoin(hospitals, eq(doctorHospitalAffiliations.hospitalId, hospitals.id))
      .where(eq(doctorHospitalAffiliations.doctorId, doctorId))
      .orderBy(desc(doctorHospitalAffiliations.isPrimary), asc(hospitals.name))
      .limit(200);
    return NextResponse.json({ data: rows });
  }

  // ── List affiliations for a hospital ──────────────────────────────────────
  if (hospitalId) {
    const rows = await db
      .select({
        id: doctorHospitalAffiliations.id,
        role: doctorHospitalAffiliations.role,
        isPrimary: doctorHospitalAffiliations.isPrimary,
        isActive: doctorHospitalAffiliations.isActive,
        affiliationStatus: doctorHospitalAffiliations.affiliationStatus,
        feeMin: doctorHospitalAffiliations.feeMin,
        feeMax: doctorHospitalAffiliations.feeMax,
        source: doctorHospitalAffiliations.source,
        createdAt: doctorHospitalAffiliations.createdAt,
        doctorId: doctors.id,
        doctorName: doctors.fullName,
        doctorCity: doctors.city,
        doctorSpecialization: doctors.specialization,
        doctorIsActive: doctors.isActive,
      })
      .from(doctorHospitalAffiliations)
      .innerJoin(doctors, eq(doctorHospitalAffiliations.doctorId, doctors.id))
      .where(eq(doctorHospitalAffiliations.hospitalId, hospitalId))
      .orderBy(desc(doctorHospitalAffiliations.isPrimary), asc(doctors.fullName))
      .limit(200);
    return NextResponse.json({ data: rows });
  }

  return NextResponse.json(
    { error: "Provide doctorId, hospitalId, searchDoctors, or searchHospitals query param" },
    { status: 400 },
  );
}

// ── POST: create (or reactivate) affiliation ──────────────────────────────────

const createSchema = z.object({
  doctorId: z.string().min(1),
  hospitalId: z.string().min(1),
  role: z.string().max(100).default("Consultant"),
  isPrimary: z.boolean().default(false),
  feeMin: z.number().min(0).nullable().optional(),
  feeMax: z.number().min(0).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // Verify both entities exist
  const [doctor] = await db.select({ id: doctors.id, fullName: doctors.fullName })
    .from(doctors).where(eq(doctors.id, d.doctorId)).limit(1);
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const [hospital] = await db.select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals).where(eq(hospitals.id, d.hospitalId)).limit(1);
  if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  // Upsert: if record already exists, reactivate it with new values
  const [existing] = await db
    .select({ id: doctorHospitalAffiliations.id })
    .from(doctorHospitalAffiliations)
    .where(
      and(
        eq(doctorHospitalAffiliations.doctorId, d.doctorId),
        eq(doctorHospitalAffiliations.hospitalId, d.hospitalId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.update(doctorHospitalAffiliations).set({
      role: d.role,
      isPrimary: d.isPrimary,
      feeMin: d.feeMin ?? null,
      feeMax: d.feeMax ?? null,
      isActive: true,
      affiliationStatus: "active",
      updatedAt: new Date(),
    }).where(eq(doctorHospitalAffiliations.id, existing.id));

    await writeAuditLog({
      actorUserId: auth.userId,
      action: "admin.affiliation.reactivate",
      entityType: "doctor",
      entityId: d.doctorId,
      changes: { hospitalId: d.hospitalId, role: d.role },
    });
    return NextResponse.json({ data: { id: existing.id }, reactivated: true });
  }

  const [created] = await db.insert(doctorHospitalAffiliations).values({
    doctorId: d.doctorId,
    hospitalId: d.hospitalId,
    role: d.role,
    isPrimary: d.isPrimary,
    feeMin: d.feeMin ?? null,
    feeMax: d.feeMax ?? null,
    source: "admin",
    affiliationStatus: "active",
    isActive: true,
  }).returning();

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.affiliation.create",
    entityType: "doctor",
    entityId: d.doctorId,
    changes: { hospitalId: d.hospitalId, hospitalName: hospital.name, role: d.role },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

// ── PATCH: update affiliation fields ─────────────────────────────────────────

const patchSchema = z.object({
  role: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  feeMin: z.number().min(0).nullable().optional(),
  feeMax: z.number().min(0).nullable().optional(),
  affiliationStatus: z.enum(["active", "pending_doctor_accept", "declined", "removed"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const body = await req.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: doctorHospitalAffiliations.id, doctorId: doctorHospitalAffiliations.doctorId })
    .from(doctorHospitalAffiliations)
    .where(eq(doctorHospitalAffiliations.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Affiliation not found" }, { status: 404 });

  const updates: Partial<typeof doctorHospitalAffiliations.$inferInsert> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.role !== undefined) updates.role = d.role;
  if (d.isPrimary !== undefined) updates.isPrimary = d.isPrimary;
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  if (d.feeMin !== undefined) updates.feeMin = d.feeMin;
  if (d.feeMax !== undefined) updates.feeMax = d.feeMax;
  if (d.affiliationStatus !== undefined) updates.affiliationStatus = d.affiliationStatus;

  const [updated] = await db
    .update(doctorHospitalAffiliations)
    .set(updates)
    .where(eq(doctorHospitalAffiliations.id, id))
    .returning();

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.affiliation.update",
    entityType: "doctor",
    entityId: existing.doctorId,
    changes: d,
  });

  return NextResponse.json({ data: updated });
}

// ── DELETE: hard-delete affiliation ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // Only owner/admin can hard-delete; advisor can only deactivate via PATCH
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const [existing] = await db
    .select({ id: doctorHospitalAffiliations.id, doctorId: doctorHospitalAffiliations.doctorId, hospitalId: doctorHospitalAffiliations.hospitalId })
    .from(doctorHospitalAffiliations)
    .where(eq(doctorHospitalAffiliations.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Affiliation not found" }, { status: 404 });

  await db.delete(doctorHospitalAffiliations).where(eq(doctorHospitalAffiliations.id, id));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.affiliation.delete",
    entityType: "doctor",
    entityId: existing.doctorId,
    changes: { hospitalId: existing.hospitalId },
  });

  return NextResponse.json({ ok: true });
}
