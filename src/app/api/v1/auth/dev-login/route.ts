/**
 * DEV-ONLY: Instant login bypass — available ONLY when NODE_ENV=development.
 * Creates a real patient session (no OTP required) for local testing.
 *
 * POST /api/v1/auth/dev-login
 * Body: { phone: string }
 *
 * This endpoint returns 404 in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { hashPhone } from "@/lib/security/encryption";
import { createPatientSession } from "@/lib/core/patient-session";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (process.env.NODE_ENV !== "development") {
    throw new AppError("AUTH_FORBIDDEN", "Not available", "Not available", 404);
  }

  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  const phoneRaw = (phone ?? "+910000000001").trim();
  const phoneHash = hashPhone(phoneRaw);

  // Find or create patient
  const existing = await db
    .select({ id: patients.id, deletedAt: patients.deletedAt })
    .from(patients)
    .where(eq(patients.phoneHash, phoneHash))
    .limit(1);

  let patientId: string;

  if (existing.length > 0 && !existing[0].deletedAt) {
    patientId = existing[0].id;
  } else {
    const [newPatient] = await db
      .insert(patients)
      .values({ phoneHash, city: "Mumbai" })
      .returning({ id: patients.id });
    patientId = newPatient.id;
  }

  const response = NextResponse.json({
    patientId,
    phone: phoneRaw,
    message: "[DEV] Session created without OTP",
  });

  await createPatientSession(
    { patientId, phoneHash, lang: "en", city: "Mumbai", consentPurposes: [] },
    response,
  );

  return response;
});
