import { and, asc, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctors, hospitals } from "@/db/schema";
import { parseStringArray } from "@/lib/profiles";

const ALLOWED_TYPES = ["hospital", "doctor", "lab"] as const;
type SearchType = (typeof ALLOWED_TYPES)[number];

function parseTypes(value: string | null): SearchType[] {
  if (!value) return [...ALLOWED_TYPES];

  const parsed = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is SearchType => ALLOWED_TYPES.includes(part as SearchType));

  return parsed.length ? parsed : [...ALLOWED_TYPES];
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const types = parseTypes(req.nextUrl.searchParams.get("types"));
  const limit = Math.min(30, Math.max(5, Number(req.nextUrl.searchParams.get("limit") ?? 12)));

  if (query.length < 2) {
    return NextResponse.json({
      data: {
        query,
        types,
        results: [],
        grouped: { hospitals: [], doctors: [], labs: [] },
      },
    });
  }

  const fuzzy = `%${query}%`;

  const hospitalRows = types.includes("hospital")
    ? await db
        .select({
          id: hospitals.id,
          slug: hospitals.slug,
          name: hospitals.name,
          city: hospitals.city,
          state: hospitals.state,
          type: hospitals.type,
          specialties: hospitals.specialties,
          rating: hospitals.rating,
          verified: hospitals.verified,
        })
        .from(hospitals)
        .where(
          and(
            eq(hospitals.isActive, true),
            eq(hospitals.isPrivate, true),
            eq(hospitals.type, "hospital"),
            or(
              like(hospitals.name, fuzzy),
              like(hospitals.city, fuzzy),
              like(hospitals.specialties, fuzzy),
            ),
          ),
        )
        .orderBy(asc(hospitals.name))
        .limit(limit)
    : [];

  const doctorRows = types.includes("doctor")
    ? await db
        .select({
          id: doctors.id,
          slug: doctors.slug,
          name: doctors.fullName,
          city: doctors.city,
          state: doctors.state,
          specialization: doctors.specialization,
          specialties: doctors.specialties,
          rating: doctors.rating,
          verified: doctors.verified,
        })
        .from(doctors)
        .where(
          and(
            eq(doctors.isActive, true),
            or(
              like(doctors.fullName, fuzzy),
              like(doctors.specialization, fuzzy),
              like(doctors.specialties, fuzzy),
              like(doctors.city, fuzzy),
            ),
          ),
        )
        .orderBy(asc(doctors.fullName))
        .limit(limit)
    : [];

  const labRows = types.includes("lab")
    ? await db
        .select({
          id: hospitals.id,
          slug: hospitals.slug,
          name: hospitals.name,
          city: hospitals.city,
          state: hospitals.state,
          type: hospitals.type,
          specialties: hospitals.specialties,
          rating: hospitals.rating,
          verified: hospitals.verified,
        })
        .from(hospitals)
        .where(
          and(
            eq(hospitals.isActive, true),
            eq(hospitals.isPrivate, true),
            or(
              eq(hospitals.type, "lab"),
              eq(hospitals.type, "diagnostic"),
              eq(hospitals.type, "diagnostic_center"),
            ),
            or(
              like(hospitals.name, fuzzy),
              like(hospitals.city, fuzzy),
              like(hospitals.specialties, fuzzy),
            ),
          ),
        )
        .orderBy(asc(hospitals.name))
        .limit(limit)
    : [];

  const grouped = {
    hospitals: hospitalRows.map((row) => ({
      type: "hospital" as const,
      id: row.id,
      slug: row.slug,
      title: row.name,
      subtitle: [row.city, row.state].filter(Boolean).join(", "),
      specialties: parseStringArray(row.specialties),
      rating: row.rating ?? 0,
      verified: Boolean(row.verified),
      url: `/hospitals/${row.slug}`,
    })),
    doctors: doctorRows.map((row) => ({
      type: "doctor" as const,
      id: row.id,
      slug: row.slug,
      title: row.name,
      subtitle: [row.specialization, row.city, row.state].filter(Boolean).join(" · "),
      specialties: parseStringArray(row.specialties),
      rating: row.rating ?? 0,
      verified: Boolean(row.verified),
      url: `/doctors/${row.slug}`,
    })),
    labs: labRows.map((row) => ({
      type: "lab" as const,
      id: row.id,
      slug: row.slug,
      title: row.name,
      subtitle: [row.city, row.state].filter(Boolean).join(", "),
      specialties: parseStringArray(row.specialties),
      rating: row.rating ?? 0,
      verified: Boolean(row.verified),
      url: `/hospitals/${row.slug}`,
    })),
  };

  return NextResponse.json({
    data: {
      query,
      types,
      grouped,
      results: [...grouped.hospitals, ...grouped.doctors, ...grouped.labs],
    },
  });
}
