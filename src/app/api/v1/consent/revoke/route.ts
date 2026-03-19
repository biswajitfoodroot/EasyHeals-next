/**
 * Consent Revoke Endpoint
 *
 * POST /api/v1/consent/revoke
 * Body: { purpose: string }
 * Auth: requires valid eh_patient_session cookie
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { redisGet } from "@/lib/core/redis";
import { revokeConsent } from "@/lib/security/consent";

const revokeSchema = z.object({
  purpose: z.string().min(1),
});

interface PatientSession {
  patientId: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) {
    throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await redisGet<PatientSession>(`patient:session:${tokenHash}`);
  if (!session) {
    throw new AppError("AUTH_SESSION_EXPIRED", "Session expired", "Your session has expired.", 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = revokeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Invalid purpose", 400);
  }

  await revokeConsent(session.patientId, parsed.data.purpose);

  return NextResponse.json({ message: "Consent revoked", purpose: parsed.data.purpose });
});
