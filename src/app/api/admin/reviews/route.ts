/**
 * Admin Reviews Moderation
 *
 * GET  /api/admin/reviews?entityType=hospital&entityId=xxx  — all reviews for entity (any status)
 * GET  /api/admin/reviews?pending=1                         — all pending reviews
 * PATCH /api/admin/reviews?id=xxx  { status, moderationNote }  — approve or reject
 *
 * On approve: recalculates Bayesian rating and persists to hospital/doctor record.
 * On reject:  no rating change.
 *
 * Requires owner/admin/advisor.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { patientReviews, hospitals, doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { onNewReview } from "@/lib/rating.server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as "hospital" | "doctor" | null;
  const entityId = url.searchParams.get("entityId");
  const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | "all" | null;
  const pending = url.searchParams.get("pending");

  if (pending === "1") {
    let rows = await db
      .select()
      .from(patientReviews)
      .where(eq(patientReviews.status, "pending"))
      .orderBy(desc(patientReviews.createdAt))
      .limit(200);

    // Attach entityName for hospitals/doctors
    const hospitalIds = Array.from(new Set(rows.filter((r) => r.entityType === "hospital").map((r) => r.entityId)));
    const doctorIds = Array.from(new Set(rows.filter((r) => r.entityType === "doctor").map((r) => r.entityId)));

    const hospitalMap = new Map<string, string>();
    for (const id of hospitalIds) {
      const [h] = await db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals).where(eq(hospitals.id, id)).limit(1);
      if (h) hospitalMap.set(id, h.name);
    }

    const doctorMap = new Map<string, string>();
    for (const id of doctorIds) {
      const [d] = await db.select({ id: doctors.id, name: doctors.fullName }).from(doctors).where(eq(doctors.id, id)).limit(1);
      if (d) doctorMap.set(id, d.name);
    }

    rows = rows.map((r) => ({ ...r, entityName: r.entityType === "hospital" ? hospitalMap.get(r.entityId) ?? null : doctorMap.get(r.entityId) ?? null }));

    return NextResponse.json({ data: rows });
  }

  const statusFilter = status && status !== "all" ? status : undefined;

  if (!status && !entityType && !entityId) {
    return NextResponse.json(
      { error: "Provide status, entityType, or pending=1" },
      { status: 400 },
    );
  }

  let rows = await db
    .select()
    .from(patientReviews)
    .where(
      and(
        statusFilter ? eq(patientReviews.status, statusFilter) : undefined,
        entityType ? eq(patientReviews.entityType, entityType) : undefined,
        entityId ? eq(patientReviews.entityId, entityId) : undefined,
      ),
    )
    .orderBy(desc(patientReviews.createdAt))
    .limit(200);

  const hospitalIds = Array.from(new Set(rows.filter((r) => r.entityType === "hospital").map((r) => r.entityId)));
  const doctorIds = Array.from(new Set(rows.filter((r) => r.entityType === "doctor").map((r) => r.entityId)));

  const hospitalMap = new Map<string, string>();
  for (const id of hospitalIds) {
    const [h] = await db.select({ id: hospitals.id, name: hospitals.name }).from(hospitals).where(eq(hospitals.id, id)).limit(1);
    if (h) hospitalMap.set(id, h.name);
  }

  const doctorMap = new Map<string, string>();
  for (const id of doctorIds) {
    const [d] = await db.select({ id: doctors.id, name: doctors.fullName }).from(doctors).where(eq(doctors.id, id)).limit(1);
    if (d) doctorMap.set(id, d.name);
  }

  rows = rows.map((r) => ({ ...r, entityName: r.entityType === "hospital" ? hospitalMap.get(r.entityId) ?? null : doctorMap.get(r.entityId) ?? null }));

  return NextResponse.json({ data: rows });
}

// ── PATCH: moderate a review ──────────────────────────────────────────────────

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  moderationNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const body = await req.json() as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const [review] = await db
    .select()
    .from(patientReviews)
    .where(eq(patientReviews.id, id))
    .limit(1);

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  if (review.status !== "pending") {
    return NextResponse.json({ error: "Review is already moderated" }, { status: 409 });
  }

  await db.update(patientReviews).set({
    status: parsed.data.status,
    moderatedByUserId: auth.userId,
    moderatedAt: new Date(),
    moderationNote: parsed.data.moderationNote ?? null,
    updatedAt: new Date(),
  }).where(eq(patientReviews.id, id));

  let ratingResult: Awaited<ReturnType<typeof onNewReview>> | null = null;

  // Recalculate Bayesian rating if approved
  if (parsed.data.status === "approved") {
    // Aggregate all approved ratings for this entity (including this one)
    const agg = await db
      .select({
        count: sql<number>`count(*)`,
        sum: sql<number>`sum(${patientReviews.rating})`,
      })
      .from(patientReviews)
      .where(
        and(
          eq(patientReviews.entityType, review.entityType as "hospital" | "doctor"),
          eq(patientReviews.entityId, review.entityId),
          eq(patientReviews.status, "approved"),
        ),
      );

    const approvedCount = agg[0]?.count ?? 0;
    const approvedSum = agg[0]?.sum ?? 0;

    ratingResult = await onNewReview(
      review.entityType as "hospital" | "doctor",
      review.entityId,
      approvedCount,
      approvedSum,
    );
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: `admin.review.${parsed.data.status}`,
    entityType: review.entityType,
    entityId: review.entityId,
    changes: {
      reviewId: id,
      rating: review.rating,
      newStatus: parsed.data.status,
      newEntityRating: ratingResult?.displayRating,
    },
  });

  return NextResponse.json({
    ok: true,
    reviewId: id,
    newStatus: parsed.data.status,
    entityRating: ratingResult,
  });
}
