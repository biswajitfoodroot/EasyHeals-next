/**
 * POST /api/v1/patients/documents/retry-scan
 *
 * Re-triggers AI extraction for a document that is in "failed" or stuck "pending" state.
 * Resets ai_status to "pending" then fires-and-forgets the internal extract pipeline.
 *
 * Auth: eh_patient_session cookie (patient can only retry their own documents)
 */

import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthDocuments } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { env } from "@/lib/env";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);

  const body = await req.json() as { documentId?: string };
  if (!body.documentId) {
    throw new AppError("SYS_UNHANDLED", "Missing documentId", "documentId is required", 400);
  }

  // Verify ownership and current status
  const [doc] = await db
    .select({ id: healthDocuments.id, aiStatus: healthDocuments.aiStatus })
    .from(healthDocuments)
    .where(and(
      eq(healthDocuments.id, body.documentId),
      eq(healthDocuments.patientId, session.patientId),
    ))
    .limit(1);

  if (!doc) {
    throw new AppError("SYS_UNHANDLED", "Not found", "Document not found", 404);
  }
  if (doc.aiStatus === "processing") {
    return NextResponse.json({ data: { message: "Already processing" } });
  }

  // Reset to pending
  await db
    .update(healthDocuments)
    .set({ aiStatus: "pending" })
    .where(eq(healthDocuments.id, doc.id));

  // Fire-and-forget extraction
  if (env.INTERNAL_API_KEY) {
    void fetch(`${env.APP_BASE_URL}/api/internal/extract-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch(() => {});
  }

  return NextResponse.json({ data: { message: "AI extraction re-queued" } });
});
