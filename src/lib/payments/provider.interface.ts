/**
 * Payment Provider Interface — P2 (HLD §7)
 *
 * Segregated by capability so each provider only implements what it supports.
 * Razorpay (P2): orders, subscriptions, webhook verification.
 * ConsoleProvider (dev): logs intent, no charge.
 */

export interface OrderCreator {
  /**
   * Create a payment order.
   * Returns the provider order ID + amount (in paise) for the client SDK.
   */
  createOrder(params: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ orderId: string; amount: number; currency: string; key: string }>;
}

export interface PaymentVerifier {
  /**
   * Verify a Razorpay payment signature after client-side payment.
   * Returns true if the signature is valid.
   */
  verifyPayment(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
}

export interface SubscriptionManager {
  /** Create a Razorpay subscription for a recurring plan */
  createSubscription(params: {
    planId: string;
    totalCount: number;
    notes?: Record<string, string>;
  }): Promise<{ subscriptionId: string; shortUrl: string }>;

  /** Cancel a subscription immediately */
  cancelSubscription(subscriptionId: string): Promise<void>;
}
