/**
 * GET /api/public/stats
 * Returns live platform statistics for the homepage.
 * Cached for 1 hour via ISR revalidation.
 */
import { avg, count, countDistinct, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals, doctors } from "@/db/schema";

export const revalidate = 3600; // ISR — recompute every hour

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k+`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return String(n);
}

export async function GET() {
  try {
    const [hospitalStats] = await db
      .select({
        total: count(hospitals.id),
        cities: countDistinct(hospitals.city),
        avgRating: avg(hospitals.rating),
      })
      .from(hospitals)
      .where(eq(hospitals.isActive, true));

    const [doctorStats] = await db
      .select({ total: count(doctors.id) })
      .from(doctors)
      .where(eq(doctors.isActive, true));

    const totalHospitals = hospitalStats?.total ?? 0;
    const totalCities = hospitalStats?.cities ?? 0;
    const totalDoctors = doctorStats?.total ?? 0;
    const avgRating = parseFloat(String(hospitalStats?.avgRating ?? "0")) || 0;

    return NextResponse.json(
      {
        data: {
          hospitalCount: totalHospitals,
          hospitalLabel: formatCount(totalHospitals),
          cityCount: totalCities,
          cityLabel: formatCount(totalCities),
          doctorCount: totalDoctors,
          doctorLabel: formatCount(totalDoctors),
          languageCount: 9,
          languageLabel: "9+",
          avgRating: avgRating > 0 ? avgRating.toFixed(1) : null,
          ratingLabel: avgRating > 0 ? `${avgRating.toFixed(1)}★` : "4.8★",
        },
      },
      {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
      },
    );
  } catch {
    // Fallback to safe defaults if DB unavailable
    return NextResponse.json({
      data: {
        hospitalCount: 0, hospitalLabel: "—",
        cityCount: 0, cityLabel: "—",
        doctorCount: 0, doctorLabel: "—",
        languageCount: 9, languageLabel: "9+",
        avgRating: null, ratingLabel: "4.8★",
      },
    });
  }
}
