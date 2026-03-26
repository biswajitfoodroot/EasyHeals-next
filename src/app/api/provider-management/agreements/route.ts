import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { providerAgreements, hospitals, doctors } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator", "coordinator"];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return accepted agreements for dropdown use in commission entry form
  const rows = await db
    .select({
      id: providerAgreements.id,
      entityType: providerAgreements.entityType,
      tierCode: providerAgreements.tierCode,
      commissionPercent: providerAgreements.commissionPercent,
      commissionFlat: providerAgreements.commissionFlat,
      status: providerAgreements.status,
      hospitalName: hospitals.name,
      doctorName: doctors.fullName,
    })
    .from(providerAgreements)
    .leftJoin(hospitals, eq(hospitals.id, providerAgreements.hospitalId))
    .leftJoin(doctors, eq(doctors.id, providerAgreements.doctorId))
    .where(eq(providerAgreements.status, "accepted"))
    .orderBy(hospitals.name);

  return NextResponse.json({ data: rows });
}
