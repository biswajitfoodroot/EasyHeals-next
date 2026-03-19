/**
 * GET    /api/v1/patients/documents/[id]  — document detail + AI extraction summary
 * DELETE /api/v1/patients/documents/[id]  — DPDP right to erasure
 *
 * P5 W1
 * Auth: eh_patient_session cookie (patient can only access own documents)
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthDocuments, healthMemoryEvents, documentShares } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { blobDelete } from "@/lib/storage/blob";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requirePatientSession(req);
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(healthDocuments)
    .where(and(eq(healthDocuments.id, id), eq(healthDocuments.patientId, session.patientId)))
    .limit(1);

  if (!doc) throw new AppError("SYS_UNHANDLED", "Not found", "Document not found", 404);

  // Get extracted event count (summary only, no decryption)
  const eventRows = await db
    .select({ id: healthMemoryEvents.id, eventType: healthMemoryEvents.eventType })
    .from(healthMemoryEvents)
    .where(eq(healthMemoryEvents.sourceRefId, id));

  const eventSummary = eventRows.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});

  // Active shares for this document
  const shares = await db
    .select({
      id: documentShares.id,
      providerId: documentShares.providerId,
      providerType: documentShares.providerType,
      expiresAt: documentShares.expiresAt,
      revokedAt: documentShares.revokedAt,
    })
    .from(documentShares)
    .where(eq(documentShares.documentId, id));

  return NextResponse.json({
    data: {
      id: doc.id,
      title: doc.title,
      docType: doc.docType,
      fileType: doc.fileType,
      sourceName: doc.sourceName,
      docDate: doc.docDate,
      aiStatus: doc.aiStatus,
      uploadedAt: doc.uploadedAt,
      extractedEventCount: eventRows.length,
      extractedEvents: eventSummary, // e.g. { lab_result: 5, diagnosis: 2 }
      activeShares: shares.filter((s) => !s.revokedAt),
    },
  });
});

// ── DELETE — DPDP right to erasure ───────────────────────────────────────────

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requirePatientSession(req);
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(healthDocuments)
    .where(and(eq(healthDocuments.id, id), eq(healthDocuments.patientId, session.patientId)))
    .limit(1);

  if (!doc) throw new AppError("SYS_UNHANDLED", "Not found", "Document not found", 404);

  // Delete from blob storage (best-effort — don't fail if blob already gone)
  await blobDelete(doc.blobUrl).catch(() => {/* ignore */});

  // Soft-delete: mark all extracted events as inactive
  await db
    .update(healthMemoryEvents)
    .set({ isActive: false })
    .where(eq(healthMemoryEvents.sourceRefId, id));

  // Delete the document row (cascades shares via FK)
  await db
    .delete(healthDocuments)
    .where(and(eq(healthDocuments.id, id), eq(healthDocuments.patientId, session.patientId)));

  return NextResponse.json({ data: { deleted: true, documentId: id } });
});
