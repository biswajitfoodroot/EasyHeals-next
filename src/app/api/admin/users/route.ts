import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, roles, userEntityPermissions, userRoleMap, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

// Indian phone: 10 digits optionally prefixed with +91 or 0
const PHONE_RE = /^(\+91|0)?[6-9]\d{9}$/;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "admin_manager"]);
  if (forbidden) return forbidden;

  // Lightweight entity options mode — for admin dropdowns
  if (req.nextUrl.searchParams.get("entityOptionsOnly") === "1") {
    const doctorRows = await db
      .select({ id: doctors.id, fullName: doctors.fullName })
      .from(doctors)
      .where(eq(doctors.isActive, true))
      .orderBy(doctors.fullName);
    return NextResponse.json({ doctors: doctorRows });
  }

  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      entityType: users.entityType,
      entityId: users.entityId,
      kycStatus: users.kycStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  const roleRows = await db
    .select({ userId: userRoleMap.userId, roleCode: roles.code })
    .from(userRoleMap)
    .innerJoin(roles, eq(roles.id, userRoleMap.roleId));

  const roleMap = new Map<string, string>();
  for (const r of roleRows) roleMap.set(r.userId, r.roleCode);

  // Fetch entity names
  const hospitalRows = await db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals);
  const doctorRows = await db.select({ id: doctors.id, fullName: doctors.fullName }).from(doctors);
  const hospitalNameMap = new Map(hospitalRows.map((h) => [h.id, h.name]));
  const doctorNameMap = new Map(doctorRows.map((d) => [d.id, d.fullName]));

  // Fetch multi-entity permissions
  const permRows = await db
    .select({
      userId: userEntityPermissions.userId,
      entityType: userEntityPermissions.entityType,
      entityId: userEntityPermissions.entityId,
      isPrimary: userEntityPermissions.isPrimary,
    })
    .from(userEntityPermissions);
  const permMap = new Map<string, typeof permRows>();
  for (const p of permRows) {
    if (!permMap.has(p.userId)) permMap.set(p.userId, []);
    permMap.get(p.userId)!.push(p);
  }

  const result = userRows.map((u) => {
    let entityName: string | null = null;
    if (u.entityType === "hospital" && u.entityId) {
      entityName = hospitalNameMap.get(u.entityId) ?? null;
    } else if (u.entityType === "doctor" && u.entityId) {
      entityName = doctorNameMap.get(u.entityId) ?? null;
    }
    // Enrich entity permissions with names
    const entityPermissions = (permMap.get(u.id) ?? []).map((p) => ({
      ...p,
      entityName:
        p.entityType === "hospital"
          ? (hospitalNameMap.get(p.entityId) ?? p.entityId)
          : (doctorNameMap.get(p.entityId) ?? p.entityId),
    }));
    return { ...u, role: roleMap.get(u.id) ?? "viewer", entityName, entityPermissions };
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
  phone: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_RE.test(v.replace(/\s/g, "")), {
      message: "Invalid Indian phone number",
    }),
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

  // Set kycStatus based on role
  const providerRoles = ["hospital_admin", "doctor"];
  const kycStatus = providerRoles.includes(roleCode) ? "pending" : "not_required";

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
    kycStatus,
  });

  await db.insert(userRoleMap).values({ userId, roleId: roleRow[0].id });

  // Also insert into user_entity_permissions for multi-entity support
  if (entityType && entityId) {
    await db.insert(userEntityPermissions).values({
      id: crypto.randomUUID(),
      userId,
      entityType,
      entityId,
      isPrimary: true,
      permissions: "edit",
    });
  }

  return NextResponse.json({ data: { id: userId, fullName, email, role: roleCode, kycStatus } }, { status: 201 });
}
