import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { phiSafeChanges, writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { parseStringArray } from "@/lib/profiles";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  let hospitalId = auth.entityId;

  // Admin/owner/advisor can pass ?hospitalId=xxx
  if (auth.role !== "hospital_admin") {
    const url = new URL(req.url);
    const qid = url.searchParams.get("hospitalId");
    if (qid) hospitalId = qid;
  }

  if (!hospitalId) {
    return NextResponse.json({ error: "No linked hospital" }, { status: 400 });
  }

  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.select().from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  if (!rows.length) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  return NextResponse.json({ data: rows[0] });
}

const patchSchema = z.object({
  // Basic Info
  name: z.string().min(2).max(200).optional(),
  type: z.string().max(50).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  // Contact
  phone: z.string().max(20).nullable().optional(),
  phones: z.array(z.string()).optional(),
  email: z.string().email("Invalid email address").nullable().optional(),
  emailIds: z.array(z.string()).optional(),
  website: z
    .string()
    .url("Invalid website URL")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  whatsappBusinessNumber: z.string().max(20).nullable().optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  // Location
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  addressLine1: z.string().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  // Services
  specialties: z.array(z.string()).optional(),
  facilities: z.array(z.string()).optional(),
  accreditations: z.array(z.string()).optional(),
  workingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  feesRange: z.record(z.string(), z.unknown()).nullable().optional(),
  // Settings
  slotDurationMinutes: z.number().int().min(5).max(120).nullable().optional(),
  maxDailyAppointments: z.number().int().min(1).nullable().optional(),
  queueEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  let hospitalId = auth.entityId;

  if (auth.role !== "hospital_admin") {
    const url = new URL(req.url);
    const qid = url.searchParams.get("hospitalId");
    if (qid) hospitalId = qid;
  }

  if (!hospitalId) {
    return NextResponse.json({ error: "No linked hospital" }, { status: 400 });
  }

  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const updates: Partial<typeof hospitals.$inferInsert> = { updatedAt: new Date(Date.now()) };

  // Basic Info
  if (d.name !== undefined) updates.name = d.name;
  if (d.type !== undefined) updates.type = d.type ?? "hospital";
  if (d.description !== undefined) updates.description = d.description;
  // Contact
  if (d.phone !== undefined) updates.phone = d.phone;
  if (d.phones !== undefined) updates.phones = d.phones;
  if (d.email !== undefined) updates.email = d.email;
  if (d.emailIds !== undefined) updates.emailIds = d.emailIds;
  if (d.website !== undefined) updates.website = d.website;
  if (d.whatsappBusinessNumber !== undefined) updates.whatsappBusinessNumber = d.whatsappBusinessNumber;
  if (d.contactPerson !== undefined) updates.contactPerson = d.contactPerson;
  if (d.contactPhone !== undefined) updates.contactPhone = d.contactPhone;
  if (d.contactEmail !== undefined) updates.contactEmail = d.contactEmail;
  // Location
  if (d.city !== undefined) updates.city = d.city ?? "";
  if (d.state !== undefined) updates.state = d.state;
  if (d.country !== undefined) updates.country = d.country ?? "India";
  if (d.addressLine1 !== undefined) updates.addressLine1 = d.addressLine1;
  if (d.latitude !== undefined) updates.latitude = d.latitude;
  if (d.longitude !== undefined) updates.longitude = d.longitude;
  // Services
  if (d.specialties !== undefined) updates.specialties = parseStringArray(d.specialties);
  if (d.facilities !== undefined) updates.facilities = parseStringArray(d.facilities);
  if (d.accreditations !== undefined) updates.accreditations = parseStringArray(d.accreditations);
  if (d.workingHours !== undefined) updates.workingHours = d.workingHours;
  if (d.feesRange !== undefined) updates.feesRange = d.feesRange;
  // Settings
  if (d.slotDurationMinutes !== undefined) updates.slotDurationMinutes = d.slotDurationMinutes;
  if (d.maxDailyAppointments !== undefined) updates.maxDailyAppointments = d.maxDailyAppointments;
  if (d.queueEnabled !== undefined) updates.queueEnabled = d.queueEnabled;

  await db.update(hospitals).set(updates).where(eq(hospitals.id, hospitalId));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "portal.hospital.update",
    entityType: "hospital",
    entityId: hospitalId,
    changes: phiSafeChanges(parsed.data),
  });

  const rows = await db.select().from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  return NextResponse.json({ data: rows[0] });
}
