/**
 * GET /api/v1/provider/schedule  — get working hours config + upcoming slots
 * PUT /api/v1/provider/schedule  — update working hours + slot duration
 *
 * Auth: hospital_admin / doctor (own entity), owner/admin
 *
 * Working hours config is stored in systemConfig as JSON keyed by entityId.
 * Slots are read from appointment_slots table.
 */

import { and, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointmentSlots, systemConfig } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const SCHEDULE_CONFIG_KEY = (entityId: string) => `provider_schedule_${entityId}`;

interface ScheduleConfig {
  startHour: number;        // e.g. 9
  endHour: number;          // e.g. 17
  slotDurationMinutes: number; // 15 | 20 | 30 | 45 | 60
  daysOfWeek: number[];     // 0=Sun … 6=Sat
  capacityPerSlot: number;  // 1–10
  breakStart?: number;      // optional break start hour
  breakEnd?: number;
}

const scheduleSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  slotDurationMinutes: z.number().int().refine((n) => [15, 20, 30, 45, 60].includes(n)),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  capacityPerSlot: z.number().int().min(1).max(10).default(1),
  breakStart: z.number().int().min(0).max(23).optional(),
  breakEnd: z.number().int().min(1).max(24).optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const entityId =
    auth.role === "hospital_admin" || auth.role === "doctor"
      ? auth.entityId
      : new URL(req.url).searchParams.get("entityId");

  if (!entityId) {
    throw new AppError("SYS_UNHANDLED", "Missing entityId", "entityId is required.", 400);
  }

  const key = SCHEDULE_CONFIG_KEY(entityId);
  const [configRow] = await db.select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, key)).limit(1);

  const config: ScheduleConfig = configRow?.value
    ? (JSON.parse(configRow.value) as ScheduleConfig)
    : { startHour: 9, endHour: 17, slotDurationMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5], capacityPerSlot: 1 };

  // Return upcoming slots (next 7 days)
  const now = new Date();
  const slots = await db
    .select({
      id: appointmentSlots.id,
      startsAt: appointmentSlots.startsAt,
      endsAt: appointmentSlots.endsAt,
      isBooked: appointmentSlots.isBooked,
    })
    .from(appointmentSlots)
    .where(and(
      eq(appointmentSlots.hospitalId, entityId),
      gte(appointmentSlots.startsAt, now),
    ))
    .limit(200);

  return NextResponse.json({ data: { config, slots } });
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const entityId =
    auth.role === "hospital_admin" || auth.role === "doctor"
      ? auth.entityId
      : null;

  if (!entityId) {
    throw new AppError("SYS_UNHANDLED", "Missing entityId", "entityId required for admin.", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid schedule", 400);
  }

  const key = SCHEDULE_CONFIG_KEY(entityId);
  await db
    .insert(systemConfig)
    .values({ key, value: JSON.stringify(parsed.data), updatedBy: auth.userId })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: JSON.stringify(parsed.data), updatedBy: auth.userId },
    });

  return NextResponse.json({ data: { entityId, config: parsed.data } });
});
