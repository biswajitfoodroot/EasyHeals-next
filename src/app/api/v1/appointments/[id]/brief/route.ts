/**
 * GET /api/v1/appointments/[id]/brief — Patient fetches pre-visit brief for their appointment
 *
 * Auth: eh_patient_session cookie
 * Returns decrypted brief data if exists, 404 if not yet generated.
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { previsitBriefs, appointments } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { decryptPHI } from "@/lib/health/encryption";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: appointmentId } = await params;
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Verify appointment belongs to patient
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.patientId, patientId)))
    .limit(1);

  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const [brief] = await db
    .select()
    .from(previsitBriefs)
    .where(eq(previsitBriefs.appointmentId, appointmentId))
    .limit(1);

  if (!brief) {
    return NextResponse.json({ error: "No brief generated yet" }, { status: 404 });
  }

  let briefData: Record<string, unknown> = {};
  try {
    briefData = decryptPHI<Record<string, unknown>>(brief.briefEncrypted);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt brief" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: brief.id,
      appointmentId: brief.appointmentId,
      generatedAt: brief.generatedAt,
      viewedAt: brief.viewedAt,
      brief: briefData,
    },
  });
});
