import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals, packages, hospitalSubscriptions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog, phiSafeChanges } from "@/lib/audit";

// Editor roles: can update content/profile fields
const EDITOR_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "operator"];
// Manager roles: additionally allowed to change status, visibility, tier
const MANAGER_ROLES = ["owner", "admin", "admin_manager"];

// Empty string → null coercion for optional URL/email fields.
// We avoid strict URL/email format validation here because admin-entered data
// often lacks https:// prefixes or uses non-standard domains; validate at the
// UI layer instead.
const nullableUrl = z
  .string()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v ?? null));

const nullableEmail = z
  .string()
  .max(320)
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v ?? null));

const updateSchema = z.object({
  // ── Overview ──────────────────────────────────────────────────────────────
  name: z.string().min(2).max(200).optional(),
  type: z.enum(["hospital", "clinic", "nursing_home", "diagnostic_centre", "pharmacy", "other"]).optional(),
  description: z.string().max(5000).nullable().optional(),

  // ── Contact ───────────────────────────────────────────────────────────────
  phone: z.string().max(30).nullable().optional(),
  phones: z.array(z.string().max(30)).max(5).optional(),
  email: nullableEmail,
  emailIds: z.array(z.string().email()).max(5).optional(),
  website: nullableUrl,
  whatsappBusinessNumber: z.string().max(30).nullable().optional(),

  // ── Contact person ────────────────────────────────────────────────────────
  contactPerson: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactEmail: nullableEmail,

  // ── Location ──────────────────────────────────────────────────────────────
  addressLine1: z.string().max(300).nullable().optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().max(100).nullable().optional(),
  country: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),

  // ── Medical profile ───────────────────────────────────────────────────────
  specialties: z.array(z.string().max(100)).max(200).optional(),
  facilities: z.array(z.string().max(100)).max(100).optional(),
  accreditations: z.array(z.string().max(100)).max(20).optional(),
  workingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  feesRange: z.record(z.string(), z.unknown()).nullable().optional(),

  // ── Operational settings ──────────────────────────────────────────────────
  slotDurationMinutes: z.number().int().min(1).max(480).nullable().optional(),
  maxDailyAppointments: z.number().int().min(1).nullable().optional(),
  queueEnabled: z.boolean().optional(),

  // ── Status (manager-only) ─────────────────────────────────────────────────
  isActive: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  verified: z.boolean().optional(),
  packageTier: z.enum(["free", "pro", "business", "enterprise"]).optional(),
  regStatus: z.enum(["pending", "approved", "rejected", "suspended"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!EDITOR_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Status / visibility / tier changes require manager role
  const hasStatusChange =
    d.isActive !== undefined ||
    d.isPrivate !== undefined ||
    d.verified !== undefined ||
    d.packageTier !== undefined ||
    d.regStatus !== undefined;

  if (hasStatusChange && !MANAGER_ROLES.includes(auth.role)) {
    return NextResponse.json(
      { error: "Changing status, visibility, or tier requires manager role." },
      { status: 403 },
    );
  }

  const [existing] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  // Build update payload from defined fields only
  const updates: Partial<typeof hospitals.$inferInsert> = { updatedAt: new Date() };
  if (d.name !== undefined) updates.name = d.name;
  if (d.type !== undefined) updates.type = d.type;
  if (d.description !== undefined) updates.description = d.description;
  if (d.phone !== undefined) updates.phone = d.phone;
  if (d.phones !== undefined) updates.phones = d.phones;
  if (d.email !== undefined) updates.email = d.email;
  if (d.emailIds !== undefined) updates.emailIds = d.emailIds;
  if (d.website !== undefined) updates.website = d.website;
  if (d.whatsappBusinessNumber !== undefined) updates.whatsappBusinessNumber = d.whatsappBusinessNumber;
  if (d.contactPerson !== undefined) updates.contactPerson = d.contactPerson;
  if (d.contactPhone !== undefined) updates.contactPhone = d.contactPhone;
  if (d.contactEmail !== undefined) updates.contactEmail = d.contactEmail;
  if (d.addressLine1 !== undefined) updates.addressLine1 = d.addressLine1;
  if (d.city !== undefined) updates.city = d.city;
  if (d.state !== undefined) updates.state = d.state;
  if (d.country !== undefined) updates.country = d.country;
  if (d.latitude !== undefined) updates.latitude = d.latitude;
  if (d.longitude !== undefined) updates.longitude = d.longitude;
  if (d.specialties !== undefined) updates.specialties = d.specialties;
  if (d.facilities !== undefined) updates.facilities = d.facilities;
  if (d.accreditations !== undefined) updates.accreditations = d.accreditations;
  if (d.workingHours !== undefined) updates.workingHours = d.workingHours;
  if (d.feesRange !== undefined) updates.feesRange = d.feesRange;
  if (d.slotDurationMinutes !== undefined) updates.slotDurationMinutes = d.slotDurationMinutes;
  if (d.maxDailyAppointments !== undefined) updates.maxDailyAppointments = d.maxDailyAppointments;
  if (d.queueEnabled !== undefined) updates.queueEnabled = d.queueEnabled;
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  if (d.isPrivate !== undefined) updates.isPrivate = d.isPrivate;
  if (d.verified !== undefined) updates.verified = d.verified;
  if (d.packageTier !== undefined) updates.packageTier = d.packageTier;
  if (d.regStatus !== undefined) updates.regStatus = d.regStatus;

  await db.update(hospitals).set(updates).where(eq(hospitals.id, id));

  // Build field-level diff for audit log
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(updates)) {
    if (key === "updatedAt") continue;
    const before = (existing as Record<string, unknown>)[key];
    const after = (updates as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes[key] = { from: before, to: after };
    }
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "provider_management.hospital.update",
    entityType: "hospital",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: phiSafeChanges(changes),
  });

  // Sync hospitalSubscriptions when packageTier changes
  if (d.packageTier !== undefined) {
    try {
      const [pkg] = await db
        .select({ id: packages.id })
        .from(packages)
        .where(eq(packages.code, d.packageTier))
        .limit(1);

      if (pkg) {
        const [existingSub] = await db
          .select({ id: hospitalSubscriptions.id })
          .from(hospitalSubscriptions)
          .where(eq(hospitalSubscriptions.hospitalId, id))
          .limit(1);

        if (existingSub) {
          await db
            .update(hospitalSubscriptions)
            .set({ packageId: pkg.id, status: "active" })
            .where(eq(hospitalSubscriptions.id, existingSub.id));
        } else {
          await db.insert(hospitalSubscriptions).values({
            hospitalId: id,
            packageId: pkg.id,
            status: "active",
            startsAt: new Date(),
          });
        }
      }
    } catch {
      // Non-fatal: subscription sync is best-effort
    }
  }

  return NextResponse.json({ ok: true, id });
}
