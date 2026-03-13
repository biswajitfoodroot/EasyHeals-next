import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { parseStringArray } from "@/lib/profiles";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  let doctorId = auth.entityId;

  if (auth.role !== "doctor") {
    const url = new URL(req.url);
    const qid = url.searchParams.get("doctorId");
    if (qid) doctorId = qid;
  }

  if (!doctorId) {
    return NextResponse.json({ error: "No linked doctor" }, { status: 400 });
  }

  if (auth.role === "doctor" && auth.entityId !== doctorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  if (!rows.length) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  return NextResponse.json({ data: rows[0] });
}

const patchSchema = z.object({
  bio: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  qualifications: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  consultationFee: z.number().nullable().optional(),
  feeMin: z.number().nullable().optional(),
  feeMax: z.number().nullable().optional(),
  consultationHours: z.record(z.string(), z.unknown()).nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  yearsOfExperience: z.number().int().nullable().optional(),
  specialization: z.string().nullable().optional(),
  specialties: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "doctor"]);
  if (forbidden) return forbidden;

  let doctorId = auth.entityId;

  if (auth.role !== "doctor") {
    const url = new URL(req.url);
    const qid = url.searchParams.get("doctorId");
    if (qid) doctorId = qid;
  }

  if (!doctorId) {
    return NextResponse.json({ error: "No linked doctor" }, { status: 400 });
  }

  if (auth.role === "doctor" && auth.entityId !== doctorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    bio, phone, email, qualifications, languages,
    consultationFee, feeMin, feeMax, consultationHours,
    avatarUrl, yearsOfExperience, specialization, specialties,
  } = parsed.data;

  const updates: Partial<typeof doctors.$inferInsert> = {
    updatedAt: new Date(Date.now()),
  };
  if (bio !== undefined) updates.bio = bio;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (qualifications !== undefined) updates.qualifications = parseStringArray(qualifications);
  if (languages !== undefined) updates.languages = parseStringArray(languages);
  if (consultationFee !== undefined) updates.consultationFee = consultationFee;
  if (feeMin !== undefined) updates.feeMin = feeMin;
  if (feeMax !== undefined) updates.feeMax = feeMax;
  if (consultationHours !== undefined) updates.consultationHours = consultationHours;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (yearsOfExperience !== undefined) updates.yearsOfExperience = yearsOfExperience;
  if (specialization !== undefined) updates.specialization = specialization;
  if (specialties !== undefined) updates.specialties = parseStringArray(specialties);

  await db.update(doctors).set(updates).where(eq(doctors.id, doctorId));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "portal.doctor.update",
    entityType: "doctor",
    entityId: doctorId,
    changes: parsed.data,
  });

  const rows = await db.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  return NextResponse.json({ data: rows[0] });
}
