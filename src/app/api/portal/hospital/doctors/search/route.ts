/**
 * GET /api/portal/hospital/doctors/search?q=name&city=Pune
 * Search existing doctors by name (+ optional city) for the "attach doctor" flow.
 * Returns up to 20 matches — used in portal and brochure apply admin UI.
 */
import { and, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();

  if (q.length < 2) return NextResponse.json({ data: [] });

  const nameParts = q.split(/\s+/).filter((w) => w.length > 1);
  if (nameParts.length === 0) return NextResponse.json({ data: [] });

  const nameConditions = nameParts.map((w) => like(doctors.fullName, `%${w}%`));
  const cityCondition = city ? or(eq(doctors.city, city), like(doctors.city, `%${city}%`)) : undefined;

  const rows = await db
    .select({
      id: doctors.id,
      fullName: doctors.fullName,
      specialization: doctors.specialization,
      city: doctors.city,
      state: doctors.state,
      slug: doctors.slug,
    })
    .from(doctors)
    .where(
      and(
        eq(doctors.isActive, true),
        cityCondition ? and(cityCondition, or(...nameConditions)) : or(...nameConditions),
      ),
    )
    .orderBy(doctors.fullName)
    .limit(20);

  return NextResponse.json({ data: rows });
}
