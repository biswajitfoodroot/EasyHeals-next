import { and, eq, gt } from "drizzle-orm";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitalAccounts, hospitals, otpVerifications, roles, userRoleMap, users } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/session";
import { slugify } from "@/lib/strings";

const requestSchema = z.object({
  otpId: z.string().min(3),
  otp: z.string().length(6),
  phone: z.string().transform((value) => value.replace(/\D/g, "")),
  email: z.string().email(),
  contactName: z.string().min(2).max(120),
  designation: z.string().max(120).optional(),
  hospitalId: z.string().optional(),
  newHospitalData: z
    .object({
      name: z.string().min(2).max(180),
      city: z.string().min(2).max(80),
      state: z.string().max(80).optional(),
      addressLine1: z.string().max(240).optional(),
      type: z.string().max(40).default("hospital"),
      website: z
        .string()
        .optional()
        .transform((v) => {
          if (!v) return undefined;
          const trimmed = v.trim();
          if (!trimmed) return undefined;
          if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
          return trimmed;
        })
        .pipe(z.string().url().optional()),
    })
    .optional(),
});

async function uniqueHospitalSlug(baseName: string) {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const row = await db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(eq(hospitals.slug, slug))
      .limit(1);

    if (!row.length) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { otpId, otp, phone, email, contactName, designation, hospitalId, newHospitalData } = parsed.data;

    const otpHash = createHash("sha256").update(otp).digest("hex");
    const now = new Date();

    const validOtp = await db
      .select({ id: otpVerifications.id })
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.id, otpId),
          eq(otpVerifications.phone, phone),
          eq(otpVerifications.otpHash, otpHash),
          gt(otpVerifications.expiresAt, now),
        ),
      )
      .limit(1);

    if (!validOtp.length) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    let finalHospitalId = hospitalId ?? null;

    if (finalHospitalId) {
      const existingHospital = await db
        .select({ id: hospitals.id })
        .from(hospitals)
        .where(eq(hospitals.id, finalHospitalId))
        .limit(1);

      if (!existingHospital.length) {
        return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
      }
    }

    if (!finalHospitalId) {
      if (!newHospitalData) {
        return NextResponse.json(
          { error: "Either hospitalId or newHospitalData is required" },
          { status: 400 },
        );
      }

      const slug = await uniqueHospitalSlug(`${newHospitalData.name}-${newHospitalData.city}`);

      const [created] = await db
        .insert(hospitals)
        .values({
          name: newHospitalData.name,
          slug,
          city: newHospitalData.city,
          state: newHospitalData.state ?? null,
          addressLine1: newHospitalData.addressLine1 ?? null,
          type: newHospitalData.type,
          isPrivate: true,
          website: newHospitalData.website ?? null,
          source: "self_reg",
          regStatus: "active",
          packageTier: "free",
          claimed: true,
          verified: false,
          communityVerified: false,
        })
        .returning({ id: hospitals.id });

      finalHospitalId = created.id;
    }

    // Check for existing hospital_accounts
    const existingAccount = await db
      .select({ id: hospitalAccounts.id })
      .from(hospitalAccounts)
      .where(eq(hospitalAccounts.email, email))
      .limit(1);

    if (existingAccount.length) {
      return NextResponse.json(
        { error: "Account already exists for this email" },
        { status: 409 },
      );
    }

    // Create hospital_accounts entry
    await db.insert(hospitalAccounts).values({
      hospitalId: finalHospitalId,
      email,
      phone,
      contactName,
      designation: designation ?? null,
      otpVerified: true,
      packageTier: "free",
    });

    // Update hospital claim status
    await db
      .update(hospitals)
      .set({ claimed: true, regStatus: "active", packageTier: "free", updatedAt: new Date() })
      .where(eq(hospitals.id, finalHospitalId));

    // Delete used OTP
    await db.delete(otpVerifications).where(eq(otpVerifications.id, otpId));

    // ── Create portal user account ─────────────────────────────────────────
    // Check if a user account already exists with this email
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;

    if (existingUser.length) {
      userId = existingUser[0].id;
      // Update entity linking in case it was missing
      await db
        .update(users)
        .set({ entityType: "hospital", entityId: finalHospitalId, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          fullName: contactName,
          email,
          entityType: "hospital",
          entityId: finalHospitalId,
          isActive: true,
        })
        .returning({ id: users.id });

      userId = newUser.id;
    }

    // Assign hospital_admin role
    const roleRow = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, "hospital_admin"))
      .limit(1);

    if (roleRow.length) {
      // upsert — ignore if already has this role
      const existingRoleMap = await db
        .select({ id: userRoleMap.id })
        .from(userRoleMap)
        .where(and(eq(userRoleMap.userId, userId), eq(userRoleMap.roleId, roleRow[0].id)))
        .limit(1);

      if (!existingRoleMap.length) {
        await db.insert(userRoleMap).values({ userId, roleId: roleRow[0].id });
      }
    }

    // Create session and set cookie → auto-login
    const { sessionToken, expiresAt } = await createSession(userId);
    await setSessionCookie(sessionToken, expiresAt);

    return NextResponse.json({
      success: true,
      hospitalId: finalHospitalId,
      dashboardUrl: "/portal/hospital?welcome=1",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Registration failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
