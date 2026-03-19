/**
 * POST /api/v1/emr/prescriptions  — doctor creates a prescription
 * GET  /api/v1/emr/prescriptions  — patient reads own prescriptions
 *
 * P3 Day 2 — EMR Lite.
 *
 * POST auth:  admin/owner/advisor OR doctor (own patients only)
 * GET auth:   eh_patient_session cookie (OTP-verified)
 * Gate:       emr_lite feature flag must be ON
 * DPDP:       consent purpose "emr_access" required
 * PHI:        medicines array and instructions stored AES-256-GCM encrypted
 *
 * Prescription feeds P5 pharmacy routing via pharmacyId + medicines[].genericName.
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
import { emrDb, prescriptions, emrEncryptSafe, emrDecryptSafe } from "@/lib/emr";
import type { Medicine } from "@/db/emr-schema";

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

const medicineSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100),
  frequency: z.string().max(100),
  duration: z.string().max(100),
  instructions: z.string().max(500).optional(),
  genericName: z.string().max(200).optional(),
});

const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  hospitalId: z.string().uuid().optional(),
  medicines: z.array(medicineSchema).min(1).max(50),
  instructions: z.string().max(2000).optional(),
  validUntil: z.string().datetime().optional(),
  pharmacyId: z.string().uuid().optional(),
});

// ── POST /api/v1/emr/prescriptions ───────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = createPrescriptionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const {
    patientId,
    visitId,
    hospitalId,
    medicines,
    instructions,
    validUntil,
    pharmacyId,
  } = parsed.data;

  let doctorId: string | null = null;
  if (auth.role === "doctor") {
    if (!auth.entityId) {
      throw new AppError("DB_NOT_FOUND", "No linked doctor", "Your account is not linked to a doctor profile.", 400);
    }
    doctorId = auth.entityId;
  }

  // Consent gate
  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "Patient has not granted EMR access consent.", 403);
  }

  // Encrypt PHI
  const medicinesEncrypted = emrEncryptSafe(JSON.stringify(medicines as Medicine[]));
  const instructionsEncrypted = instructions ? emrEncryptSafe(instructions) : null;

  const [rx] = await emrDb
    .insert(prescriptions)
    .values({
      patientId,
      doctorId,
      hospitalId: hospitalId ?? null,
      visitId: visitId ?? null,
      medicinesEncrypted,
      instructionsEncrypted,
      validUntil: validUntil ? new Date(validUntil) : null,
      pharmacyId: pharmacyId ?? null,
    })
    .returning({ id: prescriptions.id, createdAt: prescriptions.createdAt });

  return NextResponse.json({
    data: {
      prescriptionId: rx.id,
      patientId,
      doctorId,
      visitId: visitId ?? null,
      medicineCount: medicines.length,
      validUntil: validUntil ?? null,
      createdAt: rx.createdAt,
    },
  }, { status: 201 });
});

// ── GET /api/v1/emr/prescriptions — patient reads own prescriptions ────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "You must grant EMR access consent to view your prescriptions.", 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const visitId = url.searchParams.get("visitId") ?? undefined;

  const query = emrDb
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.patientId, patientId))
    .orderBy(desc(prescriptions.createdAt))
    .limit(limit);

  const rows = await query;

  const result = rows
    .filter((row) => !visitId || row.visitId === visitId)
    .map((row) => {
      let medicines: Medicine[] | null = null;
      try {
        const raw = row.medicinesEncrypted ? emrDecryptSafe(row.medicinesEncrypted) : null;
        medicines = raw ? JSON.parse(raw) : null;
      } catch {
        medicines = null;
      }

      let instructionsPlain: string | null = null;
      try {
        instructionsPlain = row.instructionsEncrypted ? emrDecryptSafe(row.instructionsEncrypted) : null;
      } catch {
        instructionsPlain = null;
      }

      return {
        id: row.id,
        visitId: row.visitId,
        doctorId: row.doctorId,
        hospitalId: row.hospitalId,
        medicines,
        instructions: instructionsPlain,
        validUntil: row.validUntil,
        dispensed: row.dispensed,
        dispensedAt: row.dispensedAt,
        pharmacyId: row.pharmacyId,
        createdAt: row.createdAt,
      };
    });

  return NextResponse.json({ data: result, total: result.length });
});
