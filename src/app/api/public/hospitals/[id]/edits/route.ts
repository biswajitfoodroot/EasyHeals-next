/**
 * GET /api/public/hospitals/[id]/edits
 * Returns approved community edit history for a hospital.
 */

import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { contributions, users } from "@/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 50));
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const rows = await db
    .select({
      id: contributions.id,
      fieldChanged: contributions.fieldChanged,
      oldValue: contributions.oldValue,
      newValue: contributions.newValue,
      reviewedAt: contributions.reviewedAt,
      createdAt: contributions.createdAt,
      contributorName: users.fullName,
    })
    .from(contributions)
    .leftJoin(users, eq(contributions.contributorId, users.id))
    .where(
      and(
        eq(contributions.targetType, "hospital"),
        eq(contributions.targetId, id),
        eq(contributions.status, "approved"),
      ),
    )
    .orderBy(desc(contributions.reviewedAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map((r) => ({
    id: r.id,
    fieldChanged: r.fieldChanged,
    oldValue: r.oldValue,
    newValue: r.newValue,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
    contributorName: r.contributorName ?? "Community Member",
  }));

  return NextResponse.json({ data, hasMore }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
