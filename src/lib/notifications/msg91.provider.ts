/**
 * MSG91 Notification Provider
 *
 * Handles all MSG91 channels:
 *   - SMS OTP (DLT template)
 *   - SMS bulk campaigns (mass marketing)
 *   - WhatsApp lead confirmations (single)
 *   - WhatsApp template broadcast (bulk)
 *
 * Required env vars:
 *   MSG91_AUTH_KEY              — MSG91 API auth key
 *   MSG91_SENDER_ID             — 6-char DLT registered sender ID (e.g. EHEALZ)
 *   MSG91_OTP_TEMPLATE_ID       — DLT approved OTP template ID
 *   MSG91_LEAD_TEMPLATE_ID      — DLT approved lead confirmation template ID
 *   MSG91_WA_INTEGRATED_NUMBER  — WhatsApp Business number (for WA messages)
 *
 * Live chat (Hello widget):
 *   NEXT_PUBLIC_MSG91_HELLO_WIDGET_TOKEN — Hello widget token (client-side only)
 *
 * DLT registration: 2–4 weeks via TRAI operator.
 * Set NOTIFICATION_PROVIDER=msg91 after DLT approval.
 */
import type { OTPSender, LeadNotifier, WhatsAppSender, SMSBroadcastSender } from "./provider.interface";

const MSG91_BASE = "https://control.msg91.com/api/v5";
const MSG91_WA_BASE = "https://api.msg91.com/api/v5/whatsapp";

