/**
 * POST /api/v1/patients/health-coach/feedback
 *
 * Record explicit thumbs-up/down feedback on an AI health coach response.
 * Used to improve future responses and measure answer quality.
 *
 * Auth:  eh_patient_session cookie
 * Flag:  ai_health_coach
 *
 * Body:
 *   { conversationId: string; turnIndex: number; rating: "up" | "down"; }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { aiResponseFeedback } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";

const feedbackSchema = z.object({
  conversationId: z.string().uuid(),
  turnIndex: z.number().int().min(0),
  rating: z.enum(["up", "down"]),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await isFeatureEnabled("ai_health_coach")) {
    return NextResponse.json({ error: "Feature not available" }, { status: 503 });
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
  }

  const { conversationId, turnIndex, rating } = parsed.data;

  await db.insert(aiResponseFeedback).values({
    conversationId,
    patientId,
    turnIndex,
    explicitRating: rating === "up" ? "thumbs_up" : "thumbs_down",
  });

  return NextResponse.json({ data: { recorded: true } });
});
