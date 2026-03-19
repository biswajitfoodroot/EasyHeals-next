/**
 * POST /api/v1/emr/vitals  — record patient vitals (doctor or patient self-report)
 * GET  /api/v1/emr/vitals  — patient reads own vitals history
 *
 * P3 Day 2 — EMR Lite.
 *
 * POST auth:  eh_patient_session (self-report) OR admin/doctor (staff-recorded)
 * GET auth:   eh_patient_session cookie (OTP-verified)
 * Gate:       emr_lite feature flag must be ON
 * DPDP:       consent purpose "emr_access" required
 *
 * Vitals are NOT individually encrypted (numeric fields without patient linkage
 * have no PHI sensitivity), but live in the PHI-isolated Neon DB because
 * they are linked to patient_id.
 */

import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { requireConsent } from "@/lib/security/consent";
import { redisGet } from "@/lib/core/redis";

// EMR module (isolated — ARCHITECTURE.md §A.2)
import { emrDb, vitals } from "@/lib/emr";

// ── Patient session helper ────────────────────────────────────────────────────

interface PatientSession {
  patientId: string;
  phoneHash: string;
}

async function getPatientSession(req: NextRequest): Promise<PatientSession | null> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) return null;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return await redisGet<PatientSession>(`patient:session:${tokenHash}`);
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createVitalsSchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  recordedBy: z.enum(["patient", "doctor", "nurse"]).default("patient"),
  // All vital signs optional — not every reading captures all vitals
  bloodPressureSystolic: z.number().int().min(40).max(300).optional(),
  bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
  heartRateBpm: z.number().int().min(20).max(300).optional(),
  weightKg: z.number().min(0.5).max(500).optional(),
  heightCm: z.number().min(30).max(300).optional(),
  bloodSugarMgDl: z.number().min(10).max(2000).optional(),
  bloodSugarType: z.enum(["fasting", "post_meal", "random"]).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  temperatureCelsius: z.number().min(25).max(45).optional(),
  recordedAt: z.string().datetime().optional(),
}).refine(
  (data) => {
    // Must have at least one vital sign
    const vitalFields = [
      "bloodPressureSystolic", "bloodPressureDiastolic", "heartRateBpm",
      "weightKg", "heightCm", "bloodSugarMgDl", "oxygenSaturation", "temperatureCelsius",
    ] as const;
    return vitalFields.some((f) => data[f] !== undefined);
  },
  { message: "At least one vital sign must be provided" },
);

// ── POST /api/v1/emr/vitals ───────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = createVitalsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const data = parsed.data;

  // Auth — accept either patient session (self-report) or staff session
  const patientSession = await getPatientSession(req);
  let actorId: string;
  let recordedBy: "patient" | "doctor" | "nurse" = data.recordedBy;

  if (patientSession) {
    // Patient self-report: enforce patientId matches session
    if (patientSession.patientId !== data.patientId) {
      throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only record your own vitals.", 403);
    }
    actorId = patientSession.patientId;
    recordedBy = "patient";
  } else {
    // Try staff auth
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!["owner", "admin", "advisor", "doctor"].includes(auth.role)) {
      throw new AppError("AUTH_FORBIDDEN", "Forbidden", "Insufficient permissions.", 403);
    }
    actorId = auth.entityId ?? auth.userId;
  }

  // Consent gate
  try {
    await requireConsent(data.patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "Patient has not granted EMR access consent.", 403);
  }

  const [vital] = await emrDb
    .insert(vitals)
    .values({
      patientId: data.patientId,
      visitId: data.visitId ?? null,
      recordedBy,
      recordedById: actorId,
      bloodPressureSystolic: data.bloodPressureSystolic ?? null,
      bloodPressureDiastolic: data.bloodPressureDiastolic ?? null,
      heartRateBpm: data.heartRateBpm ?? null,
      weightKg: data.weightKg ?? null,
      heightCm: data.heightCm ?? null,
      bloodSugarMgDl: data.bloodSugarMgDl ?? null,
      bloodSugarType: data.bloodSugarType ?? null,
      oxygenSaturation: data.oxygenSaturation ?? null,
      temperatureCelsius: data.temperatureCelsius ?? null,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
    })
    .returning({ id: vitals.id, recordedAt: vitals.recordedAt });

  return NextResponse.json({
    data: {
      vitalId: vital.id,
      patientId: data.patientId,
      recordedBy,
      recordedAt: vital.recordedAt,
    },
  }, { status: 201 });
});

// ── GET /api/v1/emr/vitals — patient reads own vitals history ─────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("emr_lite")) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR not available", "EMR Lite is not yet enabled.", 503);
  }

  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const patientSession = await getPatientSession(req);
  if (!patientSession) {
    throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  }

  const { patientId } = patientSession;

  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "You must grant EMR access consent to view your vitals.", 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10), 100);

  const rows = await emrDb
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(limit);

  // Compute BMI where height + weight are both available
  const result = rows.map((row) => {
    let bmi: number | null = null;
    if (row.weightKg && row.heightCm && row.heightCm > 0) {
      const heightM = row.heightCm / 100;
      bmi = Math.round((row.weightKg / (heightM * heightM)) * 10) / 10;
    }

    return {
      id: row.id,
      visitId: row.visitId,
      recordedBy: row.recordedBy,
      bloodPressure: (row.bloodPressureSystolic && row.bloodPressureDiastolic)
        ? { systolic: row.bloodPressureSystolic, diastolic: row.bloodPressureDiastolic }
        : null,
      heartRateBpm: row.heartRateBpm,
      weightKg: row.weightKg,
      heightCm: row.heightCm,
      bmi,
      bloodSugar: row.bloodSugarMgDl
        ? { mgDl: row.bloodSugarMgDl, type: row.bloodSugarType }
        : null,
      oxygenSaturation: row.oxygenSaturation,
      temperatureCelsius: row.temperatureCelsius,
      recordedAt: row.recordedAt,
    };
  });

  return NextResponse.json({ data: result, total: result.length });
});
