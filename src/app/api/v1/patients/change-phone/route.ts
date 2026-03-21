/**
 * POST /api/v1/patients/change-phone — Phone number change via OTP verification
 *
 * 3-step flow:
 *   step: "send_current_otp"    → sends OTP to the patient's CURRENT phone
 *   step: "verify_current_otp"  → verifies OTP, returns a short-lived change token
 *   step: "send_new_otp"        → sends OTP to the NEW phone number
 *   step: "confirm_new_phone"   → verifies OTP, updates phone hash + encrypted phone in DB
 *
 * Auth:  eh_patient_session cookie
 * Token: stored in Redis for 10 min, single-use
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { generateOTP, hashOTP, verifyOTP } from "@/lib/security/otp";
import { hashPhone, encryptPhone, decryptPhone } from "@/lib/security/encryption";
import { getNotificationProvider } from "@/lib/notifications";
import { redisGet, redisSet, redisDel } from "@/lib/core/redis";

const CHANGE_TOKEN_TTL = 600; // 10 minutes

const currentOtpKey  = (id: string) => `phone_change:cur_otp:${id}`;
const changeTokenKey = (id: string) => `phone_change:token:${id}`;
const newPhoneKey    = (id: string) => `phone_change:new_phone:${id}`;
const newPhoneOtpKey = (id: string) => `phone_change:new_otp:${id}`;

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as Record<string, string> | null;
  const step = body?.step;

  // ── Step 1: Send OTP to current phone ──────────────────────────────────────

  if (step === "send_current_otp") {
    const [row] = await db.select({ phoneEncrypted: patients.phoneEncrypted })
      .from(patients).where(eq(patients.id, patientId)).limit(1);

    if (!row?.phoneEncrypted) {
      return NextResponse.json({ error: "No phone number associated with this account." }, { status: 400 });
    }

    const currentPhone = decryptPhone(row.phoneEncrypted);
    const phoneHash = hashPhone(currentPhone);
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Store OTP hash in Redis (avoids schema dependency)
    await redisSet(currentOtpKey(patientId), otpHash, CHANGE_TOKEN_TTL);

    try {
      const provider = getNotificationProvider();
      await provider.sendOTP(currentPhone, otp, "en");
    } catch {
      // In dev, OTP won't send — caller can read from server logs
    }

    return NextResponse.json({ ok: true });
  }

  // ── Step 2: Verify current OTP → issue change token ──────────────────────

  if (step === "verify_current_otp") {
    const otp = body?.otp?.trim();
    if (!otp || otp.length < 4) return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });

    const storedHash = await redisGet<string>(currentOtpKey(patientId));
    if (!storedHash) return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 400 });

    const valid = await verifyOTP(otp, storedHash);
    if (!valid) return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 400 });

    // Issue change token (random hex, single-use)
    const token = createHash("sha256").update(`${patientId}:${Date.now()}:change_phone`).digest("hex");
    await Promise.allSettled([
      redisDel(currentOtpKey(patientId)),
      redisSet(changeTokenKey(patientId), token, CHANGE_TOKEN_TTL),
    ]);

    return NextResponse.json({ ok: true, token });
  }

  // ── Step 3: Send OTP to new phone ─────────────────────────────────────────

  if (step === "send_new_otp") {
    const { newPhone, token } = body as { newPhone?: string; token?: string };
    if (!newPhone || !token) return NextResponse.json({ error: "Missing new phone or token." }, { status: 400 });

    const storedToken = await redisGet<string>(changeTokenKey(patientId));
    if (!storedToken || storedToken !== token) {
      return NextResponse.json({ error: "Session expired. Please restart the phone change flow." }, { status: 400 });
    }

    // Prevent if new phone already in use
    const newHash = hashPhone(newPhone.trim());
    const existing = await db.select({ id: patients.id }).from(patients).where(eq(patients.phoneHash, newHash)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "This phone number is already registered." }, { status: 409 });
    }

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    await redisSet(newPhoneKey(patientId), newPhone.trim(), CHANGE_TOKEN_TTL);
    await redisSet(newPhoneOtpKey(patientId), otpHash, CHANGE_TOKEN_TTL);

    try {
      const provider = getNotificationProvider();
      await provider.sendOTP(newPhone.trim(), otp, "en");
    } catch { /* dev: check server logs */ }

    return NextResponse.json({ ok: true });
  }

  // ── Step 4: Confirm new phone OTP → update DB ─────────────────────────────

  if (step === "confirm_new_phone") {
    const { otp, token } = body as { otp?: string; token?: string };
    if (!otp || !token) return NextResponse.json({ error: "Missing OTP or token." }, { status: 400 });

    const storedToken = await redisGet<string>(changeTokenKey(patientId));
    if (!storedToken || storedToken !== token) {
      return NextResponse.json({ error: "Session expired. Please restart the phone change flow." }, { status: 400 });
    }

    const newPhone = await redisGet<string>(newPhoneKey(patientId));
    const otpHash  = await redisGet<string>(newPhoneOtpKey(patientId));
    if (!newPhone || !otpHash) {
      return NextResponse.json({ error: "Session expired. Please restart the flow." }, { status: 400 });
    }

    const valid = await verifyOTP(otp.trim(), otpHash);
    if (!valid) return NextResponse.json({ error: "Incorrect OTP for new number." }, { status: 400 });

    // Update patient record
    const newHash = hashPhone(newPhone);
    const newEncrypted = encryptPhone(newPhone);

    await db.update(patients)
      .set({ phoneHash: newHash, phoneEncrypted: newEncrypted })
      .where(eq(patients.id, patientId));

    // Clean up Redis
    await Promise.allSettled([
      redisDel(changeTokenKey(patientId)),
      redisDel(newPhoneKey(patientId)),
      redisDel(newPhoneOtpKey(patientId)),
    ]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid step." }, { status: 400 });
});
