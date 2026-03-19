/**
 * POST /api/v1/emr/visits  — doctor creates a visit record
 * GET  /api/v1/emr/visits  — patient reads own visit history
 *
 * P3 Day 2 — EMR Lite (ARCHITECTURE.md §A.1).
 *
 * POST auth:  admin/owner/advisor OR doctor (own patients only)
 * GET auth:   eh_patient_session cookie (OTP-verified)
 * Gate:       emr_lite feature flag must be ON
 * DPDP:       consent purpose "emr_access" required for both read and write
 * PHI:        diagnosis, chiefComplaint, notes stored AES-256-GCM encrypted
 *
 * ISOLATION NOTE: Only imports from src/lib/emr, src/db/*, and shared infra.
 *                 Must NOT create cross-imports that violate §A.2.
 */

import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { requireConsent } from "@/lib/security/consent";
import { redisGet } from "@/lib/core/redis";

// EMR module (isolated — ARCHITECTURE.md §A.2)
import { emrDb, visitRecords, emrEncryptSafe, emrDecryptSafe } from "@/lib/emr";

// ── Patient session helper ────────────────────────────────────────────────────

interface PatientSession {
  patientId: string;
  phoneHash: string;
}

async function requirePatientSession(req: NextRequest): Promise<PatientSession> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) {
    throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  }
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
  if (!session) {
    throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired. Please verify your phone again.", 401);
  }
  return session;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createVisitSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  hospitalId: z.string().uuid().optional(),
  diagnosis: z.array(z.object({
    code: z.string().max(20).optional(),   // ICD-10 code e.g. "J06.9"
    label: z.string().max(200),            // human-readable label
  })).max(20).optional(),
  chiefComplaint: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  followUpDate: z.string().datetime().optional(),
  followUpNotes: z.string().max(1000).optional(),
  isTeleconsultation: z.boolean().default(false),
});

// ── POST /api/v1/emr/visits ───────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  // DB availability check
  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  // Auth — doctor or admin/owner/advisor
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = createVisitSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const {
    patientId,
    appointmentId,
    hospitalId,
    diagnosis,
    chiefComplaint,
    notes,
    followUpDate,
    followUpNotes,
    isTeleconsultation,
  } = parsed.data;

  // If doctor role, verify they are linked to an entity
  let doctorId: string | null = null;
  if (auth.role === "doctor") {
    if (!auth.entityId) {
      throw new AppError("DB_NOT_FOUND", "No linked doctor", "Your account is not linked to a doctor profile.", 400);
    }
    doctorId = auth.entityId;
  }

  // Consent gate — emr_access required (DPDP Act 2023)
  let consentRecordId: string;
  try {
    consentRecordId = await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "Patient has not granted EMR access consent.", 403);
  }

  // Encrypt PHI fields
  const diagnosisEncrypted = diagnosis ? emrEncryptSafe(JSON.stringify(diagnosis)) : null;
  const chiefComplaintEncrypted = chiefComplaint ? emrEncryptSafe(chiefComplaint) : null;
  const notesEncrypted = notes ? emrEncryptSafe(notes) : null;

  // Insert visit record
  const [visit] = await emrDb
    .insert(visitRecords)
    .values({
      patientId,
      doctorId,
      hospitalId: hospitalId ?? null,
      appointmentId: appointmentId ?? null,
      diagnosisEncrypted,
      chiefComplaintEncrypted,
      notesEncrypted,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      followUpNotes: followUpNotes ?? null,
      isTeleconsultation,
    })
    .returning({ id: visitRecords.id, createdAt: visitRecords.createdAt });

  return NextResponse.json({
    data: {
      visitId: visit.id,
      patientId,
      doctorId,
      isTeleconsultation,
      createdAt: visit.createdAt,
    },
  }, { status: 201 });
});

// ── GET /api/v1/emr/visits — patient reads own visit history ──────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Consent gate — emr_access required
  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "You must grant EMR access consent to view your medical records.", 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);

  const rows = await emrDb
    .select()
    .from(visitRecords)
    .where(eq(visitRecords.patientId, patientId))
    .orderBy(desc(visitRecords.createdAt))
    .limit(limit);

  // Decrypt PHI for response
  const visits = rows.map((row) => ({
    id: row.id,
    appointmentId: row.appointmentId,
    doctorId: row.doctorId,
    hospitalId: row.hospitalId,
    diagnosis: row.diagnosisEncrypted ? (() => {
      try { return JSON.parse(emrDecryptSafe(row.diagnosisEncrypted!) ?? "null"); }
      catch { return null; }
    })() : null,
    chiefComplaint: row.chiefComplaintEncrypted ? emrDecryptSafe(row.chiefComplaintEncrypted) : null,
    notes: row.notesEncrypted ? emrDecryptSafe(row.notesEncrypted) : null,
    followUpDate: row.followUpDate,
    followUpNotes: row.followUpNotes,
    isTeleconsultation: row.isTeleconsultation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return NextResponse.json({ data: visits, total: visits.length });
});
