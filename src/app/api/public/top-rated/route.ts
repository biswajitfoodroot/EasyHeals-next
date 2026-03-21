import { and, desc, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { parseStringArray } from "@/lib/profiles";

// Category → specialty keywords mapping
const CATEGORY_SPECIALTY_MAP: Record<string, string[]> = {
  cardiology: ["cardio", "heart", "cardiac"],
  ortho: ["ortho", "bone", "joint", "spine", "fracture"],
  diagnostic: ["diagnostic", "lab", "pathology", "radiology"],
  hospital: [],
};

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "hospital";
  const city = req.nextUrl.searchParams.get("city") ?? "";
  const limit = Math.min(6, Math.max(3, Number(req.nextUrl.searchParams.get("limit") ?? 6)));

  try {
    const specialtyKeywords = CATEGORY_SPECIALTY_MAP[category] ?? [];

    const conditions = [eq(hospitals.isPrivate, true)];

    // Filter by city when provided (case-insensitive prefix/contains match)
    if (city.trim()) {
      conditions.push(like(hospitals.city, `%${city.trim()}%`));
    }

    if (specialtyKeywords.length > 0) {
      // Filter by any matching specialty keyword in the specialties JSON column
      const specialtyFilters = specialtyKeywords.map((kw) =>
        like(hospitals.specialties, `%${kw}%`),
      );
      conditions.push(or(...specialtyFilters)!);
    }

    // When city is specified, try city-filtered results first; fall back to global if empty
    let rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        slug: hospitals.slug,
        city: hospitals.city,
        rating: hospitals.rating,
        reviewCount: hospitals.reviewCount,
        specialties: hospitals.specialties,
      })
      .from(hospitals)
      .where(and(...conditions))
      .orderBy(desc(hospitals.rating), desc(hospitals.reviewCount))
      .limit(limit);

    // Fall back to global top-rated if city returned no results
    if (rows.length === 0 && city.trim()) {
      const globalConditions = [eq(hospitals.isPrivate, true)];
      if (specialtyKeywords.length > 0) {
        const specialtyFilters = specialtyKeywords.map((kw) =>
          like(hospitals.specialties, `%${kw}%`),
        );
        globalConditions.push(or(...specialtyFilters)!);
      }
      rows = await db
        .select({
          id: hospitals.id,
          name: hospitals.name,
          slug: hospitals.slug,
          city: hospitals.city,
          rating: hospitals.rating,
          reviewCount: hospitals.reviewCount,
          specialties: hospitals.specialties,
        })
        .from(hospitals)
        .where(and(...globalConditions))
        .orderBy(desc(hospitals.rating), desc(hospitals.reviewCount))
        .limit(limit);
    }

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      rating: row.rating,
      reviewCount: row.reviewCount,
      specialties: parseStringArray(row.specialties).slice(0, 4),
    }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
