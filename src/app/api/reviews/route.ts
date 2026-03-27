/**
 * Patient Reviews API
 *
 * POST /api/reviews          — public: submit a review (status=pending)
 * GET  /api/reviews?entityType=hospital&entityId=xxx  — public: list approved reviews
 * GET  /api/reviews?pending=1  — admin: list pending reviews (requires auth owner/admin/advisor)
 */
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, hospitals, patientReviews } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
// onNewReview imported in admin route only; public route just inserts pending

// ── POST: public review submission ────────────────────────────────────────────

const submitSchema = z.object({
  entityType: z.enum(["hospital", "doctor"]),
  entityId: z.string().min(1),
  patientName: z.string().min(1).max(100),
  patientPhone: z.string().max(20).optional(),
  rating: z.number().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
  visitDate: z.string().optional(), // ISO date string
});

export async function POST(req: NextRequest) {
  const body = await req.json() as unknown;
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Verify entity exists
  if (d.entityType === "hospital") {
    const [h] = await db.select({ id: hospitals.id }).from(hospitals)
      .where(eq(hospitals.id, d.entityId)).limit(1);
    if (!h) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  } else {
    const [doc] = await db.select({ id: doctors.id }).from(doctors)
      .where(eq(doctors.id, d.entityId)).limit(1);
    if (!doc) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const [created] = await db.insert(patientReviews).values({
    entityType: d.entityType,
    entityId: d.entityId,
    patientName: d.patientName,
    patientPhone: d.patientPhone ?? null,
    rating: d.rating,
    title: d.title ?? null,
    body: d.body ?? null,
    visitDate: d.visitDate ? new Date(d.visitDate) : null,
    status: "pending",
    source: "web",
  }).returning();

  return NextResponse.json({ data: created }, { status: 201 });
}

// ── GET: list reviews ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as "hospital" | "doctor" | null;
  const entityId = url.searchParams.get("entityId");
  const pending = url.searchParams.get("pending");

  // Admin: list pending reviews
  if (pending === "1") {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
    if (forbidden) return forbidden;

    const rows = await db
      .select()
      .from(patientReviews)
      .where(eq(patientReviews.status, "pending"))
      .orderBy(desc(patientReviews.createdAt))
      .limit(100);
    return NextResponse.json({ data: rows });
  }

  // Public: list approved reviews for an entity
  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "Provide entityType and entityId, or pending=1 for admin view" },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: patientReviews.id,
      patientName: patientReviews.patientName,
      rating: patientReviews.rating,
      title: patientReviews.title,
      body: patientReviews.body,
      visitDate: patientReviews.visitDate,
      createdAt: patientReviews.createdAt,
    })
    .from(patientReviews)
    .where(
      and(
        eq(patientReviews.entityType, entityType),
        eq(patientReviews.entityId, entityId),
        eq(patientReviews.status, "approved"),
      ),
    )
    .orderBy(desc(patientReviews.createdAt))
    .limit(50);

  return NextResponse.json({ data: rows });
}
