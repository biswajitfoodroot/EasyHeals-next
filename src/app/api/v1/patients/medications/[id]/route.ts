/**
 * PATCH  /api/v1/patients/medications/[id] — update or toggle active status
 * DELETE /api/v1/patients/medications/[id] — hard delete
 *
 * Auth: eh_patient_session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientMedications } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { patientId } = await requirePatientSession(req);
  const { id } = await params;

  const body = await req.json().catch(() => null) as {
    name?: string; dosage?: string; frequency?: string;
    times?: string[]; notes?: string; isActive?: boolean;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name      !== undefined) set.name      = body.name.trim();
  if (body.dosage    !== undefined) set.dosage    = body.dosage?.trim() || null;
  if (body.frequency !== undefined) set.frequency = body.frequency?.trim() || null;
  if (body.times     !== undefined) set.times     = Array.isArray(body.times) ? body.times : [];
  if (body.notes     !== undefined) set.notes     = body.notes?.trim() || null;
  if (body.isActive  !== undefined) set.isActive  = body.isActive;

  await db.update(patientMedications).set(set)
    .where(and(eq(patientMedications.id, id), eq(patientMedications.patientId, patientId)));

  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { patientId } = await requirePatientSession(req);
  const { id } = await params;

  await db.delete(patientMedications)
    .where(and(eq(patientMedications.id, id), eq(patientMedications.patientId, patientId)));

  return NextResponse.json({ ok: true });
});
