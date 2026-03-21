/**
 * Patient Privacy Endpoints (Task 3.11)
 *
 * GET    /api/v1/patients/me  → patient details, consent records + lead count
 * PATCH  /api/v1/patients/me  → update displayAlias and/or city
 * DELETE /api/v1/patients/me  → soft-delete (DPDP right to erasure)
 *
 * Auth: requires valid eh_patient_session cookie → Redis lookup
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, count } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "@/db/client";
import { patients, consentRecords, leads } from "@/db/schema";
import { decryptPhone } from "@/lib/security/encryption";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { redisDel } from "@/lib/core/redis";
import { requirePatientSession, PATIENT_COOKIE } from "@/lib/core/patient-session";

// ── GET /api/v1/patients/me ───────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Fetch patient details
  const patientRows = await db
    .select({ id: patients.id, city: patients.city, createdAt: patients.createdAt, googleName: patients.googleName, displayAlias: patients.displayAlias, phoneEncrypted: patients.phoneEncrypted })
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

  // Decrypt phone for display — graceful fallback if key not configured
  let phone: string | null = null;
  try {
    if (patientRows[0].phoneEncrypted) phone = decryptPhone(patientRows[0].phoneEncrypted);
  } catch { /* encryption key may not be set in dev */ }

  return NextResponse.json({
    patient: {
      id: patientRows[0].id,
      city: patientRows[0].city,
      memberSince: patientRows[0].createdAt,
      googleName: patientRows[0].googleName,
      displayAlias: patientRows[0].displayAlias,
      name: patientRows[0].displayAlias ?? patientRows[0].googleName,
      phone,
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

// ── PATCH /api/v1/patients/me ─────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as { displayAlias?: string | null; city?: string | null } | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const updateSet: Record<string, unknown> = {};
  if ("displayAlias" in body) updateSet.displayAlias = body.displayAlias?.trim() || null;
  if ("city" in body) updateSet.city = body.city?.trim() || null;

  if (Object.keys(updateSet).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db.update(patients).set(updateSet).where(and(eq(patients.id, patientId), isNull(patients.deletedAt)));
  return NextResponse.json({ ok: true });
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
