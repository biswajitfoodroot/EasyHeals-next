import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
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
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  workingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  specialties: z.array(z.string()).optional(),
  facilities: z.array(z.string()).optional(),
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

  const { phone, email, website, addressLine1, description, workingHours, specialties, facilities } = parsed.data;

  const updates: Partial<typeof hospitals.$inferInsert> = {
    updatedAt: new Date(Date.now()),
  };
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (website !== undefined) updates.website = website;
  if (addressLine1 !== undefined) updates.addressLine1 = addressLine1;
  if (description !== undefined) updates.description = description;
  if (workingHours !== undefined) updates.workingHours = workingHours;
  if (specialties !== undefined) updates.specialties = parseStringArray(specialties);
  if (facilities !== undefined) updates.facilities = parseStringArray(facilities);

  await db.update(hospitals).set(updates).where(eq(hospitals.id, hospitalId));

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "portal.hospital.update",
    entityType: "hospital",
    entityId: hospitalId,
    changes: parsed.data,
  });

  const rows = await db.select().from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
  return NextResponse.json({ data: rows[0] });
}
