/**
 * Console Notification Provider — P1 dev/test default
 * Zero cost, zero infra. OTP printed to server terminal.
 * Switch to: NOTIFICATION_PROVIDER=twilio for real SMS.
 */
import type { OTPSender, LeadNotifier } from "./provider.interface";

export class ConsoleProvider implements OTPSender, LeadNotifier {
  async sendOTP(phone: string, otp: string, lang = "en"): Promise<void> {
    console.log(
      `\n📱 [ConsoleProvider] OTP for ${phone} (lang=${lang}): \x1b[32m${otp}\x1b[0m  (valid 10 min)\n`,
    );
  }

  async sendLeadConfirmation(
    phone: string,
    hospitalName: string,
    lang = "en",
  ): Promise<void> {
    console.log(
      `[ConsoleProvider] Lead confirmation sent to ${phone}: ${hospitalName} will call you back within 24h. (lang=${lang})`,
    );
  }
}
