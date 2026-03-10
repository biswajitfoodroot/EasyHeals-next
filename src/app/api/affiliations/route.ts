import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const schema = z.object({
  fromType: z.enum(["doctor", "hospital"]),
  fromId: z.string().min(3),
  toType: z.enum(["doctor", "hospital", "lab"]),
  toId: z.string().min(3),
  role: z.string().min(2).max(80).default("Visiting Consultant"),
  schedule: z.record(z.string(), z.unknown()).optional(),
  feeMin: z.number().nonnegative().optional(),
  feeMax: z.number().nonnegative().optional(),
  source: z.string().min(2).max(40).default("manual"),
  isPrimary: z.boolean().optional().default(false),
});

function resolvePair(input: z.infer<typeof schema>) {
  if (input.fromType === "doctor" && (input.toType === "hospital" || input.toType === "lab")) {
    return { doctorId: input.fromId, hospitalId: input.toId };
  }

  if (input.fromType === "hospital" && input.toType === "doctor") {
    return { doctorId: input.toId, hospitalId: input.fromId };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  try {
    const payload = await req.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid affiliation payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const pair = resolvePair(parsed.data);
    if (!pair) {
      return NextResponse.json({ error: "Unsupported entity mapping" }, { status: 400 });
    }

    const [doctorExists, hospitalExists] = await Promise.all([
      db
        .select({ id: doctors.id })
        .from(doctors)
        .where(and(eq(doctors.id, pair.doctorId), eq(doctors.isActive, true)))
        .limit(1),
      db
        .select({ id: hospitals.id })
        .from(hospitals)
        .where(and(eq(hospitals.id, pair.hospitalId), eq(hospitals.isActive, true)))
        .limit(1),
    ]);

    if (!doctorExists.length || !hospitalExists.length) {
      return NextResponse.json({ error: "Doctor or hospital not found" }, { status: 404 });
    }

    const [row] = await db
      .insert(doctorHospitalAffiliations)
      .values({
        doctorId: pair.doctorId,
        hospitalId: pair.hospitalId,
        role: parsed.data.role,
        schedule: parsed.data.schedule ?? null,
        feeMin: parsed.data.feeMin,
        feeMax: parsed.data.feeMax,
        source: parsed.data.source,
        isPrimary: parsed.data.isPrimary,
        isActive: true,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [doctorHospitalAffiliations.doctorId, doctorHospitalAffiliations.hospitalId],
        set: {
          role: parsed.data.role,
          schedule: parsed.data.schedule ?? null,
          feeMin: parsed.data.feeMin,
          feeMax: parsed.data.feeMax,
          source: parsed.data.source,
          isPrimary: parsed.data.isPrimary,
          isActive: true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to save affiliation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
