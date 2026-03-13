import { and, desc, eq, inArray, like, or } from "drizzle-orm";
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
  const limit = Math.min(6, Math.max(3, Number(req.nextUrl.searchParams.get("limit") ?? 6)));

  try {
    const specialtyKeywords = CATEGORY_SPECIALTY_MAP[category] ?? [];

    const conditions = [eq(hospitals.isPrivate, true)];

    if (specialtyKeywords.length > 0) {
      // Filter by any matching specialty keyword in the specialties JSON column
      const specialtyFilters = specialtyKeywords.map((kw) =>
        like(hospitals.specialties, `%${kw}%`),
      );
      conditions.push(or(...specialtyFilters)!);
    }

    const rows = await db
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
