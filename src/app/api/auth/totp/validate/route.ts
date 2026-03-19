/**
 * POST /api/auth/totp/validate
 *
 * Step 2 of admin login when TOTP is enrolled.
 * Called after /api/auth/login returns { requiresTOTP: true }.
 *
 * Reads the session cookie (set by login), verifies the 6-digit code against
 * the user's stored TOTP secret, then sets sessions.totpVerifiedAt = now.
 *
 * After this, requireAuth() allows full access for owner/admin.
 *
 * Also accepts a recovery code (format: XXXX-XXXX-XXXX) in place of a TOTP token.
 * Recovery codes are one-time use — they are removed from the stored list on use.
 */

import { and, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE, hashSessionToken } from "@/lib/session";
import { verifyTotpToken, hashRecoveryCode } from "@/lib/totp";

const schema = z.object({
  code: z.string().min(6).max(20),
});

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "No active session", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "code is required (6 digits or recovery code)" }, { status: 400 });
  }

  const tokenHash = hashSessionToken(sessionToken);

  // Load session + user in one query
  const row = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      totpSecret: users.totpSecret,
      totpEnabled: users.totpEnabled,
      totpRecoveryCodes: users.totpRecoveryCodes,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.sessionToken, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row.length) {
    return NextResponse.json({ error: "Session expired", code: "AUTH_SESSION_EXPIRED" }, { status: 401 });
  }

  const { sessionId, userId, totpSecret, totpEnabled, totpRecoveryCodes } = row[0];

  if (!totpEnabled || !totpSecret) {
    return NextResponse.json({ error: "TOTP is not enrolled for this account", code: "AUTH_TOTP_NOT_SETUP" }, { status: 400 });
  }

  const submittedCode = parsed.data.code.trim();
  const isRecoveryCode = submittedCode.includes("-");

  if (isRecoveryCode) {
    // Recovery code path — one-time use
    const codes: string[] = Array.isArray(totpRecoveryCodes) ? totpRecoveryCodes : [];
    const matchIdx = codes.findIndex((h) => h === hashRecoveryCode(submittedCode));

    if (matchIdx === -1) {
      return NextResponse.json({ error: "Invalid recovery code", code: "AUTH_TOTP_INVALID" }, { status: 401 });
    }

    // Remove the used code
    const remainingCodes = codes.filter((_, i) => i !== matchIdx);
    await Promise.all([
      db.update(users).set({ totpRecoveryCodes: remainingCodes }).where(eq(users.id, userId)),
      db.update(sessions).set({ totpVerifiedAt: new Date() }).where(eq(sessions.id, sessionId)),
    ]);

    return NextResponse.json({
      ok: true,
      recoveryCodesRemaining: remainingCodes.length,
      warning: remainingCodes.length <= 2 ? "Low recovery codes — generate new ones soon" : undefined,
    });
  }

  // TOTP code path
  if (!verifyTotpToken(totpSecret, submittedCode)) {
    return NextResponse.json({ error: "Invalid or expired TOTP code", code: "AUTH_TOTP_INVALID" }, { status: 401 });
  }

  await db.update(sessions).set({ totpVerifiedAt: new Date() }).where(eq(sessions.id, sessionId));

  return NextResponse.json({ ok: true });
}