export class MSG91Provider implements OTPSender, LeadNotifier, WhatsAppSender, SMSBroadcastSender {
  private readonly authKey: string;
  private readonly senderId: string;
  private readonly otpTemplateId: string;
  private readonly leadTemplateId: string;
  private readonly waIntegratedNumber: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY ?? "";
    this.senderId = process.env.MSG91_SENDER_ID ?? "EHEALZ";
    this.otpTemplateId = process.env.MSG91_OTP_TEMPLATE_ID ?? "";
    this.leadTemplateId = process.env.MSG91_LEAD_TEMPLATE_ID ?? "";
    this.waIntegratedNumber = process.env.MSG91_WA_INTEGRATED_NUMBER ?? "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OTPSender
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send OTP via MSG91 SMS API (DLT template required).
   * Template format: "##OTP## is your EasyHeals verification code. Valid for 10 minutes."
   */
  async sendOTP(phone: string, otp: string, _lang?: string): Promise<void> {
    if (!this.authKey || !this.otpTemplateId) {
      throw new Error("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required");
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, "");

    const response = await fetch(
      `${MSG91_BASE}/otp?template_id=${this.otpTemplateId}&mobile=91${cleanPhone}&authkey=${this.authKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`MSG91 OTP send failed (${response.status}): ${body}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LeadNotifier
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send lead confirmation — tries WhatsApp first, falls back to SMS.
   * Template: "Hello! Your EasyHeals request for ##HOSPITAL## is received. Advisor will call within 24 hours."
   */
  async sendLeadConfirmation(phone: string, hospitalName: string, _lang?: string): Promise<void> {
    if (this.waIntegratedNumber && this.authKey) {
      try {
        await this._sendWATemplate(phone, "easyheals_lead_confirmed", { HOSPITAL: hospitalName });
        return;
      } catch (err) {
        console.warn("[MSG91] WA lead confirmation failed, falling back to SMS:", err);
      }
    }

    if (!this.authKey || !this.leadTemplateId) {
      console.warn("[MSG91] sendLeadConfirmation: no credentials configured, skipping");
      return;
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, "");

    await fetch(`${MSG91_BASE}/flow/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: this.authKey },
      body: JSON.stringify({
        template_id: this.leadTemplateId,
        sender: this.senderId,
        short_url: "0",
        mobiles: `91${cleanPhone}`,
        HOSPITAL: hospitalName,
      }),
      signal: AbortSignal.timeout(8000),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WhatsAppSender — single template + bulk broadcast
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a single approved WhatsApp template to one recipient.
   * Used for appointment confirmations, reminders, etc.
   *
   * @param phone        10-digit Indian mobile number
   * @param templateName MSG91-registered WA template name
   * @param vars         Template variable map (key = placeholder name, value = substitution)
   */
  async sendWhatsAppTemplate(
    phone: string,
    templateName: string,
    vars: Record<string, string>
  ): Promise<void> {
    await this._sendWATemplate(phone, templateName, vars);
  }

  /**
   * Bulk broadcast an approved WhatsApp template to many recipients (mass marketing).
   * Each send is independent — partial failures are counted, not thrown.
   */
  async sendBroadcast(
    recipients: string[],
    templateName: string,
    vars: Record<string, string>
  ): Promise<{ sent: number; failed: number }> {
    if (recipients.length === 0) return { sent: 0, failed: 0 };

    const payload = recipients.map((phone) => {
      const cleanPhone = phone.replace(/[\s\-+]/g, "");
      return {
        integrated_number: this.waIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          to: `91${cleanPhone}`,
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: Object.values(vars).map((v) => ({ type: "text", text: v })),
              },
            ],
          },
        },
      };
    });

    try {
      const response = await fetch(`${MSG91_WA_BASE}/whatsapp-outbound-message/bulk/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: this.authKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) return { sent: recipients.length, failed: 0 };

      const body = await response.text().catch(() => "");
      console.error(`[MSG91] WA broadcast failed (${response.status}): ${body}`);
      return { sent: 0, failed: recipients.length };
    } catch (err) {
      console.error("[MSG91] WA broadcast error:", err);
      return { sent: 0, failed: recipients.length };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SMSBroadcastSender — mass SMS campaigns
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a DLT-registered SMS template to many phones (mass marketing).
   * Uses MSG91 Flow API with comma-separated mobiles.
   *
   * @param phones     Array of 10-digit Indian numbers (no country code)
   * @param templateId DLT template ID registered in MSG91 dashboard
   * @param vars       Variable substitutions matching the DLT template placeholders
   */
  async sendSMSCampaign(
    phones: string[],
    templateId: string,
    vars: Record<string, string>
  ): Promise<{ sent: number; failed: number }> {
    if (!this.authKey) throw new Error("MSG91_AUTH_KEY is required for SMS campaigns");
    if (phones.length === 0) return { sent: 0, failed: 0 };

    const mobiles = phones
      .map((p) => `91${p.replace(/[\s\-+]/g, "")}`)
      .join(",");

    try {
      const response = await fetch(`${MSG91_BASE}/flow/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: this.authKey },
        body: JSON.stringify({
          template_id: templateId,
          sender: this.senderId,
          short_url: "0",
          mobiles,
          ...vars,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) return { sent: phones.length, failed: 0 };

      const body = await response.text().catch(() => "");
      console.error(`[MSG91] SMS campaign failed (${response.status}): ${body}`);
      return { sent: 0, failed: phones.length };
    } catch (err) {
      console.error("[MSG91] SMS campaign error:", err);
      return { sent: 0, failed: phones.length };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async _sendWATemplate(
    phone: string,
    templateName: string,
    vars: Record<string, string>
  ): Promise<void> {
    if (!this.authKey || !this.waIntegratedNumber) {
      throw new Error("MSG91_AUTH_KEY and MSG91_WA_INTEGRATED_NUMBER are required");
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, "");

    const response = await fetch(`${MSG91_WA_BASE}/whatsapp-outbound-message/bulk/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: this.authKey },
      body: JSON.stringify({
        integrated_number: this.waIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          to: `91${cleanPhone}`,
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: Object.values(vars).map((v) => ({ type: "text", text: v })),
              },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`MSG91 WA send failed (${response.status}): ${body}`);
    }
  }
}
