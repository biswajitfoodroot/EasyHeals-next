/**
 * GET  /api/v1/patients/vitals         — list vitals (most recent 90 days, max 100 rows)
 * POST /api/v1/patients/vitals         — add a vitals entry
 * DELETE /api/v1/patients/vitals/[id]  — remove one entry (in [id]/route.ts)
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientVitals } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const rows = await db
    .select()
    .from(patientVitals)
    .where(eq(patientVitals.patientId, patientId))
    .orderBy(desc(patientVitals.recordedDate))
    .limit(100);

  return NextResponse.json({ data: rows });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const body = await req.json().catch(() => null) as {
    recordedDate?: string;
    weight?: string;
    bp?: string;
    glucose?: string;
    pulse?: string;
    notes?: string;
  } | null;

  if (!body?.recordedDate) {
    return NextResponse.json({ error: "recordedDate is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const [row] = await db
    .insert(patientVitals)
    .values({
      patientId,
      recordedDate: body.recordedDate,
      weight:  body.weight?.trim()  || null,
      bp:      body.bp?.trim()      || null,
      glucose: body.glucose?.trim() || null,
      pulse:   body.pulse?.trim()   || null,
      notes:   body.notes?.trim()   || null,
    })
    .returning({ id: patientVitals.id });

  return NextResponse.json({ ok: true, id: row?.id });
});
