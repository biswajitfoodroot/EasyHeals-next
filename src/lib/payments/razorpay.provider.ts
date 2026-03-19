/**
 * Razorpay Payment Provider — P2 (HLD §7)
 *
 * Handles:
 *   - One-time order creation (paid membership, consultation)
 *   - Payment signature verification (HMAC-SHA256)
 *   - Subscription creation + cancellation (recurring paid tier)
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID      — public key (safe to send to client)
 *   RAZORPAY_KEY_SECRET  — secret (server-side only; NEVER sent to client)
 *
 * No Razorpay SDK package required — uses the REST API directly via fetch.
 * This avoids adding a large dependency and keeps the Edge runtime compatible.
 *
 * Razorpay REST API base: https://api.razorpay.com/v1
 * Auth: HTTP Basic with key_id:key_secret
 */

import { createHmac } from "crypto";
import type { OrderCreator, PaymentVerifier, SubscriptionManager } from "./provider.interface";

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

export class RazorpayProvider implements OrderCreator, PaymentVerifier, SubscriptionManager {
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID ?? "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  }

  private get authHeader(): string {
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    return `Basic ${token}`;
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PATCH",
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${RAZORPAY_BASE}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        `Razorpay API error ${res.status}: ${data?.error?.description ?? JSON.stringify(data)}`,
      );
    }
    return data as T;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OrderCreator
  // ─────────────────────────────────────────────────────────────────────────

  async createOrder({
    amountPaise,
    currency = "INR",
    receipt,
    notes = {},
  }: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ orderId: string; amount: number; currency: string; key: string }> {
    if (!this.keyId || !this.keySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
    }

    const data = await this.request<{ id: string; amount: number; currency: string }>(
      "/orders",
      "POST",
      {
        amount: amountPaise,
        currency,
        receipt,
        notes,
      },
    );

    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      key: this.keyId, // safe to expose to client
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PaymentVerifier
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify Razorpay payment signature.
   * Signature = HMAC-SHA256(orderId + "|" + paymentId, keySecret)
   */
  verifyPayment({
    orderId,
    paymentId,
    signature,
  }: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    if (!this.keySecret) return false;
    const payload = `${orderId}|${paymentId}`;
    const expected = createHmac("sha256", this.keySecret)
      .update(payload)
      .digest("hex");
    // Constant-time comparison to prevent timing attacks
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SubscriptionManager
  // ─────────────────────────────────────────────────────────────────────────

  async createSubscription({
    planId,
    totalCount,
    notes = {},
  }: {
    planId: string;
    totalCount: number;
    notes?: Record<string, string>;
  }): Promise<{ subscriptionId: string; shortUrl: string }> {
    const data = await this.request<{ id: string; short_url: string }>(
      "/subscriptions",
      "POST",
      {
        plan_id: planId,
        total_count: totalCount,
        quantity: 1,
        notes,
      },
    );
    return { subscriptionId: data.id, shortUrl: data.short_url };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}/cancel`, "POST", {
      cancel_at_cycle_end: false,
    });
  }
}
