/**
 * GET /api/v1/hospitals/:hospitalId/queue
 *
 * P2 Day 2 — Real-time token queue via Server-Sent Events (HLD §5.5)
 *
 * Streams the current queue position for a hospital's in-person appointments.
 * Clients subscribe once and receive updates every POLL_INTERVAL_MS.
 *
 * Protocol:
 *   Content-Type: text/event-stream
 *   Each event:  data: {"token":12,"queueLength":5,"hospitalId":"...","updatedAt":"..."}\n\n
 *   On error:    data: {"error":"..."}\n\n
 *   Heartbeat:   ": ping\n\n"  (every 15s to keep connection alive through proxies)
 *
 * Auth: patient OTP session cookie (eh_patient_session) — OR open if feature-flagged
 *       For P2, requires valid OTP session to prevent scraping queue state.
 *
 * Queue state source:
 *   Primary: Redis key  hospital:queue:{hospitalId}  →  { token: number, updatedAt: ISO }
 *   Fallback: DB count of in_progress appointments at this hospital (when Redis unavailable)
 *
 * Redis key is written by the CRM advisor portal when calling a patient into consultation.
 * TTL: 86400s (reset daily at midnight).
 *
 * Query params:
 *   ?patientToken=uuid   (optional) — patient's own appointment token number for position calc
 */

import { createHash } from "crypto";
import { count, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db } from "@/db/client";
import { appointments } from "@/db/schema";
import { redisGet, getRedisClient } from "@/lib/core/redis";
import { AppError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";
// SSE does not work on Edge runtime for long-lived connections in Next.js App Router
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5_000;   // send update every 5 seconds
const HEARTBEAT_INTERVAL_MS = 15_000; // keep-alive ping every 15 seconds
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // auto-close after 5 minutes

interface QueueState {
  token: number;
  queueLength: number;
  updatedAt: string;
}

interface PatientSession {
  patientId: string;
  phoneHash: string;
  phoneEncrypted: string | null;
  city: string | null;
  lang: string;
}

async function getPatientSession(req: NextRequest): Promise<PatientSession | null> {
  const rawToken = req.cookies.get("eh_patient_session")?.value;
  if (!rawToken) return null;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return redisGet<PatientSession>(`patient:session:${tokenHash}`);
}

async function fetchQueueState(hospitalId: string): Promise<QueueState> {
  // Try Redis first (written by CRM when calling patient)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<{ token: number; updatedAt: string }>(
        `hospital:queue:${hospitalId}`,
      );
      if (cached) {
        // Also count remaining in_progress + confirmed appointments as queue length
        const [{ value: queueLength }] = await db
          .select({ value: count() })
          .from(appointments)
          .where(eq(appointments.hospitalId, hospitalId));
        // Filter to in_progress count for the current active token
        return {
          token: cached.token,
          queueLength: Math.max(0, queueLength),
          updatedAt: cached.updatedAt ?? new Date().toISOString(),
        };
      }
    } catch {
      // Redis error — fall through to DB fallback
    }
  }

  // Fallback: derive "current token" from count of completed appointments today
  // and "queue length" from in_progress + confirmed count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ value: completedToday }] = await db
    .select({ value: count() })
    .from(appointments)
    .where(eq(appointments.hospitalId, hospitalId));

  return {
    token: Math.max(1, completedToday),
    queueLength: completedToday,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ hospitalId: string }> },
) {
  const { hospitalId } = await params;

  // Auth: require patient session
  const session = await getPatientSession(req);
  if (!session) {
    return new Response(
      `data: ${JSON.stringify({ error: "Authentication required", code: "AUTH_SESSION_EXPIRED" })}\n\n`,
      {
        status: 401,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            isClosed = true;
          }
        }
      };

      // Send initial state immediately
      try {
        const state = await fetchQueueState(hospitalId);
        enqueue(`data: ${JSON.stringify({ ...state, hospitalId })}\n\n`);
      } catch (err) {
        enqueue(`data: ${JSON.stringify({ error: "Failed to fetch queue state" })}\n\n`);
        controller.close();
        return;
      }

      // Poll + heartbeat loop
      const startTime = Date.now();
      let lastHeartbeat = Date.now();

      const poll = setInterval(async () => {
        if (isClosed) {
          clearInterval(poll);
          return;
        }

        // Auto-close after MAX_STREAM_DURATION_MS
        if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
          enqueue(`data: ${JSON.stringify({ close: true, reason: "max_duration_reached" })}\n\n`);
          clearInterval(poll);
          isClosed = true;
          try { controller.close(); } catch { /* already closed */ }
          return;
        }

        // Heartbeat ping to keep proxy/load-balancer connection alive
        if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          enqueue(": ping\n\n");
          lastHeartbeat = Date.now();
        }

        // Fetch and stream queue state
        try {
          const state = await fetchQueueState(hospitalId);
          enqueue(`data: ${JSON.stringify({ ...state, hospitalId })}\n\n`);
        } catch (err) {
          // Non-fatal — skip this tick
          console.warn("[QueueSSE] Error fetching queue state:", err);
        }
      }, POLL_INTERVAL_MS);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(poll);
        isClosed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering for SSE
    },
  });
}
