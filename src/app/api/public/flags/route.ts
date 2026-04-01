/**
 * GET /api/public/flags?key=<flag_key>
 *
 * Public, unauthenticated endpoint for client-side FeatureGate component.
 * Returns whether a single flag is enabled. Never exposes all flags at once.
 * Response is cached for 60s at CDN level (flags rarely change mid-session).
 */

import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/config/feature-flags";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key.length > 64 || !/^[a-z0-9_]+$/.test(key)) {
    return NextResponse.json({ enabled: false });
  }

  const enabled = await isFeatureEnabled(key);
  return NextResponse.json(
    { enabled },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
