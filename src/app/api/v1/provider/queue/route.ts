/**
 * GET  /api/v1/provider/queue  — today's OPD token queue
 * POST /api/v1/provider/queue  — add walk-in token
 *
 * Auth: hospital_admin / doctor / receptionist (own hospital)
 * Query: ?providerId=&doctorId=&date=YYYY-MM-DD
 */

import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { opdTokens } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor", "receptionist"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayStr();
  const doctorId = url.searchParams.get("doctorId") ?? null;
  const providerId =
    auth.role === "hospital_admin" ? (auth.entityId ?? url.searchParams.get("providerId"))
    : url.searchParams.get("providerId");

  if (!providerId) {
    throw new AppError("SYS_UNHANDLED", "Missing providerId", "providerId is required.", 400);
  }

  const conditions = [
    eq(opdTokens.providerId, providerId),
    eq(opdTokens.date, date),
  ];
  if (doctorId) conditions.push(eq(opdTokens.doctorId, doctorId));

  const rows = await db
    .select()
    .from(opdTokens)
    .where(and(...conditions))
    .orderBy(asc(opdTokens.tokenNumber));

  return NextResponse.json({ data: rows, date, providerId });
});

const addTokenSchema = z.object({
  providerId: z.string().uuid().optional(), // optional — auto from auth for hospital_admin
  doctorId: z.string().uuid().optional(),
  patientName: z.string().min(1).max(100).optional(),
  patientPhone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // default today
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor", "receptionist"]);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = addTokenSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const effectiveProviderId =
    auth.role === "hospital_admin" ? auth.entityId! : (parsed.data.providerId ?? "");

  if (!effectiveProviderId) {
    throw new AppError("SYS_UNHANDLED", "Missing providerId", "providerId is required.", 400);
  }

  const date = parsed.data.date ?? todayStr();

  // Get next token number for this provider+date
  const existing = await db
    .select({ tokenNumber: opdTokens.tokenNumber })
    .from(opdTokens)
    .where(and(eq(opdTokens.providerId, effectiveProviderId), eq(opdTokens.date, date)))
    .orderBy(asc(opdTokens.tokenNumber));

  const nextToken = existing.length > 0
    ? Math.max(...existing.map((r) => r.tokenNumber)) + 1
    : 1;

  const [token] = await db
    .insert(opdTokens)
    .values({
      providerId: effectiveProviderId,
      doctorId: parsed.data.doctorId ?? null,
      tokenNumber: nextToken,
      patientName: parsed.data.patientName ?? null,
      patientPhone: parsed.data.patientPhone ?? null,
      notes: parsed.data.notes ?? null,
      date,
      status: "waiting",
    })
    .returning();

  return NextResponse.json({ data: token }, { status: 201 });
});
