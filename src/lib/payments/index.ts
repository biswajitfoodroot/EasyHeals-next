/**
 * Payment provider factory.
 * Resolution: PAYMENT_PROVIDER env var → "razorpay" | "console" (default: "console")
 */

import { RazorpayProvider } from "./razorpay.provider";
import { ConsolePaymentProvider } from "./console.provider";
import type { OrderCreator, PaymentVerifier, SubscriptionManager } from "./provider.interface";

export type { OrderCreator, PaymentVerifier, SubscriptionManager };

export type PaymentProvider = OrderCreator & PaymentVerifier & SubscriptionManager;

let _instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_instance) return _instance;

  const providerName = process.env.PAYMENT_PROVIDER ?? "console";

  switch (providerName) {
    case "razorpay":
      _instance = new RazorpayProvider();
      break;
    default:
      _instance = new ConsolePaymentProvider();
  }

  return _instance;
}
