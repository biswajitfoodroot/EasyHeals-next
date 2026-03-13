import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { roles, sessions, userRoleMap, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roleCode: z.string().optional(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  const body = await req.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { fullName, email, password, roleCode, entityType, entityId, isActive } = parsed.data;

  // Check user exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates: Partial<typeof users.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (email !== undefined) updates.email = email;
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);
  if (entityType !== undefined) updates.entityType = entityType;
  if (entityId !== undefined) updates.entityId = entityId;
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, id));
  }

  if (roleCode !== undefined) {
    const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
    if (!roleRow.length) {
      return NextResponse.json({ error: "Role not found" }, { status: 400 });
    }
    // Delete existing role mapping and re-create
    await db.delete(userRoleMap).where(eq(userRoleMap.userId, id));
    await db.insert(userRoleMap).values({ userId: id, roleId: roleRow[0].id });
  }

  return NextResponse.json({ data: { id, updated: true } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  // Check user exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Hard delete: sessions -> roleMap -> user
  await db.delete(sessions).where(eq(sessions.userId, id));
  await db.delete(userRoleMap).where(eq(userRoleMap.userId, id));
  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ data: { id, deleted: true } });
}
