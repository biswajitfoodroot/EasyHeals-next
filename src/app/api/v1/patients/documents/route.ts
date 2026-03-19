/**
 * POST /api/v1/patients/documents  — Upload patient health document
 * GET  /api/v1/patients/documents  — List patient's documents
 *
 * P5 W1 — Vercel Blob direct upload (replaces CRM proxy from P2).
 * Gemini extraction runs async via /api/internal/extract-document (fire-and-forget).
 *
 * Auth:   eh_patient_session cookie
 * DPDP:  consent purpose "health_document_processing" required before upload
 * Flag:  health_memory feature flag must be ON
 *
 * Upload limits: 10MB, PDF/JPEG/PNG/WebP only
 * Env:   BLOB_READ_WRITE_TOKEN, INTERNAL_API_KEY, APP_BASE_URL
 */

import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { blobPut } from "@/lib/storage/blob";

import { db } from "@/db/client";
import { healthDocuments } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireConsent } from "@/lib/security/consent";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { requirePremiumAccess } from "@/lib/core/patient-trial";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { env } from "@/lib/env";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// ── GET — list documents ──────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);

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
    .where(eq(healthDocuments.patientId, session.patientId))
    .orderBy(desc(healthDocuments.uploadedAt));

  return NextResponse.json({ data: docs });
});

// ── POST — upload document ────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Feature flag gate
  if (!await isFeatureEnabled("health_memory")) {
    return NextResponse.json({ error: "Feature not available" }, { status: 503 });
  }
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Document storage not configured" }, { status: 503 });
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Trial / subscription gate (auto-starts trial on first upload)
  await requirePremiumAccess(patientId);

  // DPDP consent gate
  let consentId: string;
  try {
    consentId = await requireConsent(patientId, "health_document_processing");
  } catch {
    throw new AppError("CONSENT_MISSING", "Consent required",
      "Please grant consent to store medical documents before uploading.", 403);
  }

  // Parse multipart
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new AppError("SYS_UNHANDLED", "Wrong content-type", "Request must be multipart/form-data", 400);
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { throw new AppError("SYS_UNHANDLED", "Parse error", "Failed to parse form data", 400); }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    throw new AppError("SYS_UNHANDLED", "No file", "Field 'file' is required", 400);
  }

  const mimeType = (file as File).type ?? "";
  const fileExt = ALLOWED_MIME[mimeType];
  if (!fileExt) {
    throw new AppError("SYS_UNHANDLED", "Unsupported type", "Allowed: PDF, JPEG, PNG, WebP", 415);
  }
  if (file.size > MAX_SIZE) {
    throw new AppError("SYS_UNHANDLED", "File too large", "Maximum file size is 10MB", 413);
  }

  // Optional patient-supplied metadata
  const patientTitle = (formData.get("title") as string | null) ?? null;
  const patientDocType = (formData.get("docType") as string | null) ?? null;

  // Upload to blob storage (Vercel Blob in prod, local tmp in dev)
  const fileName = `health/${patientId}/${Date.now()}.${fileExt}`;
  const blob = await blobPut(fileName, file, { contentType: mimeType });

  // Insert health_documents row (ai_status = 'pending')
  const [doc] = await db
    .insert(healthDocuments)
    .values({
      patientId,
      blobUrl: blob.url,
      fileType: fileExt,
      docType: patientDocType,
      title: patientTitle,
      aiStatus: "pending",
      consentId,
    })
    .returning({
      id: healthDocuments.id,
      aiStatus: healthDocuments.aiStatus,
      uploadedAt: healthDocuments.uploadedAt,
    });

  // Fire-and-forget async Gemini extraction (non-blocking)
  if (env.INTERNAL_API_KEY) {
    void fetch(`${env.APP_BASE_URL}/api/internal/extract-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch(() => {/* non-fatal — shows 'pending' until next poll */});
  }

  return NextResponse.json({
    data: {
      documentId: doc.id,
      aiStatus: "pending",
      uploadedAt: doc.uploadedAt,
      message: "Document uploaded. AI extraction in progress.",
    },
  }, { status: 201 });
});
