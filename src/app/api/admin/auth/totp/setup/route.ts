/**
 * GET /api/admin/auth/totp/setup
 *
 * Generate a new TOTP secret and return the otpauth:// URI for QR code display.
 * The secret is temporarily stored in users.totpSecret (but totpEnabled stays false
 * until /enroll confirms the first valid code).
 *
 * Requires: authenticated admin/owner session (TOTP not required — setup flow).
 *
 * Response:
 *   { secret, uri }
 *   - secret: base32 string (show to user for manual entry if QR fails)
 *   - uri:    otpauth:// URI (use qrcode lib or Google Charts on client to render)
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireAuthNoTOTP } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { generateTotpSecret, generateTotpUri } from "@/lib/totp";

export async function GET(req: NextRequest) {
  const auth = await requireAuthNoTOTP(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const secret = generateTotpSecret();
  const uri = generateTotpUri(secret, auth.email);

  // Store pending secret — not yet enabled (enroll confirms it)
  await db
    .update(users)
    .set({ totpSecret: secret })
    .where(eq(users.id, auth.userId));

  return NextResponse.json({ secret, uri });
}
