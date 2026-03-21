/**
 * GET/PUT /api/v1/patients/health-profile
 *
 * Stores height, weight, blood group, medical conditions, allergies.
 * Upsert pattern — one row per patient.
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientHealthProfiles } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const [row] = await db
    .select()
    .from(patientHealthProfiles)
    .where(eq(patientHealthProfiles.patientId, patientId))
    .limit(1);

  return NextResponse.json({
    data: row ?? { patientId, height: null, weight: null, bloodGroup: null, conditions: null, allergies: null },
  });
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const body = await req.json().catch(() => null) as {
    height?: string | null;
    weight?: string | null;
    bloodGroup?: string | null;
    conditions?: string | null;
    allergies?: string | null;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const values = {
    patientId,
    height:     body.height?.trim()     ?? null,
    weight:     body.weight?.trim()     ?? null,
    bloodGroup: body.bloodGroup?.trim() ?? null,
    conditions: body.conditions?.trim() ?? null,
    allergies:  body.allergies?.trim()  ?? null,
    updatedAt:  new Date(),
  };

  await db
    .insert(patientHealthProfiles)
    .values({ id: crypto.randomUUID(), ...values })
    .onConflictDoUpdate({
      target: patientHealthProfiles.patientId,
      set: { height: values.height, weight: values.weight, bloodGroup: values.bloodGroup, conditions: values.conditions, allergies: values.allergies, updatedAt: values.updatedAt },
    });

  return NextResponse.json({ ok: true });
});
