import { and, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { CITY_COORDS, fetchCityHospitals, fetchPlaceDetails } from "@/lib/places";
import { slugify } from "@/lib/strings";

const requestSchema = z.object({
  city: z.string().min(2).max(80),
  batchSize: z.coerce.number().int().min(1).max(500).default(100),
  dryRun: z.boolean().default(false),
});

function makeUniqueSlug(name: string, city: string, placeId: string): string {
  const base = slugify(`${name}-${city}`);
  const suffix = slugify(placeId).slice(-8) || Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { city, batchSize, dryRun } = parsed.data;
    const coords = CITY_COORDS[city];

    if (!coords) {
      return NextResponse.json(
        {
          error: `Unsupported city for phase 1 auto-populate: ${city}`,
          supportedCities: Object.keys(CITY_COORDS),
        },
        { status: 400 },
      );
    }

    const rawPlaces = await fetchCityHospitals(city, coords.lat, coords.lng);
    const batch = rawPlaces.slice(0, batchSize);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const preview: Array<{ name: string; city: string; placeId: string }> = [];

    for (const place of batch) {
      try {
        const existing = await db
          .select({ id: hospitals.id })
          .from(hospitals)
          .where(
            or(
              eq(hospitals.googlePlaceId, place.place_id),
              and(eq(hospitals.city, city), like(hospitals.name, place.name)),
            ),
          )
          .limit(1);

        if (existing.length) {
          skipped += 1;
          continue;
        }

        const details = await fetchPlaceDetails(place.place_id);

        const record = {
          name: place.name,
          slug: makeUniqueSlug(place.name, city, place.place_id),
          type: "hospital",
          isPrivate: true,
          city,
          country: "India",
          addressLine1: details.formatted_address ?? place.formatted_address,
          address: {
            street: details.formatted_address ?? place.formatted_address,
            city,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          phone: details.formatted_phone_number ?? null,
          phones: details.formatted_phone_number ? [details.formatted_phone_number] : [],
          website: details.website ?? null,
          workingHours: details.opening_hours ?? null,
          verified: false,
          communityVerified: false,
          source: "google_places",
          googlePlaceId: place.place_id,
          rating: details.rating ?? place.rating ?? 0,
          reviewCount: place.user_ratings_total ?? 0,
          regStatus: "pending",
          packageTier: "free",
        };

        if (dryRun) {
          preview.push({ name: place.name, city, placeId: place.place_id });
          inserted += 1;
          continue;
        }

        const created = await db.insert(hospitals).values(record).onConflictDoNothing();
        if (created.rowsAffected > 0) {
          inserted += 1;
        } else {
          skipped += 1;
        }
      } catch {
        errors += 1;
      }
    }

    return NextResponse.json({
      city,
      totalFetched: rawPlaces.length,
      totalProcessed: batch.length,
      inserted,
      skipped,
      errors,
      dryRun,
      preview: preview.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Auto-populate failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

