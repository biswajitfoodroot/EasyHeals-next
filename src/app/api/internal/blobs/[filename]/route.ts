/**
 * GET /api/internal/blobs/[filename] — Local dev blob retrieval
 *
 * Only active in development (NODE_ENV !== "production").
 * In production, files are on Vercel Blob / S3 — never served from here.
 *
 * Requires x-internal-key header to prevent public access.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

const LOCAL_STORE_DIR = join(tmpdir(), "easyheals-blobs");

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
): Promise<NextResponse | Response> => {
  // Only available in dev
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Internal key guard (same pattern as extract-document)
  const key = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("authorization");
  const isInternal = (key && key === env.INTERNAL_API_KEY) ||
                     (authHeader && authHeader === `Bearer ${env.BLOB_READ_WRITE_TOKEN}`);

  if (!isInternal && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  const safeFilename = decodeURIComponent(filename).replace(/[/\\..]+/g, "_");
  const filePath = join(LOCAL_STORE_DIR, safeFilename);

  try {
    const buf = await readFile(filePath);
    const ext = safeFilename.split(".").pop()?.toLowerCase();
    const contentType = ext === "pdf" ? "application/pdf"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : "application/octet-stream";

    return new Response(buf, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
};
