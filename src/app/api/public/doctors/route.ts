import { NextRequest, NextResponse } from "next/server";

import { listDoctorsDirectory } from "@/lib/profile-data";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const { items, hasMore } = await listDoctorsDirectory(100, offset);

  const data = items.map((row) => ({
    id: row.id,
    name: row.fullName,
    city: row.city ?? "India",
    state: row.state,
    specialties: row.specialties.length ? row.specialties : row.specialization ? [row.specialization] : [],
    rating: row.rating,
    reviewCount: row.reviewCount,
    verified: row.verified,
    yearsOfExperience: row.yearsOfExperience,
    subtitle: row.specialization,
    url: `/doctors/${row.slug}`,
  }));

  return NextResponse.json({ data, hasMore });
}
