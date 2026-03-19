/**
 * Notification Provider Factory
 *
 * Reads NOTIFICATION_PROVIDER env var → returns the correct provider singleton.
 *
 *   console — local dev (zero cost, logs to stdout)
 *   msg91   — production: DLT SMS + WhatsApp via MSG91 API
 *   twilio  — legacy fallback (kept for compatibility, prefer msg91)
 *
 * Default: console (local) / set NOTIFICATION_PROVIDER=msg91 in Vercel after DLT approval.
 * MSG91 is the target provider going forward — skip Twilio in production.
 */
import { env } from "@/lib/env";
import type { OTPSender, LeadNotifier } from "./provider.interface";

export type { OTPSender, LeadNotifier };

type NotificationProvider = OTPSender & LeadNotifier;

let _instance: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (_instance) return _instance;

  const provider = env.NOTIFICATION_PROVIDER ?? "console";

  if (provider === "msg91") {
    const { MSG91Provider } = require("./msg91.provider");
    _instance = new MSG91Provider();
  } else if (provider === "twilio") {
    // Legacy — prefer msg91 going forward
    const { TwilioProvider } = require("./twilio.provider");
    _instance = new TwilioProvider();
  } else {
    const { ConsoleProvider } = require("./console.provider");
    _instance = new ConsoleProvider();
  }

  return _instance!;
}

/** Reset singleton — useful for tests that swap providers */
export function resetNotificationProvider(): void {
  _instance = null;
}

// ── P3: FCM Push Notifications ────────────────────────────────────────────────

export { getFCMProvider, FCMProvider, isFcmConfigured } from "./fcm.provider";
export type { PushSender } from "./provider.interface";
