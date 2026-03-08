import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

const updateHospitalSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  addressLine1: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const { id } = await params;
  const payload = await req.json();
  const parsed = updateHospitalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.name) {
    updateData.slug = slugify(parsed.data.name);
  }

  const [updated] = await db
    .update(hospitals)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(hospitals.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "hospital.update",
    entityType: "hospital",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: parsed.data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  const [updated] = await db
    .update(hospitals)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(hospitals.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "hospital.deactivate",
    entityType: "hospital",
    entityId: id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}

