/**
 * POST /api/v1/patients/claim-promo
 * Claim the "Health+ Free for 3 Months" launch offer.
 * - Requires patient session (auth cookie)
 * - Validates Indian mobile number
 * - One claim per phone number across all accounts (checked via phoneHash)
 * - Activates health_plus for 90 days
 */
import { createHash } from "crypto";
import { eq, ne, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";

const PHONE_RE = /^[6-9]\d{9}$/;
const PROMO_DAYS = 90; // 3 months

const bodySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => PHONE_RE.test(v), "Please enter a valid 10-digit Indian mobile number"),
});

export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requirePatientSession>>;
  try {
    auth = await requirePatientSession(req);
  } catch {
    return NextResponse.json({ error: "Please log in to claim this offer." }, { status: 401 });
  }

  const body = await req.json() as unknown;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid phone number" },
      { status: 400 },
    );
  }

  const phone = parsed.data.phone;
  const phoneHash = createHash("sha256").update(phone).digest("hex");

  // Check if this patient already has a non-free subscription
  const [currentPatient] = await db
    .select({ subscriptionTier: patients.subscriptionTier, subscriptionExpiresAt: patients.subscriptionExpiresAt })
    .from(patients)
    .where(eq(patients.id, auth.patientId))
    .limit(1);

  if (!currentPatient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  if (currentPatient.subscriptionTier && currentPatient.subscriptionTier !== "free") {
    if (currentPatient.subscriptionExpiresAt && currentPatient.subscriptionExpiresAt > new Date()) {
      return NextResponse.json(
        { error: "You already have an active Health+ subscription." },
        { status: 409 },
      );
    }
  }

  // Check if this phone hash is already used by ANY other patient (fraud prevention)
  const phoneTakenByOther = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.phoneHash, phoneHash), ne(patients.id, auth.patientId)))
    .limit(1);

  if (phoneTakenByOther.length > 0) {
    return NextResponse.json(
      { error: "This phone number has already been used to claim the offer. Each number can only be used once." },
      { status: 409 },
    );
  }

  // Activate promo
  const expiresAt = new Date(Date.now() + PROMO_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(patients)
    .set({
      phoneHash,
      subscriptionTier: "health_plus",
      subscriptionExpiresAt: expiresAt,
    })
    .where(eq(patients.id, auth.patientId));

  return NextResponse.json({
    data: {
      tier: "health_plus",
      expiresAt: expiresAt.toISOString(),
      message: "Health+ activated! Enjoy 3 months free.",
    },
  });
}
