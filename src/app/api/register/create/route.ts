/**
 * POST /api/register/create
 * Authenticated (Google session) — creates a new hospital/clinic/diagnostic/nursing_home
 * and upgrades the user to hospital_admin with entity link.
 * Phone is required but not OTP-verified (user is Google-verified instead).
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals, roles, userRoleMap, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { slugify } from "@/lib/strings";

const bodySchema = z.object({
  name: z.string().min(2).max(180),
  city: z.string().min(2).max(80),
  state: z.string().max(80).optional(),
  addressLine1: z.string().max(240).optional(),
  type: z.enum(["hospital", "clinic", "diagnostic", "nursing_home"]).default("hospital"),
  website: z
    .string()
    .optional()
    .transform((v) => {
      if (!v?.trim()) return undefined;
      const t = v.trim();
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    })
    .pipe(z.string().url().optional()),
  contactName: z.string().min(2).max(120),
  designation: z.string().max(120).optional(),
  phone: z.string().min(10).max(15),
  acknowledgedDuplicate: z.boolean().optional().default(false),
});

async function uniqueHospitalSlug(baseName: string, city: string) {
  const baseSlug = slugify(`${baseName}-${city}`);
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const row = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!row.length) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as unknown;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, city, state, addressLine1, type, website, contactName, designation, phone } = parsed.data;

  const slug = await uniqueHospitalSlug(name, city);

  const [created] = await db
    .insert(hospitals)
    .values({
      name,
      slug,
      city,
      state: state ?? null,
      addressLine1: addressLine1 ?? null,
      type,
      isPrivate: true,
      website: website ?? null,
      source: "self_reg",
      regStatus: "active",
      packageTier: "free",
      claimed: true,
      verified: false,
      communityVerified: false,
    })
    .returning({ id: hospitals.id });

  const hospitalId = created.id;

  // Link the Google-auth user to this hospital
  await db
    .update(users)
    .set({
      fullName: contactName,
      entityType: "hospital",
      entityId: hospitalId,
      phone: phone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  // Ensure hospital_admin role exists and assign it
  let roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, "hospital_admin")).limit(1);

  if (!roleRow.length) {
    const [inserted] = await db
      .insert(roles)
      .values({ code: "hospital_admin", label: "Hospital Administrator" })
      .returning({ id: roles.id });
    roleRow = [inserted];
  }

  const existingRoleMap = await db
    .select({ id: userRoleMap.id })
    .from(userRoleMap)
    .where(and(eq(userRoleMap.userId, auth.userId), eq(userRoleMap.roleId, roleRow[0].id)))
    .limit(1);

  if (!existingRoleMap.length) {
    await db.insert(userRoleMap).values({ userId: auth.userId, roleId: roleRow[0].id });
  }

  // Store designation in hospital_accounts if available (graceful, no hard fail)
  if (designation) {
    try {
      const { hospitalAccounts } = await import("@/db/schema");
      await db.insert(hospitalAccounts).values({
        hospitalId,
        email: auth.email ?? "",
        phone,
        contactName,
        designation,
        otpVerified: true,
        packageTier: "free",
      }).onConflictDoNothing();
    } catch {
      // non-critical — user + hospital are created
    }
  }

  return NextResponse.json({
    success: true,
    hospitalId,
    slug,
    dashboardUrl: "/portal/hospital?welcome=1",
  }, { status: 201 });
}
