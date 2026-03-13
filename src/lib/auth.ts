import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { roles, sessions, userRoleMap, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/session";

export type RoleCode = "owner" | "admin" | "advisor" | "viewer" | "hospital_admin" | "doctor" | "contributor";

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  role: RoleCode;
  entityType: string | null;
  entityId: string | null;
};

async function findSession(sessionToken: string): Promise<AuthContext | null> {
  const row = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      roleCode: roles.code,
      entityType: users.entityType,
      entityId: users.entityId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userRoleMap, eq(userRoleMap.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoleMap.roleId))
    .where(and(eq(sessions.sessionToken, sessionToken), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row.length) {
    return null;
  }

  const record = row[0];
  const validRoles: RoleCode[] = ["owner", "admin", "advisor", "viewer", "hospital_admin", "doctor", "contributor"];
  const role = validRoles.includes(record.roleCode as RoleCode)
    ? (record.roleCode as RoleCode)
    : "viewer";

  return {
    userId: record.userId,
    email: record.email,
    fullName: record.fullName,
    role,
    entityType: record.entityType ?? null,
    entityId: record.entityId ?? null,
  };
}

export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;
  return findSession(sessionToken);
}

export async function getAuthFromCookies(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;
  return findSession(sessionToken);
}

export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const auth = await getAuthContext(req);

  if (!auth) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  return auth;
}

