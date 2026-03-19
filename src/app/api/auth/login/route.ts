import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { roles, userRoleMap, users } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!rows.length) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const user = rows[0];
  if (!user.isActive) {
    return NextResponse.json({ error: "User is inactive" }, { status: 403 });
  }

  const ok = user.passwordHash ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const roleRows = await db
    .select({ role: roles.code })
    .from(userRoleMap)
    .innerJoin(roles, eq(roles.id, userRoleMap.roleId))
    .where(eq(userRoleMap.userId, user.id))
    .limit(1);

  const role = roleRows[0]?.role ?? "viewer";

  // Create session — totpVerifiedAt starts as NULL
  const { sessionToken, expiresAt } = await createSession(user.id);

  // P2 — TOTP gate (HLD §8.2): owner/admin with TOTP enrolled must complete TOTP step
  const totpRequired = user.totpEnabled && ["owner", "admin"].includes(role);

  if (totpRequired) {
    // Set session cookie so the TOTP validate route can identify the session,
    // but access to protected routes is blocked until totpVerifiedAt is set.
    await setSessionCookie(sessionToken, expiresAt);
    return NextResponse.json({
      requiresTOTP: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role,
      },
    });
  }

  // No TOTP required — full session granted
  await setSessionCookie(sessionToken, expiresAt);

  return NextResponse.json({
    data: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role,
      totpEnabled: user.totpEnabled,
    },
  });
}
