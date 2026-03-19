import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, roles, userRoleMap, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      entityType: users.entityType,
      entityId: users.entityId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  const roleRows = await db
    .select({
      userId: userRoleMap.userId,
      roleCode: roles.code,
    })
    .from(userRoleMap)
    .innerJoin(roles, eq(roles.id, userRoleMap.roleId));

  const roleMap = new Map<string, string>();
  for (const r of roleRows) {
    roleMap.set(r.userId, r.roleCode);
  }

  // Fetch entity names
  const hospitalRows = await db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals);
  const doctorRows = await db.select({ id: doctors.id, fullName: doctors.fullName }).from(doctors);

  const hospitalNameMap = new Map(hospitalRows.map((h) => [h.id, h.name]));
  const doctorNameMap = new Map(doctorRows.map((d) => [d.id, d.fullName]));

  const result = userRows.map((u) => {
    let entityName: string | null = null;
    if (u.entityType === "hospital" && u.entityId) {
      entityName = hospitalNameMap.get(u.entityId) ?? null;
    } else if (u.entityType === "doctor" && u.entityId) {
      entityName = doctorNameMap.get(u.entityId) ?? null;
    }
    return {
      ...u,
      role: roleMap.get(u.id) ?? "viewer",
      entityName,
    };
  });

  return NextResponse.json({ data: result });
}

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleCode: z.string().min(1),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const body = await req.json() as unknown;
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { fullName, email, password, roleCode, entityType, entityId } = parsed.data;

  // Check email uniqueness
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Find role
  const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
  if (!roleRow.length) {
    return NextResponse.json({ error: "Role not found" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    fullName,
    email,
    passwordHash,
    isActive: true,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
  });

  await db.insert(userRoleMap).values({
    userId,
    roleId: roleRow[0].id,
  });

  return NextResponse.json({ data: { id: userId, fullName, email, role: roleCode } }, { status: 201 });
}
