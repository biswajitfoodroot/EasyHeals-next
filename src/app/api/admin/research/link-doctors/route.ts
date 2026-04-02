/**
 * POST /api/admin/research/link-doctors — Batch-link doctors to a hospital
 *
 * Used after resolving an ambiguous hospital in batch save:
 * creates affiliations for all specified doctor IDs.
 *
 * Body: { hospitalId: string; doctorIds: string[] }
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const schema = z.object({
  hospitalId: z.string().uuid(),
  doctorIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "hospitalId (uuid) and doctorIds (uuid[]) required" }, { status: 400 });
  }

  const { hospitalId, doctorIds } = parsed.data;

  // Verify hospital exists
  const [hospital] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  let linked = 0;
  let skipped = 0;

  for (const doctorId of doctorIds) {
    // Verify doctor exists
    const [doctor] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (!doctor) { skipped++; continue; }

    // Check if affiliation already exists
    const [existing] = await db
      .select({ id: doctorHospitalAffiliations.id })
      .from(doctorHospitalAffiliations)
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, doctorId),
          eq(doctorHospitalAffiliations.hospitalId, hospitalId),
        ),
      )
      .limit(1);

    if (existing) { skipped++; continue; }

    await db.insert(doctorHospitalAffiliations).values({
      doctorId,
      hospitalId,
      role: "Consultant",
      isPrimary: true,
      source: "ai_research",
      isActive: true,
    });
    linked++;
  }

  return NextResponse.json({ data: { linked, skipped } });
}
