/**
 * GET /api/v1/patients/subscription — Patient tier & trial status
 *
 * Returns current subscription tier, trial status, and days remaining.
 * Used by dashboard UI to show upgrade prompts and trial banners.
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { getTierStatus } from "@/lib/core/patient-trial";

// Always read live from DB — never cache subscription status
export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);

  // Pure read — trial starts only when a premium feature is first used (requirePremiumAccess)
  const status = await getTierStatus(session.patientId);

  const res = NextResponse.json({
    data: {
      tier: status.tier,
      inTrial: status.inTrial,
      trialDaysLeft: status.trialDaysLeft,
      canUsePremium: status.canUsePremium,
      trialStartedAt: status.trialStartedAt?.toISOString() ?? null,
      subscriptionExpiresAt: status.subscriptionExpiresAt?.toISOString() ?? null,
    },
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
});
