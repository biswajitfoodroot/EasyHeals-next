/**
 * GET /api/v1/patients/health-coach/conversations — List coach conversation threads
 *
 * Returns metadata only (title, lastMessageAt) — no decrypted messages.
 * Auth: eh_patient_session cookie
 */

import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { aiConversations } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);

  const convos = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      lastMessageAt: aiConversations.lastMessageAt,
      createdAt: aiConversations.createdAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.patientId, session.patientId))
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(20);

  return NextResponse.json({ data: convos });
});
