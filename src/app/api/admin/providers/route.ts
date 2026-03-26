/**
 * GET /api/admin/providers — List hospitals and doctors with network status
 *
 * Auth: admin session (owner/admin/advisor role)
 * Query: type (hospital|doctor|all), verified (true|false|all), network (all|yes|no)
 */

import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitals, doctors, providerAgreements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const typeFilter   = url.searchParams.get("type")    ?? "all";
  const networkFilter = url.searchParams.get("network") ?? "all"; // all | yes | no

  // Fetch all accepted agreements (for JOIN)
  const agreements = await db
    .select({
      id: providerAgreements.id,
      hospitalId: providerAgreements.hospitalId,
      doctorId: providerAgreements.doctorId,
      entityType: providerAgreements.entityType,
      tierCode: providerAgreements.tierCode,
      agreementType: providerAgreements.agreementType,
      status: providerAgreements.status,
      acceptedAt: providerAgreements.acceptedAt,
    })
    .from(providerAgreements)
    .where(eq(providerAgreements.status, "accepted"));

  // Index by entity id for O(1) lookup
  const agreementByHospital = new Map(
    agreements.filter((a) => a.hospitalId).map((a) => [a.hospitalId!, a])
  );
  const agreementByDoctor = new Map(
    agreements.filter((a) => a.doctorId).map((a) => [a.doctorId!, a])
  );

  const results: {
    id: string;
    name: string;
    type: "hospital" | "doctor";
    city: string | null;
    isActive: boolean;
    isVerified: boolean | null;
    createdAt: string | null;
    phone: string | null;
    networkTierCode: string | null;
    agreementId: string | null;
    agreementType: string | null;
    agreementStatus: string | null;
    acceptedAt: string | null;
  }[] = [];

  if (typeFilter === "all" || typeFilter === "hospital") {
    const hospitalRows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        city: hospitals.city,
        isActive: hospitals.isActive,
        verified: hospitals.verified,
        phone: hospitals.phone,
        createdAt: hospitals.createdAt,
      })
      .from(hospitals)
      .limit(200);

    for (const h of hospitalRows) {
      const ag = agreementByHospital.get(h.id) ?? null;
      results.push({
        id: h.id,
        name: h.name ?? "Unknown",
        type: "hospital",
        city: h.city,
        isActive: h.isActive,
        isVerified: h.verified ?? null,
        createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : (h.createdAt as string | null),
        phone: h.phone,
        networkTierCode:  ag?.tierCode       ?? null,
        agreementId:      ag?.id             ?? null,
        agreementType:    ag?.agreementType  ?? null,
        agreementStatus:  ag?.status         ?? null,
        acceptedAt:       ag?.acceptedAt instanceof Date
          ? ag.acceptedAt.toISOString()
          : (ag?.acceptedAt as string | null) ?? null,
      });
    }
  }

  if (typeFilter === "all" || typeFilter === "doctor") {
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        isActive: doctors.isActive,
        verified: doctors.verified,
        phone: doctors.phone,
        createdAt: doctors.createdAt,
      })
      .from(doctors)
      .limit(200);

    for (const d of doctorRows) {
      const ag = agreementByDoctor.get(d.id) ?? null;
      results.push({
        id: d.id,
        name: d.name ?? "Unknown",
        type: "doctor",
        city: null,
        isActive: d.isActive,
        isVerified: d.verified ?? null,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : (d.createdAt as string | null),
        phone: d.phone,
        networkTierCode: ag?.tierCode      ?? null,
        agreementId:     ag?.id            ?? null,
        agreementType:   ag?.agreementType ?? null,
        agreementStatus: ag?.status        ?? null,
        acceptedAt:      ag?.acceptedAt instanceof Date
          ? ag.acceptedAt.toISOString()
          : (ag?.acceptedAt as string | null) ?? null,
      });
    }
  }

  // Filter by network status
  const filtered = networkFilter === "yes"
    ? results.filter((r) => r.networkTierCode !== null)
    : networkFilter === "no"
    ? results.filter((r) => r.networkTierCode === null)
    : results;

  return NextResponse.json({ data: filtered });
});
