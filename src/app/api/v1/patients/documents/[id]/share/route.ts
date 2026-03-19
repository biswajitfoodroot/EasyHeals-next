/**
 * POST /api/v1/patients/documents/[id]/share   — Share document with a provider
 * DELETE /api/v1/patients/documents/[id]/share  — Revoke all active shares for document
 *
 * Auth:  eh_patient_session cookie
 * DPDP: consent purpose "provider_health_share" required
 * Flag: health_memory
 *
 * POST Body: { providerId, providerType, expiresInDays? }
 * DELETE Body: { shareId } — revoke specific share
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { documentShares, healthDocuments } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireConsent } from "@/lib/security/consent";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const shareSchema = z.object({
  providerId: z.string().min(1),
  providerType: z.enum(["doctor", "hospital"]),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

const revokeSchema = z.object({
  shareId: z.string().uuid(),
});

// ── POST — create a share ─────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  if (!await isFeatureEnabled("health_memory")) {
    return NextResponse.json({ error: "Feature not available" }, { status: 503 });
  }

  const { id: documentId } = await params;
  const session = await requirePatientSession(req);
  const { patientId } = session;

  // Verify the document belongs to this patient
  const [doc] = await db
    .select({ id: healthDocuments.id, aiStatus: healthDocuments.aiStatus })
    .from(healthDocuments)
    .where(and(eq(healthDocuments.id, documentId), eq(healthDocuments.patientId, patientId)))
    .limit(1);

  if (!doc) throw new AppError("DB_NOT_FOUND", "Document not found", "Document not found or access denied.", 404);

  // DPDP consent gate
  await requireConsent(patientId, "provider_health_share").catch(() => {
    throw new AppError("CONSENT_MISSING", "Consent required",
      "Please grant consent to share health documents before sharing.", 403);
  });

  const payload = await req.json().catch(() => null);
  const parsed = shareSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request: providerId, providerType required" }, { status: 400 });
  }

  const { providerId, providerType, expiresInDays } = parsed.data;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const [share] = await db
    .insert(documentShares)
    .values({
      documentId,
      patientId,
      providerId,
      providerType,
      expiresAt,
    })
    .returning({
      id: documentShares.id,
      expiresAt: documentShares.expiresAt,
    });

  return NextResponse.json({
    data: {
      shareId: share.id,
      documentId,
      providerId,
      providerType,
      expiresAt: share.expiresAt,
    },
  }, { status: 201 });
});

// ── DELETE — revoke a specific share ─────────────────────────────────────────

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: documentId } = await params;
  const session = await requirePatientSession(req);
  const { patientId } = session;

  const payload = await req.json().catch(() => null);
  const parsed = revokeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "shareId (UUID) required" }, { status: 400 });
  }

  await db
    .update(documentShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(documentShares.id, parsed.data.shareId),
        eq(documentShares.documentId, documentId),
        eq(documentShares.patientId, patientId),
      )
    );

  return NextResponse.json({ message: "Share revoked." });
});
