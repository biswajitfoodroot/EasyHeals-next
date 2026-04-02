/**
 * GET /api/v1/patients/documents/[id]/download — Download patient's own document
 *
 * Auth: eh_patient_session cookie (patient can only download own documents)
 * Returns the file with Content-Disposition: attachment header
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { healthDocuments } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { blobFetch } from "@/lib/storage/blob";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse | Response> => {
  let session;
  try {
    session = await requirePatientSession(req);
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const [doc] = await db
    .select({ id: healthDocuments.id, blobUrl: healthDocuments.blobUrl, fileType: healthDocuments.fileType, title: healthDocuments.title, docType: healthDocuments.docType })
    .from(healthDocuments)
    .where(and(eq(healthDocuments.id, id), eq(healthDocuments.patientId, session.patientId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const buffer = await blobFetch(doc.blobUrl);
    const contentType = MIME_MAP[doc.fileType] ?? "application/octet-stream";
    const fileName = `${doc.title ?? doc.docType ?? "document"}.${doc.fileType}`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "'")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }
};
