/**
 * GET  /api/v1/provider/staff  — list staff for the provider
 * POST /api/v1/provider/staff  — add/invite a staff member
 *
 * Auth: hospital_admin (own hospital), owner/admin
 * Body (POST): { email, fullName, subRole: "receptionist"|"billing", doctorId? }
 */

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { providerStaff, roles, userRoleMap, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const addStaffSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  subRole: z.enum(["receptionist", "billing"]).default("receptionist"),
  password: z.string().min(8).max(100),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin"]);
  if (forbidden) return forbidden;

  const providerId =
    auth.role === "hospital_admin"
      ? auth.entityId
      : new URL(req.url).searchParams.get("providerId");

  if (!providerId) {
    throw new AppError("SYS_UNHANDLED", "Missing providerId", "providerId is required.", 400);
  }

  const rows = await db
    .select({
      id: providerStaff.id,
      subRole: providerStaff.subRole,
      isActive: providerStaff.isActive,
      createdAt: providerStaff.createdAt,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
    })
    .from(providerStaff)
    .innerJoin(users, eq(users.id, providerStaff.userId))
    .where(eq(providerStaff.providerId, providerId));

  return NextResponse.json({ data: rows });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin"]);
  if (forbidden) return forbidden;

  const providerId =
    auth.role === "hospital_admin" ? auth.entityId : null;

  if (!providerId) {
    const body = await req.json().catch(() => ({})) as { providerId?: string };
    if (!body.providerId) {
      throw new AppError("SYS_UNHANDLED", "Missing providerId", "providerId required for admin.", 400);
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = addStaffSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const { email, fullName, subRole, password } = parsed.data;
  const effectiveProviderId = auth.role === "hospital_admin" ? auth.entityId! : (body as any).providerId as string;

  // Upsert user
  let userId: string;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    userId = existing[0].id;
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(users)
      .values({ email, fullName, passwordHash, isActive: true })
      .returning({ id: users.id });
    userId = newUser.id;

    // Assign receptionist role
    const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, "receptionist")).limit(1);
    if (roleRow.length) {
      await db.insert(userRoleMap).values({ userId, roleId: roleRow[0].id }).onConflictDoNothing();
    }
  }

  // Add to provider_staff (upsert)
  await db
    .insert(providerStaff)
    .values({
      providerId: effectiveProviderId,
      userId,
      subRole,
      isActive: true,
      invitedBy: auth.userId,
    })
    .onConflictDoUpdate({
      target: [providerStaff.providerId, providerStaff.userId],
      set: { subRole, isActive: true },
    });

  return NextResponse.json({ data: { userId, email, fullName, subRole } }, { status: 201 });
});
