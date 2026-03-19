/**
 * GET /api/admin/providers — List hospitals and doctors for verification
 *
 * Auth: admin session (owner/admin/advisor role)
 * Query: type (hospital|doctor|all), verified (true|false|all)
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals, doctors } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type") ?? "all";
  const verifiedFilter = url.searchParams.get("verified"); // "true" | "false" | null

  const results: {
    id: string;
    name: string;
    type: "hospital" | "doctor";
    city: string | null;
    isActive: boolean;
    isVerified: boolean | null;
    createdAt: string | null;
    phone: string | null;
  }[] = [];

  if (typeFilter === "all" || typeFilter === "hospital") {
    const hospitalRows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        city: hospitals.city,
        isActive: hospitals.isActive,
        phone: hospitals.phone,
        createdAt: hospitals.createdAt,
      })
      .from(hospitals)
      .limit(100);

    for (const h of hospitalRows) {
      results.push({
        id: h.id,
        name: h.name ?? "Unknown",
        type: "hospital",
        city: h.city,
        isActive: h.isActive,
        isVerified: null, // Add isVerified column in future migration
        createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : (h.createdAt as string | null),
        phone: h.phone,
      });
    }
  }

  if (typeFilter === "all" || typeFilter === "doctor") {
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        isActive: doctors.isActive,
        phone: doctors.phone,
        createdAt: doctors.createdAt,
      })
      .from(doctors)
      .limit(100);

    for (const d of doctorRows) {
      results.push({
        id: d.id,
        name: d.name ?? "Unknown",
        type: "doctor",
        city: null,
        isActive: d.isActive,
        isVerified: null,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : (d.createdAt as string | null),
        phone: d.phone,
      });
    }
  }

  // Filter by verified status (client-side for now since isVerified column pending migration)
  const filtered = verifiedFilter === "false"
    ? results.filter((r) => !r.isVerified)
    : results;

  return NextResponse.json({ data: filtered });
});
