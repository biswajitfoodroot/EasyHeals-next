/**
 * Blob Storage Client — Local-first, production-swappable
 *
 * Strategy (ARCHITECTURE.md V6.1 update):
 *   - Local dev (no BLOB_READ_WRITE_TOKEN): stores files in OS tmp dir
 *     Returns a local path URL: /api/v1/internal/blobs/{filename}
 *   - Production option A (Vercel Blob): install @vercel/blob, set BLOB_READ_WRITE_TOKEN
 *   - Production option B (AWS S3 ap-south-1): set STORAGE_PROVIDER=s3 + S3 creds
 *
 * PHI / DPDP Notes:
 *   - Files stored with access: "private" — never publicly accessible
 *   - Documents are temporary processing artifacts; the REAL PHI lives encrypted
 *     in health_memory_events.data_encrypted (AES-256-GCM)
 *   - For HIPAA: use S3 ap-south-1 with SSE-KMS + BAA with AWS India
 *   - For DPDP: data localisation requires Indian region storage in production
 *
 * No external package required for local dev.
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { env } from "@/lib/env";

const LOCAL_STORE_DIR = join(tmpdir(), "easyheals-blobs");

// ── Put (upload) ───────────────────────────────────────────────────────────────

export interface BlobPutResult {
  url: string;       // Retrieval URL (internal path or external CDN URL)
  pathname: string;  // Storage key / path
}

export async function blobPut(
  pathname: string,
  body: Blob | File,
  options?: { contentType?: string },
): Promise<BlobPutResult> {

  // ── Option A: Vercel Blob (install @vercel/blob + set BLOB_READ_WRITE_TOKEN) ──
  if (env.BLOB_READ_WRITE_TOKEN && env.BLOB_READ_WRITE_TOKEN.length > 10) {
    try {
      // webpackIgnore tells Next.js bundler not to resolve this at compile time
      const { put } = await import(/* webpackIgnore: true */ "@vercel/blob");
      const result = await put(pathname, body, {
        access: "private",
        contentType: options?.contentType,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      return { url: result.url, pathname };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Cannot find module")) {
        console.warn("[blob] @vercel/blob not installed — falling back to local storage");
      } else {
        throw e;
      }
    }
  }

  // ── Option B: Local filesystem (dev/testing) ──────────────────────────────────
  await mkdir(LOCAL_STORE_DIR, { recursive: true });

  // Flatten pathname to safe filename
  const safeFilename = pathname.replace(/[/\\]/g, "_");
  const filePath = join(LOCAL_STORE_DIR, safeFilename);

  const buffer = Buffer.from(await body.arrayBuffer());
  await writeFile(filePath, buffer);

  // Return an internal retrieval URL
  const url = `${env.APP_BASE_URL ?? "http://localhost:3000"}/api/internal/blobs/${encodeURIComponent(safeFilename)}`;
  return { url, pathname };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function blobDelete(url: string): Promise<void> {
  if (env.BLOB_READ_WRITE_TOKEN && env.BLOB_READ_WRITE_TOKEN.length > 10) {
    try {
      const { del } = await import(/* webpackIgnore: true */ "@vercel/blob");
      await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Cannot find module")) throw e;
    }
  }

  // Local fallback
  try {
    const filename = decodeURIComponent(url.split("/").pop() ?? "");
    if (filename) await unlink(join(LOCAL_STORE_DIR, filename));
  } catch { /* non-fatal */ }
}

// ── Fetch bytes (for Gemini extraction) ──────────────────────────────────────

export async function blobFetch(url: string): Promise<Buffer> {
  // For both Vercel Blob private URLs and local file paths, fetch with internal key
  if (url.includes("/api/internal/blobs/")) {
    const filename = decodeURIComponent(url.split("/api/internal/blobs/")[1] ?? "");
    const { readFile } = await import("fs/promises");
    return readFile(join(LOCAL_STORE_DIR, filename));
  }

  // Vercel Blob private URL — needs token in header
  const headers: Record<string, string> = {};
  if (env.BLOB_READ_WRITE_TOKEN) {
    headers["Authorization"] = `Bearer ${env.BLOB_READ_WRITE_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
