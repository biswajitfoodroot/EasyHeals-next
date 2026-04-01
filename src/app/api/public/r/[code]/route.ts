/**
 * GET /api/public/r/[code] — Referral code redirect
 *
 * Sets ref_code cookie (30 days) for attribution tracking on registration.
 * Increments total_clicks on the referral code.
 * Redirects to home page with ?ref=CODE UTM param.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { referralCodes } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const baseUrl = process.env.APP_BASE_URL ?? "https://easy-heals-next.vercel.app";

  // Always redirect — feature flag check is advisory only
  const enabled = await isFeatureEnabled("referral_engine").catch(() => false);

  if (enabled && code) {
    // Verify code exists + increment clicks (fire and forget)
    void (async () => {
      try {
        const rows = await db
          .select({ id: referralCodes.id })
          .from(referralCodes)
          .where(eq(referralCodes.code, code.toUpperCase()))
          .limit(1);

        if (rows.length > 0) {
          await db
            .update(referralCodes)
            .set({ totalClicks: sql`${referralCodes.totalClicks} + 1` })
            .where(eq(referralCodes.id, rows[0].id));
        }
      } catch { /* non-fatal */ }
    })();
  }

  const destination = new URL("/", baseUrl);
  destination.searchParams.set("ref", code);

  const response = NextResponse.redirect(destination.toString());

  // Set attribution cookie — 30 days
  response.cookies.set("eh_ref_code", code.toUpperCase(), {
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}
