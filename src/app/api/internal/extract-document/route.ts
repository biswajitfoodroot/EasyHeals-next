/**
 * POST /api/internal/extract-document
 *
 * Async Gemini Vision extraction pipeline.
 * Called fire-and-forget from /api/v1/patients/documents after upload.
 * Protected by x-internal-key header — NOT exposed to patients.
 *
 * Flow:
 *  1. Load health_documents row
 *  2. Set ai_status = 'processing'
 *  3. Fetch blob → Gemini Vision → structured events
 *  4. writeMemoryEvents(patientId, 'document', events)
 *  5. Update health_documents: ai_status='done', docType, sourceName, docDate, title
 *
 * Vercel function timeout: 60s (internal routes get max duration)
 */

export const maxDuration = 60; // Vercel Pro: up to 300s, Hobby: 60s

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthDocuments } from "@/db/schema";
import { extractHealthDocument } from "@/lib/health/extract";
import { writeMemoryEvents } from "@/lib/health/memory-writer";
import { env } from "@/lib/env";

export const POST = async (req: NextRequest) => {
  // Internal key guard
  const key = req.headers.get("x-internal-key");
  if (!key || key !== env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let documentId: string;
  try {
    const body = await req.json() as { documentId?: string };
    if (!body.documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });
    documentId = body.documentId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Load document row
  const [doc] = await db
    .select()
    .from(healthDocuments)
    .where(eq(healthDocuments.id, documentId))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.aiStatus === "done") return NextResponse.json({ data: { skipped: true } });

  // Mark as processing
  await db
    .update(healthDocuments)
    .set({ aiStatus: "processing" })
    .where(eq(healthDocuments.id, documentId));

  try {
    // Extract with Gemini Vision
    const extracted = await extractHealthDocument(doc.blobUrl, doc.fileType);

    // Write events to health memory (encrypted)
    if (extracted.events.length > 0) {
      await writeMemoryEvents(doc.patientId, "document", extracted.events.map((e) => ({
        ...e,
        sourceRefId: documentId,
      })));
    }

    // Update document with AI-inferred metadata
    await db
      .update(healthDocuments)
      .set({
        aiStatus: "done",
        docType: extracted.docType ?? doc.docType,
        sourceName: extracted.sourceName ?? doc.sourceName,
        docDate: extracted.docDate ?? doc.docDate,
        title: extracted.title ?? doc.title,
      })
      .where(eq(healthDocuments.id, documentId));

    return NextResponse.json({
      data: {
        documentId,
        eventsExtracted: extracted.events.length,
        docType: extracted.docType,
      },
    });
  } catch (err) {
    // Mark as failed — patient sees 'failed' status in UI
    await db
      .update(healthDocuments)
      .set({ aiStatus: "failed" })
      .where(eq(healthDocuments.id, documentId));

    console.error("[extract-document] Extraction failed:", documentId, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
};
