/**
 * GET  /api/portal/me  — get current user's own profile
 * PATCH /api/portal/me  — update own name, email, phone, password
 *
 * Available to all authenticated users (hospital_admin, doctor, owner, admin, advisor…)
 * so any portal or admin user can manage their own account.
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const patchSchema = z.object({
  fullName:        z.string().min(1).max(100).optional(),
  email:           z.string().email().optional(),
  phone:           z.string().max(20).nullable().optional(),
  currentPassword: z.string().optional(), // required when changing password
  newPassword:     z.string().min(8).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const [row] = await db
    .select({
      id:        users.id,
      fullName:  users.fullName,
      email:     users.email,
      phone:     users.phone,
      googleId:  users.googleId,
      hasPassword: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!row) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      id:          row.id,
      fullName:    row.fullName,
      email:       row.email,
      phone:       row.phone ?? null,
      hasGoogle:   !!row.googleId,
      hasPassword: !!row.hasPassword,
      role:        auth.role,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { fullName, email, phone, currentPassword, newPassword } = parsed.data;

  // Fetch current user
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (fullName !== undefined) updates.fullName = fullName.trim();

  if (email !== undefined && email !== user.email) {
    // Check email isn't taken by another user
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (taken && taken.id !== auth.userId) {
      return NextResponse.json({ error: "This email is already in use by another account." }, { status: 409 });
    }
    updates.email = email;
  }

  if (phone !== undefined) updates.phone = phone?.trim() || null;

  if (newPassword !== undefined) {
    // Must supply current password to change password (unless account has no password yet)
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to set a new password." }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
      }
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await db.update(users).set(updates).where(eq(users.id, auth.userId));

  return NextResponse.json({ ok: true });
}
