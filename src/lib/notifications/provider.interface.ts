/**
 * Notification Provider Interface (Task 3.6)
 *
 * Segregated per phase so each provider only implements what it supports.
 * Console (dev/test), MSG91 (production — DLT SMS + WA + Hello live chat + campaigns).
 */

export interface OTPSender {
  sendOTP(phone: string, otp: string, lang?: string): Promise<void>;
}

export interface LeadNotifier {
  sendLeadConfirmation(phone: string, hospitalName: string, lang?: string): Promise<void>;
}

/** P2+ — MSG91 WhatsApp Business API (template + bulk broadcast) */
export interface WhatsAppSender {
  /** Send a single approved WA template to one recipient */
  sendWhatsAppTemplate(
    phone: string,
    templateName: string,
    vars: Record<string, string>,
  ): Promise<void>;
  /** Bulk broadcast an approved WA template to multiple recipients */
  sendBroadcast(
    recipients: string[],
    templateName: string,
    vars: Record<string, string>,
  ): Promise<{ sent: number; failed: number }>;
}

/** P2+ — MSG91 SMS bulk campaigns (mass marketing) */
export interface SMSBroadcastSender {
  /**
   * Send a DLT-registered SMS template to many phones.
   * @param phones  Array of 10-digit Indian phone numbers (no country code)
   * @param templateId  MSG91 DLT template ID
   * @param vars   Template variable substitutions (e.g. { HOSPITAL: "Apollo" })
   */
  sendSMSCampaign(
    phones: string[],
    templateId: string,
    vars: Record<string, string>,
  ): Promise<{ sent: number; failed: number }>;
}

/** P3+ only — FCM push */
export interface PushSender {
  sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void>;
}
