/**
 * POST /api/v1/auth/google — Patient Google Sign-In
 *
 * Verifies a Google ID token from the client (Google Identity Services).
 * Upserts a patient record by googleId, creates a patient session.
 *
 * For Google-only patients (no OTP phone): a synthetic phoneHash is derived
 * from the Google sub so the NOT NULL constraint is satisfied. The phoneHash
 * is prefixed "google:" to prevent collision with real phone hashes.
 *
 * Body: { idToken: string }
 * Response: { patientId, name, email, avatar }
 */

import { createHash } from "crypto";
import { eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { createPatientSession } from "@/lib/core/patient-session";

const bodySchema = z.object({ idToken: z.string().min(10) });

interface GoogleTokenInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: string;
  aud: string;
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenInfo | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleTokenInfo & { error?: string };
    if (data.error) return null;

    // Validate audience matches our client ID
    const expectedAud = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (expectedAud && data.aud !== expectedAud) return null;

    return data;
  } catch {
    return null;
  }
}

/** Deterministic phoneHash for Google-only patients (no phone number). */
function googlePhoneHash(sub: string): string {
  return createHash("sha256").update(`google:${sub}`).digest("hex");
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);
  }

  const info = await verifyGoogleToken(parsed.data.idToken);
  if (!info || info.email_verified !== "true") {
    throw new AppError("AUTH_INVALID_TOKEN", "Bad Google token", "Invalid or unverified Google account.", 401);
  }

  const { sub, email, name, picture } = info;
  const syntheticPhoneHash = googlePhoneHash(sub);

  // Try to find existing patient by googleId first, then by synthetic phoneHash
  const existing = await db
    .select({ id: patients.id, deletedAt: patients.deletedAt, phoneHash: patients.phoneHash })
    .from(patients)
    .where(or(eq(patients.googleId, sub), eq(patients.phoneHash, syntheticPhoneHash)))
    .limit(1);

  let patientId: string;

  if (existing.length > 0) {
    const row = existing[0];
    if (row.deletedAt) {
      throw new AppError("AUTH_FORBIDDEN", "Account deleted", "This account has been deleted. Please contact support.", 403);
    }
    patientId = row.id;

    // Refresh Google profile fields
    await db
      .update(patients)
      .set({ googleId: sub, googleEmail: email, googleName: name, googleAvatar: picture })
      .where(eq(patients.id, patientId));
  } else {
    // Create new Google-only patient
    const [newPatient] = await db
      .insert(patients)
      .values({
        phoneHash: syntheticPhoneHash,
        googleId: sub,
        googleEmail: email,
        googleName: name,
        googleAvatar: picture,
      })
      .returning({ id: patients.id });

    patientId = newPatient.id;
  }

  const response = NextResponse.json({ patientId, name, email, avatar: picture });

  await createPatientSession(
    {
      patientId,
      phoneHash: syntheticPhoneHash,
      city: null,
      lang: "en",
      consentPurposes: [],
    },
    response,
  );

  return response;
});
