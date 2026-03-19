/**
 * POST /api/v1/provider/schedule/generate — On-demand slot generation
 *
 * Auth:  hospital_admin / doctor (own entity), owner/admin
 * Flag:  slot_auto_generation
 *
 * Reads the provider's schedule config and generates appointment_slots
 * for a given date range (max 30 days forward).
 *
 * Body: { fromDate?: string (ISO), days?: number (1-30) }
 * Idempotent: existing slots in the range are not duplicated (conflict DO NOTHING).
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointmentSlots, systemConfig } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";

const bodySchema = z.object({
  fromDate: z.string().optional(), // ISO date string e.g. "2026-03-20"
  days: z.number().int().min(1).max(30).default(14),
});

interface ScheduleConfig {
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  daysOfWeek: number[];
  capacityPerSlot: number;
  breakStart?: number;
  breakEnd?: number;
}

const SCHEDULE_CONFIG_KEY = (entityId: string) => `provider_schedule_${entityId}`;

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await isFeatureEnabled("slot_auto_generation")) {
    return NextResponse.json({ error: "Slot auto-generation not enabled." }, { status: 503 });
  }

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const entityId = auth.entityId;
  if (!entityId) {
    return NextResponse.json({ error: "No provider entity linked to this account" }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { fromDate, days } = parsed.data;

  // Load schedule config
  const [configRow] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, SCHEDULE_CONFIG_KEY(entityId)))
    .limit(1);

  if (!configRow?.value) {
    return NextResponse.json({ error: "No schedule configured. Set up working hours first." }, { status: 400 });
  }

  let config: ScheduleConfig;
  try {
    config = JSON.parse(configRow.value) as ScheduleConfig;
  } catch {
    return NextResponse.json({ error: "Invalid schedule configuration." }, { status: 500 });
  }

  const startDate = fromDate ? new Date(fromDate) : new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + days);

  const entityType = auth.entityType as "hospital" | "doctor" | null;
  const slotRows: {
    doctorId: string | null;
    hospitalId: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    isAvailable: boolean;
  }[] = [];

  const current = new Date(startDate);
  while (current < endDate) {
    const dayOfWeek = current.getDay();

    if (config.daysOfWeek.includes(dayOfWeek)) {
      // Generate slots for this day
      let hour = config.startHour;
      while (hour < config.endHour) {
        // Skip break time
        if (config.breakStart !== undefined && config.breakEnd !== undefined) {
          if (hour >= config.breakStart && hour < config.breakEnd) {
            hour++;
            continue;
          }
        }

        const slotStart = new Date(current);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotStart.getMinutes() + config.slotDurationMinutes);

        // Only generate future slots
        if (slotStart > new Date()) {
          slotRows.push({
            doctorId: entityType === "doctor" ? entityId : null,
            hospitalId: entityType === "hospital" ? entityId : null,
            startsAt: slotStart,
            endsAt: slotEnd,
            capacity: config.capacityPerSlot,
            isAvailable: true,
          });
        }

        // Advance by slot duration
        const nextHour = slotStart.getTime() + config.slotDurationMinutes * 60 * 1000;
        const nextDate = new Date(nextHour);
        hour = nextDate.getHours() + nextDate.getMinutes() / 60;
        if (hour >= config.endHour) break;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  if (slotRows.length === 0) {
    return NextResponse.json({ message: "No slots to generate for the given period.", created: 0 });
  }

  // Batch insert with conflict do-nothing (idempotent)
  const BATCH = 50;
  let created = 0;
  for (let i = 0; i < slotRows.length; i += BATCH) {
    const batch = slotRows.slice(i, i + BATCH);
    await db.insert(appointmentSlots).values(batch).onConflictDoNothing();
    created += batch.length;
  }

  return NextResponse.json({
    message: `Generated ${created} slots for ${days} days starting ${startDate.toISOString().slice(0, 10)}.`,
    created,
    fromDate: startDate.toISOString().slice(0, 10),
    toDate: endDate.toISOString().slice(0, 10),
  });
});
