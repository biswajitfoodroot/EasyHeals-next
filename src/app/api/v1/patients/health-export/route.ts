/**
 * GET /api/v1/patients/health-export — Full PHI export (DPDP portability right)
 *
 * Returns all active health events + documents as a single JSON file download.
 * Auth:   eh_patient_session cookie
 * Flag:   health_memory (returns 503 if OFF)
 *
 * Response: Content-Disposition: attachment; filename="health-export-{date}.json"
 */

import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthDocuments, healthMemoryEvents } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { decryptPHI } from "@/lib/health/encryption";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  if (!await isFeatureEnabled("health_memory")) {
    return NextResponse.json({ error: "Feature not available" }, { status: 503 });
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Fetch all active events
  const eventRows = await db
    .select({
      id: healthMemoryEvents.id,
      source: healthMemoryEvents.source,
      sourceRefId: healthMemoryEvents.sourceRefId,
      eventType: healthMemoryEvents.eventType,
      eventDate: healthMemoryEvents.eventDate,
      dataEncrypted: healthMemoryEvents.dataEncrypted,
      createdAt: healthMemoryEvents.createdAt,
    })
    .from(healthMemoryEvents)
    .where(and(eq(healthMemoryEvents.patientId, patientId), eq(healthMemoryEvents.isActive, true)))
    .orderBy(desc(healthMemoryEvents.eventDate));

  const events = eventRows.map((row) => {
    let data: Record<string, unknown> = {};
    try { data = decryptPHI<Record<string, unknown>>(row.dataEncrypted); }
    catch { /* skip corrupted records */ }
    return {
      id: row.id,
      source: row.source,
      sourceRefId: row.sourceRefId,
      eventType: row.eventType,
      eventDate: row.eventDate,
      createdAt: row.createdAt,
      data,
    };
  });

  // Fetch document metadata (no blob URLs — those are private-access)
  const docs = await db
    .select({
      id: healthDocuments.id,
      title: healthDocuments.title,
      docType: healthDocuments.docType,
      fileType: healthDocuments.fileType,
      sourceName: healthDocuments.sourceName,
      docDate: healthDocuments.docDate,
      aiStatus: healthDocuments.aiStatus,
      uploadedAt: healthDocuments.uploadedAt,
    })
    .from(healthDocuments)
    .where(eq(healthDocuments.patientId, patientId))
    .orderBy(desc(healthDocuments.uploadedAt));

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    patientId,
    documents: docs,
    healthEvents: events,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="health-export-${dateStr}.json"`,
    },
  });
});
