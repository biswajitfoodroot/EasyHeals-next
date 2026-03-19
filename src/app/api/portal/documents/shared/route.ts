/**
 * GET /api/portal/documents/shared — Provider view of documents shared with them
 *
 * Auth:  Admin session (doctor or hospital_admin role)
 * Logs:  Every fetch is written to document_access_log (DPDP audit trail)
 *
 * Only returns shares that:
 *   - belong to this provider (entityId matches providerId)
 *   - have not been revoked
 *   - have not expired
 */

import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { documentShares, documentAccessLog, healthDocuments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["doctor", "hospital_admin", "owner", "admin"]);
  if (forbidden) return forbidden;

  const providerId = auth.entityId;
  if (!providerId) {
    return NextResponse.json({ error: "No provider entity linked to this account" }, { status: 403 });
  }

  const now = new Date();

  const shares = await db
    .select({
      shareId: documentShares.id,
      documentId: documentShares.documentId,
      patientId: documentShares.patientId,
      providerType: documentShares.providerType,
      expiresAt: documentShares.expiresAt,
      createdAt: documentShares.createdAt,
      // Document metadata
      title: healthDocuments.title,
      docType: healthDocuments.docType,
      fileType: healthDocuments.fileType,
      sourceName: healthDocuments.sourceName,
      docDate: healthDocuments.docDate,
      aiStatus: healthDocuments.aiStatus,
    })
    .from(documentShares)
    .innerJoin(healthDocuments, eq(documentShares.documentId, healthDocuments.id))
    .where(
      and(
        eq(documentShares.providerId, providerId),
        isNull(documentShares.revokedAt),
        gt(documentShares.expiresAt, now),
      )
    )
    .orderBy(documentShares.createdAt);

  // Audit log every access (DPDP requirement)
  if (shares.length > 0) {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { createHash } = await import("crypto");
    const ipHash = createHash("sha256").update(ip).digest("hex");

    await db.insert(documentAccessLog).values(
      shares.map((s) => ({
        shareId: s.shareId,
        accessedBy: auth.userId,
        ipHash,
      }))
    );
  }

  return NextResponse.json({ data: shares });
});
