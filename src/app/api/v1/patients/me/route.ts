/**
 * Patient Privacy Endpoints (Task 3.11)
 *
 * GET    /api/v1/patients/me  → consent records + lead count
 * DELETE /api/v1/patients/me  → soft-delete (DPDP right to erasure)
 *
 * Auth: requires valid eh_patient_session cookie → Redis lookup
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, count } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "@/db/client";
import { patients, consentRecords, leads } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { redisDel } from "@/lib/core/redis";
import { requirePatientSession, PATIENT_COOKIE } from "@/lib/core/patient-session";

// ── GET /api/v1/patients/me ───────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Fetch patient details
  const patientRows = await db
    .select({ id: patients.id, city: patients.city, createdAt: patients.createdAt })
    .from(patients)
    .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)))
    .limit(1);

  if (!patientRows.length) {
    throw new AppError("DB_NOT_FOUND", "Patient not found", "Patient record not found.", 404);
  }

  // Fetch active consent records
  const consents = await db
    .select({
      id: consentRecords.id,
      purpose: consentRecords.purpose,
      version: consentRecords.version,
      grantedAt: consentRecords.grantedAt,
      revokedAt: consentRecords.revokedAt,
      channel: consentRecords.channel,
    })
    .from(consentRecords)
    .where(eq(consentRecords.patientId, patientId))
    .orderBy(consentRecords.grantedAt);

  // Count leads
  const leadCountRows = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.patientId, patientId));

  const leadCount = leadCountRows[0]?.total ?? 0;

  return NextResponse.json({
    patient: {
      id: patientRows[0].id,
      city: patientRows[0].city,
      memberSince: patientRows[0].createdAt,
    },
    consents: consents.map((c) => ({
      ...c,
      active: !c.revokedAt,
    })),
    stats: {
      totalLeads: leadCount,
    },
  });
});

// ── DELETE /api/v1/patients/me ────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Soft-delete: set deletedAt = now()
  // Hard purge happens via cron after 30 days (DPDP §9 G10)
  await db
    .update(patients)
    .set({ deletedAt: new Date() })
    .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)));

  // Revoke all active consents
  await db
    .update(consentRecords)
    .set({ revokedAt: new Date() })
    .where(and(eq(consentRecords.patientId, patientId), isNull(consentRecords.revokedAt)));

  // Invalidate session (Redis + DB fallback)
  const rawToken = req.cookies.get(PATIENT_COOKIE)?.value ?? "";
  if (rawToken) {
    const hash = createHash("sha256").update(rawToken).digest("hex");
    await redisDel(`patient:session:${hash}`);
  }

  // Clear cookie
  const response = NextResponse.json({
    message: "Account deletion requested. Your data will be permanently removed within 30 days.",
    deletedAt: new Date().toISOString(),
  });
  response.cookies.set(PATIENT_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
});
