import { and, eq, gt, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { roles, sessions, userRoleMap, users } from "@/db/schema";
import { SESSION_COOKIE, hashSessionToken } from "@/lib/session";

/** Roles that require TOTP verification on every session (HLD §8.2 G-TOTP gate). */
const TOTP_REQUIRED_ROLES: RoleCode[] = ["owner", "admin"];

export type RoleCode = "owner" | "admin" | "advisor" | "viewer" | "hospital_admin" | "doctor" | "contributor" | "receptionist";

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  role: RoleCode;
  entityType: string | null;
  entityId: string | null;
  totpEnabled: boolean;
  totpVerified: boolean; // true if session.totpVerifiedAt is set
};

async function findSession(
  sessionToken: string,
  skipTotpCheck = false
): Promise<{ auth: AuthContext | null; totpRequired?: boolean }> {
  const tokenHash = hashSessionToken(sessionToken);

  const row = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      roleCode: roles.code,
      entityType: users.entityType,
      entityId: users.entityId,
      totpEnabled: users.totpEnabled,
      totpVerifiedAt: sessions.totpVerifiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userRoleMap, eq(userRoleMap.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoleMap.roleId))
    .where(and(eq(sessions.sessionToken, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row.length) return { auth: null };

  const record = row[0];
  const validRoles: RoleCode[] = ["owner", "admin", "advisor", "viewer", "hospital_admin", "doctor", "contributor", "receptionist"];
  const role = validRoles.includes(record.roleCode as RoleCode) ? (record.roleCode as RoleCode) : "viewer";

  const totpEnabled = record.totpEnabled ?? false;
  const totpVerified = record.totpVerifiedAt != null;

  // TOTP gate: owner/admin with totpEnabled=true must have verified TOTP for this session
  if (!skipTotpCheck && TOTP_REQUIRED_ROLES.includes(role) && totpEnabled && !totpVerified) {
    return { auth: null, totpRequired: true };
  }

  return {
    auth: {
      userId: record.userId,
      email: record.email,
      fullName: record.fullName,
      role,
      entityType: record.entityType ?? null,
      entityId: record.entityId ?? null,
      totpEnabled,
      totpVerified,
    },
  };
}

export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;
  const { auth } = await findSession(sessionToken);
  return auth;
}

export async function getAuthFromCookies(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;
  const { auth } = await findSession(sessionToken);
  return auth;
}

export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { auth, totpRequired } = await findSession(sessionToken);

  if (totpRequired) {
    return NextResponse.json(
      { error: "TOTP verification required", code: "AUTH_TOTP_REQUIRED" },
      { status: 401 }
    );
  }

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  return auth;
}

/**
 * Auth check that skips the TOTP gate — used ONLY by TOTP setup + enroll routes,
 * where the user is authenticated via password but TOTP is not yet configured.
 */
export async function requireAuthNoTOTP(req: NextRequest): Promise<AuthContext | NextResponse> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { auth } = await findSession(sessionToken, true /* skipTotpCheck */);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  return auth;
}
