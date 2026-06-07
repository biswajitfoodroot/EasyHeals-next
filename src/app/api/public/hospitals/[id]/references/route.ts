/**
 * GET /api/public/hospitals/[id]/references
 * Returns AI-enrichment source references for a hospital, grouped by field.
 */

import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { ingestionFieldConfidences } from "@/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const rows = await db
    .select({
      fieldKey: ingestionFieldConfidences.fieldKey,
      extractedValue: ingestionFieldConfidences.extractedValue,
      sourceType: ingestionFieldConfidences.sourceType,
      sourceUrl: ingestionFieldConfidences.sourceUrl,
      confidence: ingestionFieldConfidences.confidence,
      createdAt: ingestionFieldConfidences.createdAt,
    })
    .from(ingestionFieldConfidences)
    .where(
      and(
        eq(ingestionFieldConfidences.entityType, "hospital"),
        eq(ingestionFieldConfidences.entityId, id),
      ),
    )
    .orderBy(desc(ingestionFieldConfidences.confidence));

  // Group by fieldKey
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    const key = row.fieldKey;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return NextResponse.json({ data: grouped }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
