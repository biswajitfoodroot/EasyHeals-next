/**
 * POST /api/admin/affiliations/merge
 * Merges a duplicate doctor record into the canonical one.
 *
 * Body: { keepId: string, deleteId: string }
 * - All affiliations pointing to deleteId are re-pointed to keepId
 *   (unless keepId already has an affiliation with that hospital — then the dupe is deleted)
 * - deleteId doctor record is marked isActive=false with name prefixed "[MERGED]"
 *
 * Only owner/admin can perform merges.
 */
import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const mergeSchema = z.object({
  keepId: z.string().min(1),
  deleteId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json() as unknown;
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { keepId, deleteId } = parsed.data;

  if (keepId === deleteId) {
    return NextResponse.json({ error: "keepId and deleteId must be different" }, { status: 400 });
  }

  // Verify both doctors exist
  const [keepDoc] = await db.select({ id: doctors.id, fullName: doctors.fullName })
    .from(doctors).where(eq(doctors.id, keepId)).limit(1);
  if (!keepDoc) return NextResponse.json({ error: "Keep doctor not found" }, { status: 404 });

  const [deleteDoc] = await db.select({ id: doctors.id, fullName: doctors.fullName })
    .from(doctors).where(eq(doctors.id, deleteId)).limit(1);
  if (!deleteDoc) return NextResponse.json({ error: "Delete doctor not found" }, { status: 404 });

  // Get all affiliations of the duplicate (deleteId)
  const dupeAffiliations = await db
    .select({ id: doctorHospitalAffiliations.id, hospitalId: doctorHospitalAffiliations.hospitalId })
    .from(doctorHospitalAffiliations)
    .where(eq(doctorHospitalAffiliations.doctorId, deleteId));

  let repointed = 0;
  let removed = 0;

  for (const aff of dupeAffiliations) {
    // Check if keepId already has an affiliation with this hospital
    const [existing] = await db
      .select({ id: doctorHospitalAffiliations.id })
      .from(doctorHospitalAffiliations)
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, keepId),
          eq(doctorHospitalAffiliations.hospitalId, aff.hospitalId),
        ),
      )
      .limit(1);

    if (existing) {
      // keepId already affiliated with this hospital — delete the dupe's affiliation
      await db.delete(doctorHospitalAffiliations).where(eq(doctorHospitalAffiliations.id, aff.id));
      removed++;
    } else {
      // Re-point the affiliation to keepId
      await db.update(doctorHospitalAffiliations)
        .set({ doctorId: keepId, updatedAt: new Date() })
        .where(eq(doctorHospitalAffiliations.id, aff.id));
      repointed++;
    }
  }

  // Mark duplicate doctor as inactive so it disappears from all views
  await db.update(doctors).set({
    isActive: false,
    fullName: `[MERGED] ${deleteDoc.fullName}`,
    updatedAt: new Date(),
  }).where(eq(doctors.id, deleteId));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "admin.doctor.merge",
    entityType: "doctor",
    entityId: keepId,
    changes: {
      mergedFromId: deleteId,
      mergedFromName: deleteDoc.fullName,
      affiliationsRepointed: repointed,
      affiliationsRemoved: removed,
    },
  });

  return NextResponse.json({
    ok: true,
    keepId,
    deleteId,
    affiliationsRepointed: repointed,
    affiliationsRemoved: removed,
  });
}
