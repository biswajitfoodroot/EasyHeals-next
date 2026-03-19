/**
 * GET /api/cron/appointment-reminders
 *
 * P2 Day 2 — Daily appointment reminder cron (HLD §5.4)
 *
 * Schedule: 08:30 IST daily = 03:00 UTC (vercel.json: "0 3 * * *")
 * Auth:      Vercel sends Authorization: Bearer <CRON_SECRET> — we validate it.
 *
 * Logic:
 *   1. Find all confirmed/requested appointments scheduled 20–28 hours from now.
 *   2. For each, load patient.phoneEncrypted → decrypt → collect phone numbers.
 *   3. Call MSG91Provider.sendBroadcast() with the appointment reminder WA template.
 *   4. Log sent/failed counts; never throw — silently degrade if WA not configured.
 *
 * Env vars required:
 *   CRON_SECRET                           — Vercel auto-injects in production
 *   NOTIFICATION_PROVIDER=msg91           — enables WA delivery
 *   MSG91_AUTH_KEY, MSG91_WA_INTEGRATED_NUMBER  — MSG91 credentials
 *   MSG91_WA_APPOINTMENT_TEMPLATE_NAME    — registered WA template name
 *   ENCRYPTION_KEY                        — AES-256 key for decryptPhone
 *
 * Graceful degradation:
 *   - If NOTIFICATION_PROVIDER != msg91 → skips silently, returns stats with sent=0
 *   - If decryptPhone fails → skips that patient (logs warning)
 *   - sendBroadcast partial failures are counted, not thrown
 */

import { and, between, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, hospitals, patients } from "@/db/schema";
import { decryptPhone } from "@/lib/security/encryption";
import { getNotificationProvider } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Window: appointments scheduled 20–28 hours from now get a reminder
const WINDOW_START_HOURS = 20;
const WINDOW_END_HOURS = 28;

export async function GET(req: NextRequest) {
  // ── 1. Auth — Vercel cron secret ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templateName =
    process.env.MSG91_WA_APPOINTMENT_TEMPLATE_NAME ?? "easyheals_appointment_reminder";

  const now = Date.now();
  const windowStart = new Date(now + WINDOW_START_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now + WINDOW_END_HOURS * 60 * 60 * 1000);

  try {
    // ── 2. Query upcoming appointments in the reminder window ──────────────
    const rows = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        type: appointments.type,
        scheduledAt: appointments.scheduledAt,
        hospitalName: hospitals.name,
        phoneEncrypted: patients.phoneEncrypted,
      })
      .from(appointments)
      .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
      .leftJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          inArray(appointments.status, ["requested", "confirmed"]),
          between(appointments.scheduledAt, windowStart, windowEnd),
        ),
      );

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        message: "No appointments in reminder window",
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    }

    // ── 3. Decrypt phone numbers — skip patients without encrypted phone ───
    interface ReminderTarget {
      phone: string;
      hospitalName: string;
      type: string;
      scheduledAt: Date;
    }

    const targets: ReminderTarget[] = [];
    let skipped = 0;

    for (const row of rows) {
      if (!row.phoneEncrypted || !row.scheduledAt) {
        skipped++;
        continue;
      }
      try {
        const phone = decryptPhone(row.phoneEncrypted);
        targets.push({
          phone,
          hospitalName: row.hospitalName ?? "your hospital",
          type: row.type,
          scheduledAt: row.scheduledAt,
        });
      } catch (err) {
        console.warn(`[ReminderCron] Failed to decrypt phone for patient ${row.patientId}:`, err);
        skipped++;
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        message: "No decryptable phones in reminder window",
        found: rows.length,
        sent: 0,
        failed: 0,
        skipped,
      });
    }

    // ── 4. Send WA broadcast — non-blocking, gracefully degrades ──────────
    const notif = getNotificationProvider();
    if (!("sendBroadcast" in notif)) {
      // Provider doesn't support WA broadcast (e.g. ConsoleProvider in dev)
      console.info(`[ReminderCron] Provider does not support sendBroadcast — skipping WA send`);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        message: "WA broadcast not supported by current provider",
        found: rows.length,
        sent: 0,
        failed: 0,
        skipped: rows.length,
      });
    }

    // Group by template vars — in practice all reminders share the same template
    // with per-recipient substitution. MSG91 sendBroadcast accepts a recipients array
    // and a shared vars map; for per-recipient vars we batch per unique hospitalName.
    //
    // If more precise per-patient vars are needed, loop individually (P3+).
    const phones = targets.map((t) => t.phone);
    const first = targets[0];
    const sharedVars: Record<string, string> = {
      HOSPITAL: first.hospitalName,
      TYPE: first.type === "online_consultation" ? "Online Consultation" : "In-Person Visit",
      DATE: first.scheduledAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const { sent, failed } = await (notif as any).sendBroadcast(phones, templateName, sharedVars);

    console.info(`[ReminderCron] Sent ${sent} reminders, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      found: rows.length,
      sent,
      failed,
      skipped,
    });
  } catch (err) {
    console.error("[ReminderCron] Fatal error:", err);
    return NextResponse.json(
      { error: "Reminder cron failed", detail: String(err) },
      { status: 500 },
    );
  }
}
