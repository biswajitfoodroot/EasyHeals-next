/**
 * GET  /api/portal/entity-permissions  — list all entity links for the caller
 * POST /api/portal/entity-permissions  — add a new entity link (self-service, pending admin approval)
 * DELETE /api/portal/entity-permissions?id=<permId> — remove a link (owner / admin only)
 */
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, userEntityPermissions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Admin can query any user, provider sees only their own
  const url = new URL(req.url);
  const targetUserId =
    ["owner", "admin", "admin_manager"].includes(auth.role)
      ? (url.searchParams.get("userId") ?? auth.userId)
      : auth.userId;

  const perms = await db
    .select()
    .from(userEntityPermissions)
    .where(eq(userEntityPermissions.userId, targetUserId));

  // Enrich with entity names
  const hospitalIds = perms.filter((p) => p.entityType === "hospital").map((p) => p.entityId);
  const doctorIds = perms.filter((p) => p.entityType === "doctor").map((p) => p.entityId);

  const hNames = hospitalIds.length
    ? await db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals)
    : [];
  const dNames = doctorIds.length
    ? await db.select({ id: doctors.id, fullName: doctors.fullName }).from(doctors)
    : [];

  const hMap = new Map(hNames.map((h) => [h.id, h.name]));
  const dMap = new Map(dNames.map((d) => [d.id, d.fullName]));

  const enriched = perms.map((p) => ({
    ...p,
    entityName:
      p.entityType === "hospital"
        ? (hMap.get(p.entityId) ?? p.entityId)
        : (dMap.get(p.entityId) ?? p.entityId),
  }));

  return NextResponse.json({ data: enriched });
}

const addSchema = z.object({
  entityType: z.enum(["hospital", "doctor"]),
  entityId: z.string().uuid("Must be a valid entity UUID"),
  isPrimary: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, [
    "owner", "admin", "admin_manager", "hospital_admin", "doctor",
  ]);
  if (forbidden) return forbidden;

  const body = await req.json() as unknown;
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { entityType, entityId, isPrimary } = parsed.data;

  // Verify entity exists
  if (entityType === "hospital") {
    const [h] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, entityId)).limit(1);
    if (!h) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  } else {
    const [d] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, entityId)).limit(1);
    if (!d) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  // If setting as primary, clear existing primaries of same type for this user
  if (isPrimary) {
    await db
      .update(userEntityPermissions)
      .set({ isPrimary: false })
      .where(
        and(
          eq(userEntityPermissions.userId, auth.userId),
          eq(userEntityPermissions.entityType, entityType),
        ),
      );
  }

  const id = crypto.randomUUID();
  await db.insert(userEntityPermissions).values({
    id,
    userId: auth.userId,
    entityType,
    entityId,
    isPrimary: isPrimary ?? false,
    permissions: "edit",
  });

  return NextResponse.json({ data: { id, entityType, entityId, isPrimary } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const permId = req.nextUrl.searchParams.get("id");
  if (!permId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const [perm] = await db
    .select()
    .from(userEntityPermissions)
    .where(eq(userEntityPermissions.id, permId))
    .limit(1);

  if (!perm) return NextResponse.json({ error: "Permission not found" }, { status: 404 });

  // Owner / admin can delete any; provider can only delete their own
  const isAdmin = ["owner", "admin", "admin_manager"].includes(auth.role);
  if (!isAdmin && perm.userId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(userEntityPermissions).where(eq(userEntityPermissions.id, permId));
  return NextResponse.json({ data: { deleted: true } });
}
