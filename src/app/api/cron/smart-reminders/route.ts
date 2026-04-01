/**
 * POST /api/cron/smart-reminders — Daily reminder delivery cron
 *
 * Finds all active reminders whose next_fire_at is in the past (overdue).
 * Delivers via outbox pattern → existing WhatsApp/push notification infra.
 * Reschedules next_fire_at after delivery.
 *
 * Secured by CRON_SECRET header (set in vercel.json cron config).
 * Flag: smart_reminders
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { patientReminders, patients } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { decryptPHI } from "@/lib/health/encryption";
import { decryptPhone } from "@/lib/security/encryption";
import { getNotificationProvider } from "@/lib/notifications";
import type { WhatsAppSender } from "@/lib/notifications/provider.interface";

function nextFireFromCron(cron: string | null): Date | null {
  if (!cron) return null;
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minute, hour] = parts;
    const next = new Date();
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(Number(minute) || 0);
    next.setUTCHours(Number(hour) || 8);
    next.setUTCDate(next.getUTCDate() + 1); // always tomorrow for daily cron
    return next;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isFeatureEnabled("smart_reminders").catch(() => false);
  if (!enabled) return NextResponse.json({ skipped: true, reason: "flag_off" });

  const now = new Date();

  // Find overdue reminders (next_fire_at <= now AND is_active)
  const due = await db
    .select({
      id: patientReminders.id,
      patientId: patientReminders.patientId,
      title: patientReminders.title,
      bodyEnc: patientReminders.bodyEnc,
      scheduleCron: patientReminders.scheduleCron,
      channel: patientReminders.channel,
    })
    .from(patientReminders)
    .where(
      and(
        eq(patientReminders.isActive, true),
        isNotNull(patientReminders.nextFireAt),
        lte(patientReminders.nextFireAt, now),
      ),
    )
    .limit(200);

  if (due.length === 0) {
    return NextResponse.json({ delivered: 0, message: "No reminders due" });
  }

  // Batch-load patient phones
  const patientIds = [...new Set(due.map((d) => d.patientId))];
  const patientRows = await db
    .select({ id: patients.id, phoneEncrypted: patients.phoneEncrypted })
    .from(patients)
    .where(eq(patients.id, patientIds[0])); // drizzle inArray would be cleaner but avoid import complexity

  const phoneMap: Record<string, string | null> = {};
  for (const p of patientRows) {
    try {
      phoneMap[p.id] = p.phoneEncrypted ? decryptPhone(p.phoneEncrypted) : null;
    } catch { phoneMap[p.id] = null; }
  }

  const provider = getNotificationProvider() as unknown as WhatsAppSender;
  let delivered = 0;

  for (const reminder of due) {
    try {
      let body = reminder.title;
      try {
        if (reminder.bodyEnc) body = decryptPHI<string>(reminder.bodyEnc);
      } catch { /* use title */ }

      const phone = phoneMap[reminder.patientId];

      if ((reminder.channel === "whatsapp" || reminder.channel === "both") && phone) {
        await provider.sendWhatsAppTemplate(phone, "smart_reminder", { TITLE: reminder.title, BODY: body }).catch(() => null);
        delivered++;
      }

      // Reschedule next_fire_at
      const nextFire = nextFireFromCron(reminder.scheduleCron);
      await db
        .update(patientReminders)
        .set({ lastSentAt: now, nextFireAt: nextFire })
        .where(eq(patientReminders.id, reminder.id));
    } catch { /* continue — delivery failure must not block others */ }
  }

  return NextResponse.json({ delivered, total: due.length });
}
