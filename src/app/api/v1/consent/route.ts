import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consentRecords, patients } from "@/db/schema";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { hashDeviceFp } from "@/lib/security/encryption";
import { checkDuplicateConsent } from "@/lib/security/consent";

const consentSchema = z.object({
  patientId: z.string().uuid(),
  purposes: z.array(z.string()).min(1),
  version: z.string().default("1.0"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    throw new AppError("SYS_UNHANDLED", "Invalid request body", "Invalid request body", 400);
  }

  const parsed = consentSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("CONSENT_PURPOSE_MISMATCH", "Invalid consent payload", "Invalid consent payload", 400);
  }

  const { patientId, purposes, version } = parsed.data;

  // TODO(security): patientId currently comes from the request body (client-controlled).
  // Once OTP-based patient sessions are implemented (Phase 2), this must be derived
  // from the verified session token instead of trusting the caller.

  // Validate patient exists
  const p = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!p.length) {
    throw new AppError("DB_NOT_FOUND", "Patient not found", "Patient not found", 404);
  }

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const ipHash = hashDeviceFp(ip);
  const ua = req.headers.get("user-agent") ?? "";
  const userAgentHash = ua ? hashDeviceFp(ua) : null;

  const consentIds: string[] = [];
  const grantedAt = new Date();

  for (const purpose of purposes) {
    // Idempotent: if active consent already exists, return existing record
    const existingId = await checkDuplicateConsent(patientId, purpose);
    if (existingId) {
      consentIds.push(existingId);
      continue;
    }

    const [record] = await db.insert(consentRecords).values({
      patientId,
      purpose,
      version,
      granted: true,
      grantedAt,
      channel: "web",
      ipHash,
      userAgentHash,
      legalBasis: "dpdp_consent"
    }).returning({ id: consentRecords.id });

    consentIds.push(record.id);
  }

  return NextResponse.json({
    consentIds,
    grantedAt: grantedAt.toISOString()
  });
});
