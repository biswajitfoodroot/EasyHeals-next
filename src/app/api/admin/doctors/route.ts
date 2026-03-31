/**
 * GET  /api/admin/doctors — Search/list doctors with their affiliations
 * PATCH /api/admin/doctors — Update a doctor-hospital affiliation status (current ↔ past)
 *
 * Auth: owner | admin | advisor
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, like, or, desc, and } from "drizzle-orm";
import { db } from "@/db/client";
import { doctors, doctorHospitalAffiliations, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

// ── GET — list doctors with affiliations ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  // Query doctors with optional search
  const doctorRows = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      fullName: doctors.fullName,
      specialization: doctors.specialization,
      city: doctors.city,
      state: doctors.state,
      verified: doctors.verified,
      isActive: doctors.isActive,
      updatedAt: doctors.updatedAt,
    })
    .from(doctors)
    .where(
      q
        ? or(
            like(doctors.fullName, `%${q}%`),
            like(doctors.city, `%${q}%`),
            like(doctors.specialization, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(doctors.updatedAt))
    .limit(limit)
    .offset(offset);

  if (doctorRows.length === 0) {
    return NextResponse.json({ data: { doctors: [], total: 0, page, limit } });
  }

  // Fetch affiliations for these doctors
  const doctorIds = doctorRows.map((d) => d.id);
  const affiliationRows = await db
    .select({
      id: doctorHospitalAffiliations.id,
      doctorId: doctorHospitalAffiliations.doctorId,
      hospitalId: doctorHospitalAffiliations.hospitalId,
      role: doctorHospitalAffiliations.role,
      isActive: doctorHospitalAffiliations.isActive,
      affiliationStatus: doctorHospitalAffiliations.affiliationStatus,
      isPrimary: doctorHospitalAffiliations.isPrimary,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      hospitalState: hospitals.state,
      hospitalSlug: hospitals.slug,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(hospitals, eq(doctorHospitalAffiliations.hospitalId, hospitals.id))
    .where(
      doctorIds.length === 1
        ? eq(doctorHospitalAffiliations.doctorId, doctorIds[0])
        : or(...doctorIds.map((id) => eq(doctorHospitalAffiliations.doctorId, id))),
    )
    .orderBy(desc(doctorHospitalAffiliations.isPrimary), desc(doctorHospitalAffiliations.isActive));

  // Group affiliations by doctor
  const affMap = new Map<string, typeof affiliationRows>();
  for (const aff of affiliationRows) {
    if (!affMap.has(aff.doctorId)) affMap.set(aff.doctorId, []);
    affMap.get(aff.doctorId)!.push(aff);
  }

  const result = doctorRows.map((d) => ({
    ...d,
    affiliations: affMap.get(d.id) ?? [],
  }));

  return NextResponse.json({ data: { doctors: result, page, limit } });
}

// ── PATCH — update affiliation status ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null) as {
    affiliationId?: string;
    action?: "mark_current" | "mark_past" | "set_primary";
  } | null;

  if (!body?.affiliationId || !body?.action) {
    return NextResponse.json({ error: "affiliationId and action required" }, { status: 400 });
  }

  const { affiliationId, action } = body;

  if (action === "mark_current") {
    await db.update(doctorHospitalAffiliations)
      .set({ isActive: true, affiliationStatus: "active", role: "Consultant", updatedAt: new Date() })
      .where(eq(doctorHospitalAffiliations.id, affiliationId));
  } else if (action === "mark_past") {
    await db.update(doctorHospitalAffiliations)
      .set({ isActive: false, affiliationStatus: "removed", isPrimary: false, role: "Previously worked here", updatedAt: new Date() })
      .where(eq(doctorHospitalAffiliations.id, affiliationId));
  } else if (action === "set_primary") {
    // Get the doctorId and hospitalId for this affiliation
    const [aff] = await db.select({ doctorId: doctorHospitalAffiliations.doctorId })
      .from(doctorHospitalAffiliations)
      .where(eq(doctorHospitalAffiliations.id, affiliationId))
      .limit(1);
    if (aff) {
      // Unset primary on all other affiliations for this doctor
      await db.update(doctorHospitalAffiliations)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(doctorHospitalAffiliations.doctorId, aff.doctorId));
      // Set primary on this one + ensure active
      await db.update(doctorHospitalAffiliations)
        .set({ isPrimary: true, isActive: true, affiliationStatus: "active", updatedAt: new Date() })
        .where(eq(doctorHospitalAffiliations.id, affiliationId));
    }
  }

  return NextResponse.json({ data: { ok: true } });
}
