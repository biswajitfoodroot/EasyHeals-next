import { env } from "@/lib/env";

const BASE = "https://maps.googleapis.com/maps/api/place";

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Pune: { lat: 18.5204, lng: 73.8567 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
};

const GOV_PATTERNS = [
  /government/i,
  /\bgovt\b/i,
  /municipal/i,
  /civil hospital/i,
  /district hospital/i,
  /primary health/i,
  /\bphc\b/i,
  /\bchc\b/i,
  /\baiims\b/i,
  /public hospital/i,
  /state hospital/i,
  /medical college/i,
];

export function isGovernmentHospital(name: string): boolean {
  return GOV_PATTERNS.some((pattern) => pattern.test(name));
}

export interface RawPlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text: string[] };
  rating?: number;
  user_ratings_total?: number;
}

const FALLBACK_PLACES: Record<string, RawPlace[]> = {
  Pune: [
    {
      place_id: "fallback-apollo-pune",
      name: "Apollo Hospitals Pune",
      formatted_address: "Wakad, Pune, Maharashtra",
      geometry: { location: { lat: 18.5943, lng: 73.7857 } },
      rating: 4.6,
      user_ratings_total: 2000,
    },
    {
      place_id: "fallback-rubyhall-pune",
      name: "Ruby Hall Clinic Pune",
      formatted_address: "Sassoon Road, Pune, Maharashtra",
      geometry: { location: { lat: 18.5291, lng: 73.8752 } },
      rating: 4.4,
      user_ratings_total: 1600,
    },
  ],
};

export async function fetchCityHospitals(
  city: string,
  lat: number,
  lng: number,
  radius = 50_000,
): Promise<RawPlace[]> {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return FALLBACK_PLACES[city] ?? [];
  }

  const results: RawPlace[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE}/nearbysearch/json`);
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("type", "hospital");
    url.searchParams.set("keyword", "private hospital clinic nursing home");
    url.searchParams.set("key", key);

    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) break;

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{
        place_id: string;
        name: string;
        vicinity?: string;
        formatted_address?: string;
        geometry: { location: { lat: number; lng: number } };
        rating?: number;
        user_ratings_total?: number;
      }>;
      next_page_token?: string;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      break;
    }

    for (const row of data.results ?? []) {
      results.push({
        place_id: row.place_id,
        name: row.name,
        formatted_address: row.formatted_address ?? row.vicinity ?? `${city}, India`,
        geometry: row.geometry,
        rating: row.rating,
        user_ratings_total: row.user_ratings_total,
      });
    }

    pageToken = data.next_page_token;
  } while (pageToken && results.length < 500);

  return results.filter((item) => !isGovernmentHospital(item.name));
}

export async function fetchPlaceDetails(placeId: string): Promise<Partial<RawPlace>> {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return {};

  const url = new URL(`${BASE}/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "formatted_phone_number,website,opening_hours,rating,user_ratings_total,formatted_address",
  );
  url.searchParams.set("key", key);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) return {};

  const data = (await response.json()) as {
    result?: Partial<RawPlace>;
  };

  return data.result ?? {};
}


