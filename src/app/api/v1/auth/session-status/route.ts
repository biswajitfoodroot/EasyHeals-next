/**
 * GET /api/v1/auth/session-status
 *
 * Returns the current patient session status without triggering full auth.
 * Used by useSessionHealth() hook to show re-auth modal before expiry.
 *
 * Response:
 *   { valid: true, expiresAt: ISO, minutesRemaining: number, maxTtlExpiresAt: ISO }
 *   { valid: false, code: "AUTH_SESSION_EXPIRED" }
 *
 * No auth required — cookie is read directly. Returns 200 always.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientSessions } from "@/db/schema";
import { PATIENT_COOKIE } from "@/lib/core/patient-session";
import { redisGet, getRedisClient } from "@/lib/core/redis";
import type { PatientSession } from "@/lib/core/patient-session";

function tokenHash(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function GET(req: NextRequest) {
  const rawToken = req.cookies.get(PATIENT_COOKIE)?.value;
  if (!rawToken) {
    return NextResponse.json({ valid: false, code: "AUTH_SESSION_EXPIRED" });
  }

  const hash = tokenHash(rawToken);
  const now = Date.now();

  // Redis path
  if (getRedisClient()) {
    const session = await redisGet<PatientSession>(`patient:session:${hash}`);
    if (!session || !session.expiresAt) {
      return NextResponse.json({ valid: false, code: "AUTH_SESSION_EXPIRED" });
    }

    const expiryMs = new Date(session.expiresAt).getTime();
    const maxExpiryMs = session.maxTtlExpiresAt ? new Date(session.maxTtlExpiresAt).getTime() : expiryMs;

    if (now > expiryMs || now > maxExpiryMs) {
      return NextResponse.json({ valid: false, code: "AUTH_SESSION_EXPIRED" });
    }

    const effectiveExpiry = Math.min(expiryMs, maxExpiryMs);
    const minutesRemaining = Math.floor((effectiveExpiry - now) / 60_000);

    return NextResponse.json({
      valid: true,
      expiresAt: new Date(effectiveExpiry).toISOString(),
      minutesRemaining,
      maxTtlExpiresAt: session.maxTtlExpiresAt ?? null,
    });
  }

  // DB fallback path
  const rows = await db
    .select({
      expiresAt: patientSessions.expiresAt,
      createdAt: patientSessions.createdAt,
      maxTtlHours: patientSessions.maxTtlHours,
    })
    .from(patientSessions)
    .where(eq(patientSessions.tokenHash, hash))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ valid: false, code: "AUTH_SESSION_EXPIRED" });
  }

  const createdMs = row.createdAt?.getTime() ?? now;
  const absoluteExpiry = createdMs + row.maxTtlHours * 3600 * 1000;
  const rollingExpiry = row.expiresAt.getTime();

  if (now > rollingExpiry || now > absoluteExpiry) {
    return NextResponse.json({ valid: false, code: "AUTH_SESSION_EXPIRED" });
  }

  const effectiveExpiry = Math.min(rollingExpiry, absoluteExpiry);
  const minutesRemaining = Math.floor((effectiveExpiry - now) / 60_000);

  return NextResponse.json({
    valid: true,
    expiresAt: new Date(effectiveExpiry).toISOString(),
    minutesRemaining,
    maxTtlExpiresAt: new Date(absoluteExpiry).toISOString(),
  });
}
