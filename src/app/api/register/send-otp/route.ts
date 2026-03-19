import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { otpVerifications } from "@/db/schema";
import { env } from "@/lib/env";

const requestSchema = z.object({
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => /^[6-9]\d{9}$/.test(value), "Invalid Indian mobile number"),
});

async function sendOtpViaMsg91(phone: string, otp: string) {
  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
    return { ok: true, simulated: true };
  }

  const response = await fetch("https://api.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      template_id: env.MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      otp,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MSG91 OTP failed: ${response.status} ${body}`);
  }

  return { ok: true, simulated: false };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid phone", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const phone = parsed.data.phone;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const sendResult = await sendOtpViaMsg91(phone, otp);

    const otpHash = createHash("sha256").update(otp).digest("hex");

    const phoneHash = createHash("sha256").update(phone).digest("hex");

    const [record] = await db
      .insert(otpVerifications)
      .values({
        phoneHash,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        channel: "sms",
      })
      .returning({ id: otpVerifications.id });

    return NextResponse.json({
      sent: true,
      otpId: record.id,
      mode: sendResult.simulated ? "simulated" : "sms",
      ...(env.NODE_ENV !== "production" ? { debugOtp: otp } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "OTP send failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}


