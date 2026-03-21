/**
 * DELETE /api/v1/patients/vitals/[id] — delete a vitals entry
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientVitals } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { patientId } = await requirePatientSession(req);
  const { id } = await params;

  await db.delete(patientVitals)
    .where(and(eq(patientVitals.id, id), eq(patientVitals.patientId, patientId)));

  return NextResponse.json({ ok: true });
});
