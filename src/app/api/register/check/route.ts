import { and, eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";

const requestSchema = z.object({
  name: z.string().min(2).max(180),
  city: z.string().min(2).max(80),
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

  const rows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      addressLine1: hospitals.addressLine1,
      verified: hospitals.verified,
      claimed: hospitals.claimed,
      googlePlaceId: hospitals.googlePlaceId,
    })
    .from(hospitals)
    .where(and(eq(hospitals.city, city), like(hospitals.name, `%${name}%`)))
    .limit(10);

  return NextResponse.json({ matches: rows });
}

