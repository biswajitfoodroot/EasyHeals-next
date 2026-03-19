/**
 * POST /api/v1/payments/membership/create-order
 *
 * P2 Day 4 — Patient paid membership order creation (HLD §7.1)
 *
 * Creates a Razorpay order for the EasyHeals patient membership plan.
 * The client uses the returned orderId + key to launch the Razorpay SDK.
 *
 * Flow:
 *   1. Validate patient OTP session
 *   2. Check feature flag `paid_membership` (P2 flag — OFF by default)
 *   3. Prevent duplicate active membership (idempotency)
 *   4. Create Razorpay order via provider
 *   5. Insert payment_transactions row with status "created"
 *   6. Return { orderId, amount, currency, key } to client
 *
 * Auth:  eh_patient_session cookie
 * Gate:  paid_membership feature flag
 *
 * Membership tiers (seeded in packages table):
 *   BASIC     ₹0/mo  (free — default)
 *   PLUS      ₹99/mo
 *   PREMIUM   ₹299/mo
 *
 * Body:
 *   { tier: "PLUS" | "PREMIUM" }
 *
 * Env vars:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, PAYMENT_PROVIDER=razorpay
 */

import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { paymentTransactions } from "@/db/schema";
import { redisGet } from "@/lib/core/redis";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getPaymentProvider } from "@/lib/payments";

// ── Membership plan config ─────────────────────────────────────────────────

const MEMBERSHIP_PLANS: Record<string, { amountPaise: number; label: string }> = {
  PLUS: { amountPaise: 9900, label: "EasyHeals Plus — ₹99/month" },
  PREMIUM: { amountPaise: 29900, label: "EasyHeals Premium — ₹299/month" },
};

// ── Patient session ────────────────────────────────────────────────────────

interface PatientSession {
  patientId: string;
  phoneHash: string;
  phoneEncrypted: string | null;
  city: string | null;
  lang: string;
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

// ── Schema ─────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  tier: z.enum(["PLUS", "PREMIUM"]),
});

// ── Handler ────────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const enabled = await getFeatureFlag("paid_membership");
  if (!enabled) {
    throw new AppError("SYS_CONFIG_MISSING", "Paid membership not available", "This feature is not yet available.", 503);
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  const { tier } = parsed.data;
  const plan = MEMBERSHIP_PLANS[tier];

  // Check for an already pending/created order for this patient (prevent double-order)
  const existing = await db
    .select({ id: paymentTransactions.id, status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.patientId, patientId),
        eq(paymentTransactions.purpose, "membership"),
        eq(paymentTransactions.status, "created"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(
      "SYS_UNHANDLED",
      "Pending order exists",
      "You already have a pending membership order. Please complete or cancel it first.",
      409,
    );
  }

  // Create Razorpay order
  const payment = getPaymentProvider();
  const receipt = `membership_${patientId.slice(0, 8)}_${Date.now()}`;
  const order = await payment.createOrder({
    amountPaise: plan.amountPaise,
    receipt,
    notes: {
      patientId,
      tier,
      purpose: "membership",
    },
  });

  // Record in DB
  await db.insert(paymentTransactions).values({
    patientId,
    razorpayOrderId: order.orderId,
    amount: plan.amountPaise,
    currency: order.currency,
    status: "created",
    purpose: "membership",
  });

  return NextResponse.json({
    data: {
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      key: order.key,
      tier,
      label: plan.label,
    },
  }, { status: 201 });
});
