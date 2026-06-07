import { and, eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "admin_manager", "admin_editor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const city = url.searchParams.get("city")?.trim();
  const type = url.searchParams.get("type") ?? "hospital";

  if (q.length < 2) return NextResponse.json({ results: [] });

  if (type === "doctor") {
    const conditions = [eq(doctors.isActive, true), like(doctors.fullName, `%${q}%`)];
    if (city) conditions.push(like(doctors.city, `%${city}%`));

    const rows = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        specialization: doctors.specialization,
        city: doctors.city,
        slug: doctors.slug,
      })
      .from(doctors)
      .where(and(...(conditions as Parameters<typeof and>)))
      .limit(10);

    return NextResponse.json({ results: rows });
  }

  // hospital
  const conditions = [eq(hospitals.isActive, true), like(hospitals.name, `%${q}%`)];
  if (city) conditions.push(like(hospitals.city, `%${city}%`));

  const rows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      slug: hospitals.slug,
      type: hospitals.type,
    })
    .from(hospitals)
    .where(and(...(conditions as Parameters<typeof and>)))
    .limit(10);

  return NextResponse.json({ results: rows });
}
