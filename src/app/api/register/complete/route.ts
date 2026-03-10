import { and, eq, gt } from "drizzle-orm";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitalAccounts, hospitals, otpVerifications } from "@/db/schema";
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
      website: z.string().url().optional(),
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

    await db.insert(hospitalAccounts).values({
      hospitalId: finalHospitalId,
      email,
      phone,
      contactName,
      designation: designation ?? null,
      otpVerified: true,
      packageTier: "free",
    });

    await db
      .update(hospitals)
      .set({
        claimed: true,
        regStatus: "active",
        packageTier: "free",
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, finalHospitalId));

    await db.delete(otpVerifications).where(eq(otpVerifications.id, otpId));

    return NextResponse.json({
      success: true,
      hospitalId: finalHospitalId,
      dashboardUrl: `/admin/hospital/${finalHospitalId}`,
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


