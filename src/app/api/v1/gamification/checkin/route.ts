/**
 * POST /api/v1/gamification/checkin
 *
 * Daily check-in shortcut — fires DAILY_CHECKIN gamification event.
 * Idempotent: second call today returns awarded=false with the points already earned.
 *
 * Auth:  eh_patient_session cookie
 * Flag:  gamification_ui (returns 423 if OFF)
 *
 * Response:
 *   200  { data: { points: 10, totalPoints: 120, alreadyCheckedIn: false } }
 *   200  { data: { points: 0,  totalPoints: 120, alreadyCheckedIn: true  } }
 */

import { NextRequest, NextResponse } from "next/server";

import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { awardPoints } from "@/lib/gamification/award";
import { withErrorHandler } from "@/lib/errors/app-error";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const blocked = await requireFeatureFlag("gamification_ui");
  if (blocked) return blocked;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC
  const proofId = `${patientId}:${today}`;

  const result = await awardPoints({
    actorId: patientId,
    actorType: "patient",
    eventType: "DAILY_CHECKIN",
    proofId,
    proofType: "self_reported",
  });

  return NextResponse.json({
    data: {
      points: result.awarded ? result.points : 0,
      totalPoints: result.totalPoints,
      alreadyCheckedIn: !result.awarded && result.reason === "duplicate",
    },
  });
});
