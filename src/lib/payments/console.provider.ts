/**
 * Console Payment Provider — dev/test stub
 *
 * Logs payment intent to console. No charge. Returns fake order IDs.
 * Active when PAYMENT_PROVIDER is unset or "console".
 */

import type { OrderCreator, PaymentVerifier, SubscriptionManager } from "./provider.interface";

export class ConsolePaymentProvider
  implements OrderCreator, PaymentVerifier, SubscriptionManager
{
  async createOrder({
    amountPaise,
    currency = "INR",
    receipt,
  }: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }) {
    const orderId = `order_console_${Date.now()}`;
    console.log(`[Payment:Console] createOrder receipt=${receipt} amount=${amountPaise} ${currency}`);
    return { orderId, amount: amountPaise, currency, key: "rzp_test_console" };
  }

  verifyPayment({
    orderId,
    paymentId,
  }: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    console.log(`[Payment:Console] verifyPayment orderId=${orderId} paymentId=${paymentId} → true`);
    return true; // always passes in dev
  }

  async createSubscription({
    planId,
  }: {
    planId: string;
    totalCount: number;
    notes?: Record<string, string>;
  }) {
    const subscriptionId = `sub_console_${Date.now()}`;
    console.log(`[Payment:Console] createSubscription planId=${planId}`);
    return { subscriptionId, shortUrl: `https://rzp.io/l/console_${planId}` };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[Payment:Console] cancelSubscription ${subscriptionId}`);
  }
}
