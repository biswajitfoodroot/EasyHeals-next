/**
 * GET /api/v1/location — Task 3.10
 *
 * Returns the user's detected city using:
 *   1. Vercel edge `x-vercel-ip-city` header (primary — works on Vercel infra)
 *   2. `?lat=&lng=` query params — reverse geocoded via Open-Meteo geocoding (no key needed)
 *   3. null if neither is available (client handles gracefully)
 *
 * Response: { city: string | null }
 */
import { NextRequest, NextResponse } from "next/server";

// Simple lat/lng → nearest city lookup using Open-Meteo reverse geocoding
// No API key required. Returns null on any error.
async function reverseGeocode(lat: string, lng: string): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "EasyHeals/1.0 (health directory; contact@easyheals.in)" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { address?: { city?: string; town?: string; county?: string; state?: string } };
    return data.address?.city ?? data.address?.town ?? data.address?.county ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Check for lat/lng query params (browser geolocation path)
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (lat && lng) {
    const city = await reverseGeocode(lat, lng);
    return NextResponse.json({ city }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  // Vercel edge provides x-vercel-ip-city for all requests
  const vercelCity = req.headers.get("x-vercel-ip-city");
  if (vercelCity) {
    // Vercel URL-encodes the city name
    const city = decodeURIComponent(vercelCity);
    return NextResponse.json({ city }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  return NextResponse.json({ city: null });
}
