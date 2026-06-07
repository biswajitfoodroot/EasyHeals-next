import { NextRequest, NextResponse } from "next/server";

import { listHospitalsDirectory } from "@/lib/profile-data";
import { normalizeCityName } from "@/lib/strings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const { items, hasMore } = await listHospitalsDirectory(20, offset, q, city);

  const data = items.map((row) => ({
    id: row.id,
    name: row.name,
    city: normalizeCityName(row.city),
    state: row.state,
    specialties: row.specialties,
    rating: row.rating,
    reviewCount: row.reviewCount,
    verified: row.verified,
    subtitle: row.description,
    url: `/hospitals/${row.slug}`,
    networkTierCode: row.networkTierCode,
  }));

  return NextResponse.json({ data, hasMore });
}
