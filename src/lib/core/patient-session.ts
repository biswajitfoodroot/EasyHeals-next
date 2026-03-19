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
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface PatientSession {
  patientId: string;
  phoneHash: string;
  phoneEncrypted?: string | null;
  city?: string | null;
  lang: string;
  consentPurposes?: string[];
  createdAt?: string;
  expiresAt?: string;
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
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const sessionData: PatientSession = {
    ...session,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
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
    }).onConflictDoNothing();
  }

  res.cookies.set(PATIENT_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
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

  if (isRedisAvailable()) {
    const session = await redisGet<PatientSession>(`patient:session:${hash}`);
    if (!session) {
      throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
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
  if (!row || row.expiresAt < new Date()) {
    throw new AppError("AUTH_SESSION_EXPIRED", "Patient session expired", "Your session has expired. Please verify your phone again.", 401);
  }

  return {
    patientId: row.patientId,
    phoneHash: row.phoneHash,
    phoneEncrypted: row.phoneEncrypted,
    city: row.city,
    lang: row.lang,
    consentPurposes: [],
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
