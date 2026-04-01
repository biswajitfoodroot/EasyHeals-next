/**
 * Patient Session Store — dual-backend (Redis primary, DB fallback)
 *
 * When Upstash Redis is configured: sessions live in Redis (24h TTL).
 * When Redis is absent (local dev): sessions are stored in `patient_sessions` table in SQLite/Turso.
 *
 * Both paths use the same interface so callers are backend-agnostic.
 */

import { createHash, randomUUID } from "crypto";
import { eq, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { patientSessions } from "@/db/schema";
import { redisGet, redisSet, redisDel, getRedisClient } from "@/lib/core/redis";
import { AppError } from "@/lib/errors/app-error";

export const PATIENT_COOKIE = "eh_patient_session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;  // 24h base window
const SESSION_MAX_TTL_HOURS = 168;           // 7 days hard cap
// How often to extend in Redis (extend if < 30 min remaining — avoids every-request writes)
const EXTEND_THRESHOLD_SECONDS = 30 * 60;

export interface PatientSession {
  patientId: string;
  phoneHash: string;
  phoneEncrypted?: string | null;
  city?: string | null;
  lang: string;
  consentPurposes?: string[];
  createdAt?: string;
  expiresAt?: string;
  maxTtlExpiresAt?: string; // absolute hard cap (createdAt + 7 days)
}

function tokenHash(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createPatientSession(
  session: PatientSession,
  res: NextResponse,
): Promise<string> {
  const rawToken = randomUUID();
  const hash = tokenHash(rawToken);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000);
  const maxTtlExpiresAt = new Date(now + SESSION_MAX_TTL_HOURS * 60 * 60 * 1000);

  const sessionData: PatientSession = {
    ...session,
    createdAt: new Date(now).toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxTtlExpiresAt: maxTtlExpiresAt.toISOString(),
  };

  if (isRedisAvailable()) {
    await redisSet(`patient:session:${hash}`, sessionData, SESSION_TTL_SECONDS);
  } else {
    // DB fallback — upsert row (token hash is unique)
    await db.insert(patientSessions).values({
      tokenHash: hash,
      patientId: session.patientId,
      phoneHash: session.phoneHash,
      phoneEncrypted: session.phoneEncrypted ?? null,
      city: session.city ?? null,
      lang: session.lang ?? "en",
      expiresAt,
      lastActiveAt: new Date(now),
      maxTtlHours: SESSION_MAX_TTL_HOURS,
    }).onConflictDoNothing();
  }

  // Cookie maxAge = full max TTL (sliding window handled server-side, cookie stays alive)
  res.cookies.set(PATIENT_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_TTL_HOURS * 60 * 60,
    path: "/",
  });

  return rawToken;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function requirePatientSession(req: NextRequest): Promise<PatientSession> {
  const rawToken = req.cookies.get(PATIENT_COOKIE)?.value;
  if (!rawToken) {
    throw new AppError("AUTH_SESSION_EXPIRED", "No patient session", "Please verify your phone to continue.", 401);
  }

  const hash = tokenHash(rawToken);
  const now = Date.now();

  if (isRedisAvailable()) {
    const session = await redisGet<PatientSession>(`patient:session:${hash}`);
    if (!session) {
      throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
    }

    // Check absolute max TTL
    if (session.maxTtlExpiresAt && now > new Date(session.maxTtlExpiresAt).getTime()) {
      await redisDel(`patient:session:${hash}`);
      throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
    }

    // Sliding window: extend TTL if less than EXTEND_THRESHOLD remaining
    const currentExpiry = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
    const remainingSeconds = Math.floor((currentExpiry - now) / 1000);
    if (remainingSeconds < EXTEND_THRESHOLD_SECONDS) {
      const maxCap = session.maxTtlExpiresAt ? new Date(session.maxTtlExpiresAt).getTime() : (now + SESSION_MAX_TTL_HOURS * 3600 * 1000);
      const newExpiry = Math.min(now + SESSION_TTL_SECONDS * 1000, maxCap);
      const newTtlSeconds = Math.floor((newExpiry - now) / 1000);
      const extended: PatientSession = { ...session, expiresAt: new Date(newExpiry).toISOString() };
      // Non-blocking extend (fire-and-forget to not slow down API response)
      void redisSet(`patient:session:${hash}`, extended, newTtlSeconds).catch(() => null);
    }

    return session;
  }

  // DB fallback
  const rows = await db
    .select()
    .from(patientSessions)
    .where(eq(patientSessions.tokenHash, hash))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
  }

  // Check both rolling TTL and absolute max TTL cap
  const createdAt = row.createdAt?.getTime() ?? (now - SESSION_TTL_SECONDS * 1000);
  const absoluteExpiry = createdAt + row.maxTtlHours * 60 * 60 * 1000;
  if (row.expiresAt < new Date() || now > absoluteExpiry) {
    // Clean up expired session
    void db.delete(patientSessions).where(eq(patientSessions.tokenHash, hash)).catch(() => null);
    throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
  }

  // Sliding window: extend if less than EXTEND_THRESHOLD remaining
  const remainingMs = row.expiresAt.getTime() - now;
  if (remainingMs < EXTEND_THRESHOLD_SECONDS * 1000) {
    const newExpiry = new Date(Math.min(now + SESSION_TTL_SECONDS * 1000, absoluteExpiry));
    void db.update(patientSessions)
      .set({
        expiresAt: newExpiry,
        lastActiveAt: new Date(now),
        extendedCount: row.extendedCount + 1,
      })
      .where(eq(patientSessions.tokenHash, hash))
      .catch(() => null);
  } else {
    // Still update lastActiveAt (non-blocking)
    void db.update(patientSessions)
      .set({ lastActiveAt: new Date(now) })
      .where(eq(patientSessions.tokenHash, hash))
      .catch(() => null);
  }

  return {
    patientId: row.patientId,
    phoneHash: row.phoneHash,
    phoneEncrypted: row.phoneEncrypted,
    city: row.city,
    lang: row.lang,
    consentPurposes: [],
    expiresAt: row.expiresAt.toISOString(),
    maxTtlExpiresAt: new Date(absoluteExpiry).toISOString(),
  };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deletePatientSession(rawToken: string): Promise<void> {
  const hash = tokenHash(rawToken);

  if (isRedisAvailable()) {
    await redisDel(`patient:session:${hash}`);
  } else {
    await db.delete(patientSessions).where(eq(patientSessions.tokenHash, hash));
  }
}

// ── Cleanup helper (call from a cron or on-demand) ────────────────────────────

export async function purgeExpiredPatientSessions(): Promise<void> {
  if (!isRedisAvailable()) {
    await db.delete(patientSessions).where(
      lt(patientSessions.expiresAt, new Date())
    );
  }
}
