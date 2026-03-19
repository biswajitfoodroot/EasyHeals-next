/**
 * POST /api/v1/payments/membership/verify
 *
 * P2 Day 4 — Razorpay payment verification + membership activation (HLD §7.1)
 *
 * Called by the client after Razorpay SDK completes payment.
 * Verifies the HMAC-SHA256 signature, marks payment as paid,
 * and activates the patient's membership tier.
 *
 * Auth:  eh_patient_session cookie
 *
 * Body:
 *   {
 *     razorpay_order_id: string
 *     razorpay_payment_id: string
 *     razorpay_signature: string
 *   }
 *
 * On success:
 *   - paymentTransactions.status → "paid"
 *   - Outbox event "membership.activated" published → CRM picks up
 *   - Returns { activated: true, tier, validUntil }
 *
 * Security:
 *   - Signature verification uses constant-time HMAC comparison (no timing attack)
 *   - Only the patient who created the order can verify it (patientId check)
 *   - Replay attacks prevented by status "paid" check (idempotent)
 */

import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { paymentTransactions } from "@/db/schema";
import { redisGet } from "@/lib/core/redis";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getPaymentProvider } from "@/lib/payments";
import { publishEvent } from "@/lib/crm/outbox";

// ── Patient session ────────────────────────────────────────────────────────

interface PatientSession {
  patientId: string;
  phoneHash: string;
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
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ── Handler ────────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // Load the transaction and verify it belongs to this patient
  const txRows = await db
    .select({
      id: paymentTransactions.id,
      status: paymentTransactions.status,
      amount: paymentTransactions.amount,
      purpose: paymentTransactions.purpose,
      patientId: paymentTransactions.patientId,
    })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.razorpayOrderId, razorpay_order_id),
        eq(paymentTransactions.patientId, patientId),
      ),
    )
    .limit(1);

  if (!txRows.length) {
    throw new AppError("DB_NOT_FOUND", "Order not found", "Payment order not found.", 404);
  }

  const tx = txRows[0];

  // Idempotency — already verified
  if (tx.status === "paid") {
    return NextResponse.json({
      data: { activated: true, alreadyVerified: true, purpose: tx.purpose },
    });
  }

  if (tx.status !== "created") {
    throw new AppError("SYS_UNHANDLED", "Invalid order state", `Cannot verify a ${tx.status} order.`, 409);
  }

  // Verify Razorpay signature
  const payment = getPaymentProvider();
  const valid = payment.verifyPayment({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    // Mark as failed
    await db
      .update(paymentTransactions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentTransactions.id, tx.id));

    throw new AppError("SYS_UNHANDLED", "Invalid signature", "Payment verification failed. Please contact support.", 400);
  }

  // Mark as paid
  await db
    .update(paymentTransactions)
    .set({
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, tx.id));

  // Membership valid for 30 days from now
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Publish outbox event → CRM updates patient tier
  await publishEvent("membership.activated", {
    patientId,
    transactionId: tx.id,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    amountPaise: tx.amount,
    purpose: tx.purpose,
    validUntil: validUntil.toISOString(),
  });

  return NextResponse.json({
    data: {
      activated: true,
      purpose: tx.purpose,
      amountPaid: tx.amount,
      validUntil: validUntil.toISOString(),
      message: "Membership activated successfully.",
    },
  });
});
