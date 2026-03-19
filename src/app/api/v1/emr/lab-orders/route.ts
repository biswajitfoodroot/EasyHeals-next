/**
 * POST /api/v1/emr/lab-orders  — doctor creates a lab test order
 * GET  /api/v1/emr/lab-orders  — patient reads own lab orders
 *
 * P3 Day 4 — Lab Test Ordering (PLAN.md §P3 EMR + Clinical).
 *
 * POST auth:  admin/owner/advisor OR doctor
 * GET auth:   eh_patient_session cookie (OTP-verified)
 * Gate:       lab_test_ordering feature flag must be ON
 * DPDP:       consent purpose "emr_access" required
 *
 * Lab order lifecycle:
 *   ordered → sample_collected → processing → completed | cancelled
 *
 * Result upload is via PATCH /api/v1/emr/lab-orders/:id/result (separate route).
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
import { emrDb, labOrders } from "@/lib/emr";

// ── Patient session helper ────────────────────────────────────────────────────

interface PatientSession { patientId: string; phoneHash: string; }

async function requirePatientSession(req: NextRequest): Promise<PatientSession> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
  if (!session) throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired. Please verify your phone again.", 401);
  return session;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const labTestSchema = z.object({
  testName: z.string().min(1).max(200),
  testCode: z.string().max(50).optional(),  // LOINC / lab internal code
  notes: z.string().max(500).optional(),
});

const createLabOrderSchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  hospitalId: z.string().uuid().optional(),
  tests: z.array(labTestSchema).min(1).max(30),
  labName: z.string().max(200).optional(),
  urgency: z.enum(["routine", "urgent", "stat"]).default("routine"),
});

// ── POST /api/v1/emr/lab-orders ───────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("lab_test_ordering")) {
    throw new AppError("SYS_CONFIG_MISSING", "Lab ordering not available", "Lab test ordering is not yet enabled.", 503);
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

  const parsed = createLabOrderSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { patientId, visitId, hospitalId, tests, labName, urgency } = parsed.data;

  const doctorId = auth.role === "doctor" ? (auth.entityId ?? null) : null;
  if (auth.role === "doctor" && !auth.entityId) {
    throw new AppError("DB_NOT_FOUND", "No linked doctor", "Your account is not linked to a doctor profile.", 400);
  }

  // Consent gate (DPDP)
  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "Patient has not granted EMR access consent.", 403);
  }

  const [order] = await emrDb
    .insert(labOrders)
    .values({
      patientId,
      doctorId,
      hospitalId: hospitalId ?? null,
      visitId: visitId ?? null,
      tests,
      labName: labName ?? null,
      status: "ordered",
    })
    .returning({ id: labOrders.id, orderedAt: labOrders.orderedAt });

  return NextResponse.json({
    data: {
      orderId: order.id,
      patientId,
      doctorId,
      testCount: tests.length,
      labName: labName ?? null,
      urgency,
      status: "ordered",
      orderedAt: order.orderedAt,
    },
  }, { status: 201 });
});

// ── GET /api/v1/emr/lab-orders — patient reads own orders ─────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  if (!await getFeatureFlag("lab_test_ordering")) {
    throw new AppError("SYS_CONFIG_MISSING", "Lab ordering not available", "Lab test ordering is not yet enabled.", 503);
  }
  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  try {
    await requireConsent(patientId, "emr_access");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required", "You must grant EMR access consent to view your lab orders.", 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const status = url.searchParams.get("status") ?? undefined;

  const rows = await emrDb
    .select()
    .from(labOrders)
    .where(eq(labOrders.patientId, patientId))
    .orderBy(desc(labOrders.orderedAt))
    .limit(limit);

  const result = rows
    .filter((r) => !status || r.status === status)
    .map((r) => ({
      id: r.id,
      visitId: r.visitId,
      doctorId: r.doctorId,
      hospitalId: r.hospitalId,
      tests: r.tests,
      labName: r.labName,
      status: r.status,
      resultUrl: r.resultUrl,
      resultUploadedAt: r.resultUploadedAt,
      orderedAt: r.orderedAt,
    }));

  return NextResponse.json({ data: result, total: result.length });
});
