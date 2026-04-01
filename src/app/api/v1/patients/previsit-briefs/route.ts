/**
 * GET /api/v1/patients/previsit-briefs
 *
 * Returns decrypted pre-visit briefs for the authenticated patient.
 * Optionally filtered by appointmentId.
 *
 * Auth:  eh_patient_session cookie
 * Flag:  previsit_brief (returns 423 if OFF)
 *
 * Query params:
 *   appointmentId — filter to a specific appointment (optional)
 *   limit         — max results (default 10, max 50)
 */

import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { previsitBriefs } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { decryptPHI } from "@/lib/health/encryption";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const blocked = await requireFeatureFlag("previsit_brief");
  if (blocked) return blocked;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const url = new URL(req.url);
  const appointmentId = url.searchParams.get("appointmentId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10), 50);

  const conditions = [eq(previsitBriefs.patientId, patientId)];
  if (appointmentId) conditions.push(eq(previsitBriefs.appointmentId, appointmentId));

  const rows = await db
    .select({
      id: previsitBriefs.id,
      appointmentId: previsitBriefs.appointmentId,
      doctorId: previsitBriefs.doctorId,
      briefEncrypted: previsitBriefs.briefEncrypted,
      generatedAt: previsitBriefs.generatedAt,
      viewedAt: previsitBriefs.viewedAt,
    })
    .from(previsitBriefs)
    .where(and(...conditions))
    .orderBy(desc(previsitBriefs.generatedAt))
    .limit(limit);

  const briefs = rows.map((row) => {
    let brief: Record<string, unknown> = {};
    try { brief = decryptPHI<Record<string, unknown>>(row.briefEncrypted); }
    catch { /* return empty brief on decryption failure */ }

    return {
      id: row.id,
      appointmentId: row.appointmentId,
      doctorId: row.doctorId,
      generatedAt: row.generatedAt,
      viewedAt: row.viewedAt,
      brief,
    };
  });

  return NextResponse.json({ data: briefs });
});
