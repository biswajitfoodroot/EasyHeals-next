/**
 * GET /api/v1/patients/subscription — Patient tier & trial status
 *
 * Returns current subscription tier, trial status, and days remaining.
 * Used by dashboard UI to show upgrade prompts and trial banners.
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { getTierStatus, startTrialIfNew } from "@/lib/core/patient-trial";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);

  // Auto-start trial on first call (so dashboard can show "X days left" immediately)
  await startTrialIfNew(session.patientId);
  const status = await getTierStatus(session.patientId);

  return NextResponse.json({
    data: {
      tier: status.tier,
      inTrial: status.inTrial,
      trialDaysLeft: status.trialDaysLeft,
      canUsePremium: status.canUsePremium,
      trialStartedAt: status.trialStartedAt?.toISOString() ?? null,
      subscriptionExpiresAt: status.subscriptionExpiresAt?.toISOString() ?? null,
    },
  });
});
