/**
 * Doctor portal: view own hospital affiliations (ID-based only, no hospitalId column)
 *
 * GET /api/portal/doctor/affiliations
 *   - doctor role       → own affiliations from doctorHospitalAffiliations table
 *   - admin/advisor     → pass ?doctorId= to view any doctor's affiliations
 */
import { asc, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  let doctorId = auth.entityId;

  if (auth.role !== "doctor") {
    const url = new URL(req.url);
    const qid = url.searchParams.get("doctorId");
    if (qid) doctorId = qid;
  }

  if (!doctorId) {
    return NextResponse.json({ error: "No linked doctor" }, { status: 400 });
  }

  if (auth.role === "doctor" && auth.entityId !== doctorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      affiliationId: doctorHospitalAffiliations.id,
      role: doctorHospitalAffiliations.role,
      isPrimary: doctorHospitalAffiliations.isPrimary,
      isActive: doctorHospitalAffiliations.isActive,
      affiliationStatus: doctorHospitalAffiliations.affiliationStatus,
      feeMin: doctorHospitalAffiliations.feeMin,
      feeMax: doctorHospitalAffiliations.feeMax,
      source: doctorHospitalAffiliations.source,
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      hospitalState: hospitals.state,
      hospitalSlug: hospitals.slug,
      hospitalPhone: hospitals.phone,
      hospitalWebsite: hospitals.website,
    })
    .from(doctorHospitalAffiliations)
    .innerJoin(hospitals, eq(doctorHospitalAffiliations.hospitalId, hospitals.id))
    .where(eq(doctorHospitalAffiliations.doctorId, doctorId))
    .orderBy(desc(doctorHospitalAffiliations.isPrimary), asc(hospitals.name))
    .limit(100);

  return NextResponse.json({ data: rows });
}
