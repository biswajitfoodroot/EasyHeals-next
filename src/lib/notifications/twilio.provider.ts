/**
 * Twilio SMS Provider — P1 production (no DLT registration needed)
 * Fully implemented: sends real SMS via Twilio REST API.
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID=ACxxx
 *   TWILIO_AUTH_TOKEN=xxx
 *   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
 *
 * Switch: set NOTIFICATION_PROVIDER=twilio in Vercel env.
 * P2 migration: set NOTIFICATION_PROVIDER=msg91 after DLT registration.
 */
import type { OTPSender, LeadNotifier } from "./provider.interface";
import { env } from "@/lib/env";

export class TwilioProvider implements OTPSender, LeadNotifier {
  private async sendSMS(to: string, body: string): Promise<void> {
    const sid = env.TWILIO_ACCOUNT_SID;
    const token = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
      throw new Error(
        "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.",
      );
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`Twilio SMS failed: ${err.message ?? res.statusText}`);
    }
  }

  async sendOTP(phone: string, otp: string, lang = "en"): Promise<void> {
    const messages: Record<string, string> = {
      en: `Your EasyHeals verification code is ${otp}. Valid for 10 minutes. Do not share this code.`,
      hi: `आपका EasyHeals OTP है: ${otp}। 10 मिनट में समाप्त।`,
    };
    const body = messages[lang] ?? messages.en;
    await this.sendSMS(phone, body);
  }

  async sendLeadConfirmation(
    phone: string,
    hospitalName: string,
    lang = "en",
  ): Promise<void> {
    const messages: Record<string, string> = {
      en: `EasyHeals: Your callback request has been sent to ${hospitalName}. They will call you within 24 hours.`,
      hi: `EasyHeals: आपका अनुरोध ${hospitalName} को भेज दिया गया है। वे 24 घंटे में कॉल करेंगे।`,
    };
    const body = messages[lang] ?? messages.en;
    await this.sendSMS(phone, body);
  }
}
