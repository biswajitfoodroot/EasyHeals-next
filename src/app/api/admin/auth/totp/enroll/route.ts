/**
 * POST /api/admin/auth/totp/enroll
 *
 * Confirm the first TOTP code from the authenticator app.
 * If valid, sets totpEnabled=true and generates 8 recovery codes.
 *
 * Must be called after GET /api/admin/auth/totp/setup.
 * Requires: authenticated admin/owner session (TOTP not required — enrollment flow).
 *
 * Request:  { code: "123456" }
 * Response: { ok: true, recoveryCodes: string[] }
 *           — show recovery codes to user ONCE; they are stored hashed.
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireAuthNoTOTP } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { generateRecoveryCodes, hashRecoveryCode, verifyTotpToken } from "@/lib/totp";

const schema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: NextRequest) {
  const auth = await requireAuthNoTOTP(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "6-digit code required" }, { status: 400 });
  }

  // Load pending secret
  const rows = await db
    .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  const user = rows[0];
  if (!user?.totpSecret) {
    return NextResponse.json(
      { error: "No pending TOTP setup — call GET /api/admin/auth/totp/setup first", code: "AUTH_TOTP_NOT_SETUP" },
      { status: 400 }
    );
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: "TOTP is already enrolled. Disable it first to re-enroll." },
      { status: 409 }
    );
  }

  if (!verifyTotpToken(user.totpSecret, parsed.data.code)) {
    return NextResponse.json(
      { error: "Invalid TOTP code — check your authenticator app and try again", code: "AUTH_TOTP_INVALID" },
      { status: 401 }
    );
  }

  // Generate recovery codes — show to user once, store hashed
  const rawCodes = generateRecoveryCodes();
  const hashedCodes = rawCodes.map(hashRecoveryCode);

  await db
    .update(users)
    .set({ totpEnabled: true, totpRecoveryCodes: hashedCodes })
    .where(eq(users.id, auth.userId));

  return NextResponse.json({
    ok: true,
    recoveryCodes: rawCodes,
    message: "TOTP enrolled. Save these recovery codes — they will not be shown again.",
  });
}
