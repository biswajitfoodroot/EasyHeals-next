/**
 * GET  /api/v1/patients/medications     — list active medications/reminders
 * POST /api/v1/patients/medications     — add a medication
 *
 * PATCH/DELETE in [id]/route.ts
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientMedications } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const rows = await db
    .select()
    .from(patientMedications)
    .where(eq(patientMedications.patientId, patientId))
    .orderBy(desc(patientMedications.createdAt));

  return NextResponse.json({ data: rows });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const body = await req.json().catch(() => null) as {
    name?: string;
    dosage?: string;
    frequency?: string;
    times?: string[];
    notes?: string;
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Medication name is required." }, { status: 400 });
  }

  const [row] = await db
    .insert(patientMedications)
    .values({
      patientId,
      name:      body.name.trim(),
      dosage:    body.dosage?.trim()    || null,
      frequency: body.frequency?.trim() || null,
      times:     Array.isArray(body.times) ? body.times : [],
      notes:     body.notes?.trim()     || null,
      isActive:  true,
    })
    .returning({ id: patientMedications.id });

  return NextResponse.json({ ok: true, id: row?.id });
});
