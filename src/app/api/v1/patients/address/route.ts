/**
 * GET/PUT /api/v1/patients/address
 *
 * Stores street, state, pincode, alternate phone.
 * Upsert pattern — one row per patient.
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientAddresses } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const [row] = await db
    .select()
    .from(patientAddresses)
    .where(eq(patientAddresses.patientId, patientId))
    .limit(1);

  return NextResponse.json({
    data: row ?? { patientId, street: null, state: null, pincode: null, altPhone: null },
  });
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const { patientId } = await requirePatientSession(req);

  const body = await req.json().catch(() => null) as {
    street?: string | null;
    state?: string | null;
    pincode?: string | null;
    altPhone?: string | null;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const values = {
    patientId,
    street:   body.street?.trim()   ?? null,
    state:    body.state?.trim()    ?? null,
    pincode:  body.pincode?.trim()  ?? null,
    altPhone: body.altPhone?.trim() ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(patientAddresses)
    .values({ id: crypto.randomUUID(), ...values })
    .onConflictDoUpdate({
      target: patientAddresses.patientId,
      set: { street: values.street, state: values.state, pincode: values.pincode, altPhone: values.altPhone, updatedAt: values.updatedAt },
    });

  return NextResponse.json({ ok: true });
});
