/**
 * DELETE /api/v1/patients/family/[linkId] — Remove a family member link
 *
 * Only the primary patient who owns the link can delete it.
 * Deleting the link does NOT delete the family member's patient account.
 *
 * Auth: eh_patient_session cookie (requirePremiumAccess — Health Pro)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { patientFamilyLinks } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;
  const { linkId } = await params;

  if (!linkId) {
    return NextResponse.json({ error: "Link ID is required." }, { status: 400 });
  }

  // Only allow deletion if this patient is the primary patient for this link
  const result = await db
    .delete(patientFamilyLinks)
    .where(and(
      eq(patientFamilyLinks.id, linkId),
      eq(patientFamilyLinks.primaryPatientId, patientId),
    ));

  // Turso returns { rowsAffected }
  const affected = (result as unknown as { rowsAffected: number }).rowsAffected ?? 0;

  if (affected === 0) {
    return NextResponse.json({ error: "Family link not found or unauthorized." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
