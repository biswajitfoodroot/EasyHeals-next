import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, coordinatorPermissions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const ADMIN_ROLES = ["owner", "admin"];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all coordinator users
  const coordinators = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isActive, true));

  // Filter to coordinators only (role is stored in user record but also need a join)
  // Since role is not on users table directly, we filter by those with coordinator_permissions
  const allPerms = await db.select().from(coordinatorPermissions);
  const permsMap = new Map(allPerms.map(p => [p.userId, p]));

  // Get all coordinator role users — query via sessions/role check is complex;
  // instead return users who have coordinator_permissions records + all active users for adding
  const coordUsers = coordinators.filter(u =>
    permsMap.has(u.id)
  );

  // Also return all potential coordinator users (isActive, so owner can create permissions for them)
  const allUsers = coordinators.map(u => ({
    ...u,
    permissions: permsMap.get(u.id) ?? null,
  }));

  return NextResponse.json({ data: allUsers, permsMap: Object.fromEntries(permsMap) });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    userId?: string;
    canViewKpis?: boolean;
    canViewProviders?: boolean;
    canEditProviders?: boolean;
    canViewAgreements?: boolean;
    canEditAgreements?: boolean;
    canViewKyc?: boolean;
    canApproveKyc?: boolean;
    canViewUsers?: boolean;
    canManageUsers?: boolean;
    notes?: string;
  } | null;

  if (!body?.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const [existing] = await db
    .select({ id: coordinatorPermissions.id })
    .from(coordinatorPermissions)
    .where(eq(coordinatorPermissions.userId, body.userId))
    .limit(1);

  const values = {
    canViewKpis: body.canViewKpis ?? false,
    canViewProviders: body.canViewProviders ?? true,
    canEditProviders: body.canEditProviders ?? false,
    canViewAgreements: body.canViewAgreements ?? true,
    canEditAgreements: body.canEditAgreements ?? false,
    canViewKyc: body.canViewKyc ?? true,
    canApproveKyc: body.canApproveKyc ?? false,
    canViewUsers: body.canViewUsers ?? false,
    canManageUsers: body.canManageUsers ?? false,
    notes: body.notes ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(coordinatorPermissions).set(values).where(eq(coordinatorPermissions.userId, body.userId));
  } else {
    await db.insert(coordinatorPermissions).values({ userId: body.userId, ...values });
  }

  return NextResponse.json({ ok: true });
}
