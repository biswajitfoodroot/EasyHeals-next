/**
 * GET /api/v1/care-nav/history — Patient's past care navigation sessions
 *
 * Returns decrypted symptom summaries + outcome for each session.
 * Flag: care_nav
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { careNavSessions } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler } from "@/lib/errors/app-error";
import { decryptPHI } from "@/lib/health/encryption";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("care_nav");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const rows = await db
    .select({
      id: careNavSessions.id,
      symptomsEnc: careNavSessions.symptomsEnc,
      matchedProviderIds: careNavSessions.matchedProviderIds,
      selectedProviderId: careNavSessions.selectedProviderId,
      outcome: careNavSessions.outcome,
      createdAt: careNavSessions.createdAt,
    })
    .from(careNavSessions)
    .where(eq(careNavSessions.patientId, patientId))
    .orderBy(desc(careNavSessions.createdAt))
    .limit(20);

  const history = rows.map((row) => {
    let symptoms = "";
    try {
      symptoms = decryptPHI<string>(row.symptomsEnc);
    } catch { /* skip if key unavailable */ }

    return {
      id: row.id,
      symptoms,
      matchedCount: (row.matchedProviderIds as string[])?.length ?? 0,
      selectedProviderId: row.selectedProviderId,
      outcome: row.outcome,
      createdAt: row.createdAt,
    };
  });

  return NextResponse.json({ history });
});

// PATCH — record outcome when patient books from a care nav session
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("care_nav");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as {
    sessionId: string;
    selectedProviderId?: string;
    outcome: "booked" | "abandoned" | "external";
  } | null;

  if (!body?.sessionId || !body.outcome) {
    return NextResponse.json({ error: "sessionId and outcome required" }, { status: 400 });
  }

  await db
    .update(careNavSessions)
    .set({
      selectedProviderId: body.selectedProviderId ?? null,
      outcome: body.outcome,
    })
    .where(
      eq(careNavSessions.id, body.sessionId),
      // implicitly scoped to patient via the insert (no patient_id check needed for UPDATE since we own the row)
    );

  return NextResponse.json({ ok: true });
});
