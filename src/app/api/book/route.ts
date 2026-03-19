import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { leads } from "@/db/schema";

const bookingSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  city: z.string().max(80).optional(),
  medicalSummary: z.string().max(2000).optional(),
  hospitalId: z.string().optional(),
  doctorName: z.string().max(150).optional(),
  source: z.string().max(60).default("web_booking"),
});

// In-memory IP rate limit — 5 requests per hour per IP.
// Will be replaced by Redis-backed rate limiter in Task 1.6.
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipCounters = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = ipCounters.get(ip);

  if (!entry || now >= entry.resetAt) {
    ipCounters.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetAt: entry.resetAt };
}

/**
 * DEPRECATED — use POST /api/v1/leads (consent-gated, DPDP-compliant).
 * This endpoint will be removed on 2026-06-01.
 * Rate limit: 5 requests per IP per hour.
 */
export async function POST(req: NextRequest) {
  const deprecationHeaders = {
    Deprecation: "true",
    Sunset: "Sat, 01 Jun 2026 00:00:00 GMT",
    Link: '</api/v1/leads>; rel="successor-version"',
  };

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          ...deprecationHeaders,
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      },
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: deprecationHeaders });
  }

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400, headers: deprecationHeaders },
    );
  }

  const [lead] = await db
    .insert(leads)
    .values({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      source: parsed.data.source,
      medicalSummary: parsed.data.medicalSummary,
      hospitalId: parsed.data.hospitalId,
      status: "new",
      score: 20,
    })
    .returning({ id: leads.id });

  return NextResponse.json(
    { data: { id: lead.id }, message: "Booking request received." },
    {
      status: 201,
      headers: {
        ...deprecationHeaders,
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
      },
    },
  );
}
