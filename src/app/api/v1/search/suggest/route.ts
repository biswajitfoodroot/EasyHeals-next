/**
 * Search Suggest Endpoint (Task 3.8)
 *
 * GET /api/v1/search/suggest?q=card&city=Bangalore
 *
 * Fast prefix-match on hospital names + specialty names.
 * Returns top 5 suggestions with type tags.
 * Redis cached per prefix+city (TTL 60s).
 * Rate limited: 30/min per IP.
 */
import { NextRequest, NextResponse } from "next/server";
import { like, or, eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { hospitals, doctors } from "@/db/schema";
import { redisGet, redisSet, redisIncr } from "@/lib/core/redis";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

interface Suggestion {
  label: string;
  type: "hospital" | "doctor" | "specialty";
  slug?: string;
  city?: string;
}

// Common specialties for prefix matching
const SPECIALTIES = [
  "Cardiology", "Cardiothoracic Surgery", "Cardio Oncology",
  "Neurology", "Neurosurgery",
  "Orthopaedics", "Oncology",
  "Gastroenterology", "General Surgery",
  "Gynaecology", "Geriatrics",
  "Dermatology", "Diabetology",
  "ENT", "Emergency Medicine",
  "Paediatrics", "Physiotherapy",
  "Psychiatry", "Pulmonology",
  "Radiology", "Rheumatology",
  "Urology", "Vascular Surgery",
  "Ophthalmology", "Obstetrics",
  "Nephrology", "Neonatology",
  "Haematology", "Hepatology",
  "Immunology", "Infectious Disease",
  "Internal Medicine", "ICU",
  "Spine Surgery", "Sports Medicine",
  "Transplant Surgery", "Trauma Surgery",
];

export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const city = url.searchParams.get("city")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Rate limit: 30 requests/min per IP
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rlKey = `rate:suggest:${ip}`;
  const count = await redisIncr(rlKey, 60);
  if (count !== null && count > 30) {
    throw new AppError("SEARCH_RATE_LIMITED", "Suggest rate limit exceeded", "Too many requests. Please slow down.", 429);
  }

  // Cache key
  const cacheKey = `search:suggest:${q.toLowerCase()}:${city.toLowerCase()}`;
  const cached = await redisGet<Suggestion[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ suggestions: cached, cached: true });
  }

  const suggestions: Suggestion[] = [];
  const queryLower = q.toLowerCase();

  // 1. Specialty prefix matches (in-memory — fast)
  const matchedSpecialties = SPECIALTIES.filter((s) =>
    s.toLowerCase().startsWith(queryLower),
  ).slice(0, 2);
  for (const spec of matchedSpecialties) {
    suggestions.push({ label: spec, type: "specialty" });
  }

  // 2. Hospital name prefix matches
  const hospitalFilter = city
    ? and(like(hospitals.name, `${q}%`), eq(hospitals.city, city), eq(hospitals.isActive, true))
    : and(like(hospitals.name, `${q}%`), eq(hospitals.isActive, true));

  const hospitalMatches = await db
    .select({ name: hospitals.name, slug: hospitals.slug, city: hospitals.city })
    .from(hospitals)
    .where(hospitalFilter)
    .limit(3);

  for (const h of hospitalMatches) {
    suggestions.push({
      label: h.name,
      type: "hospital",
      slug: `/hospitals/${h.slug}`,
      city: h.city,
    });
  }

  // 3. Doctor name prefix matches
  const doctorFilter = city
    ? and(like(doctors.fullName, `${q}%`), eq(doctors.city, city), eq(doctors.isActive, true))
    : and(like(doctors.fullName, `${q}%`), eq(doctors.isActive, true));

  const doctorMatches = await db
    .select({ name: doctors.fullName, slug: doctors.slug, city: doctors.city })
    .from(doctors)
    .where(doctorFilter)
    .limit(2);

  for (const d of doctorMatches) {
    suggestions.push({
      label: d.name,
      type: "doctor",
      slug: `/doctors/${d.slug}`,
      city: d.city ?? undefined,
    });
  }

  // Deduplicate and cap at 5
  const final = suggestions.slice(0, 5);

  // Cache for 60s
  await redisSet(cacheKey, final, 60);

  return NextResponse.json({ suggestions: final, cached: false });
});
