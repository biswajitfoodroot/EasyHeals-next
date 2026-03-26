import { and, like, or, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";

const requestSchema = z.object({
  name: z.string().min(2).max(180),
  city: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, city } = parsed.data;

  const nameCondition = like(hospitals.name, `%${name}%`);
  const whereClause = city
    ? and(nameCondition, eq(hospitals.city, city))
    : nameCondition;

  const rows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      pincode: hospitals.addressLine1, // addressLine1 often contains pincode info
      addressLine1: hospitals.addressLine1,
      phone: hospitals.phone,
      type: hospitals.type,
      verified: hospitals.verified,
      claimed: hospitals.claimed,
      rating: hospitals.rating,
      reviewCount: hospitals.reviewCount,
      slug: hospitals.slug,
    })
    .from(hospitals)
    .where(whereClause)
    .limit(12);

  // Return with pincode field null (not stored on hospitals currently)
  const matches = rows.map((r) => ({ ...r, pincode: null }));

  return NextResponse.json({ matches });
}
