import { and, desc, eq, isNotNull, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals, providerAgreements } from "@/db/schema";
import { getCitySearchTerms } from "@/lib/city-aliases";
import { parseStringArray } from "@/lib/profiles";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";
  const limit = Math.min(20, Math.max(3, Number(req.nextUrl.searchParams.get("limit") ?? 8)));

  try {
    if (!city.trim()) {
      return NextResponse.json({ data: [], error: "City required" }, { status: 400 });
    }

    // Get all DB spelling variants for the requested city
    const searchTerms = getCitySearchTerms(city);

    // Build OR conditions for all city name variants
    const cityConditions = searchTerms.map((term) => like(hospitals.city, `%${term}%`));

    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        slug: hospitals.slug,
        city: hospitals.city,
        state: hospitals.state,
        rating: hospitals.rating,
        reviewCount: hospitals.reviewCount,
        verified: hospitals.verified,
        communityVerified: hospitals.communityVerified,
        specialties: hospitals.specialties,
      })
      .from(hospitals)
      .where(
        and(
          eq(hospitals.isActive, true),
          eq(hospitals.isPrivate, true),
          or(...cityConditions)!,
        )
      )
      .orderBy(
        desc(hospitals.verified),
        desc(hospitals.rating),
        desc(hospitals.reviewCount),
      )
      .limit(limit);

    // Fetch network tier mappings
    const networkAgreements = await db
      .select({ hospitalId: providerAgreements.hospitalId, tierCode: providerAgreements.tierCode })
      .from(providerAgreements)
      .where(and(eq(providerAgreements.status, "accepted"), isNotNull(providerAgreements.hospitalId)));

    const networkMap = new Map(networkAgreements.map((a) => [a.hospitalId!, a.tierCode ?? null]));

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      state: row.state,
      rating: row.rating || 0,
      reviewCount: row.reviewCount || 0,
      verified: Boolean(row.verified),
      communityVerified: Boolean(row.communityVerified),
      networkTierCode: networkMap.get(row.id) ?? null,
      specialties: parseStringArray(row.specialties),
    }));

    return NextResponse.json({ data, count: data.length });
  } catch (error) {
    console.error("hospitals-by-city error:", error);
    return NextResponse.json({ data: [], error: "Failed to fetch hospitals" }, { status: 500 });
  }
}
