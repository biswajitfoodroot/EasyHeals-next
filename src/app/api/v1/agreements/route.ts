import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { providerAgreements, agreementEvents } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];
const PROVIDER_ROLES = ["hospital_admin", "doctor"];

// GET — list agreements
// Operators see all; providers see their own entity's agreements
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const hospitalId = searchParams.get("hospitalId");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");

  try {
    let query = db.select().from(providerAgreements);

    if (OPS_ROLES.includes(auth.role)) {
      // Ops can filter by any entity
      if (hospitalId) query = query.where(eq(providerAgreements.hospitalId, hospitalId)) as typeof query;
      else if (doctorId) query = query.where(eq(providerAgreements.doctorId, doctorId)) as typeof query;
      if (status) query = query.where(eq(providerAgreements.status, status)) as typeof query;
    } else if (PROVIDER_ROLES.includes(auth.role)) {
      // Provider can only see their own entity's published/accepted agreements
      const entityFilter = auth.entityId
        ? auth.role === "hospital_admin"
          ? eq(providerAgreements.hospitalId, auth.entityId)
          : eq(providerAgreements.doctorId, auth.entityId)
        : undefined;

      if (!entityFilter) return NextResponse.json({ data: [] });

      query = query.where(
        and(entityFilter, or(
          eq(providerAgreements.status, "published"),
          eq(providerAgreements.status, "accepted"),
          eq(providerAgreements.status, "rejected"),
        ))
      ) as typeof query;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await query.orderBy(desc(providerAgreements.createdAt)).limit(50);
    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error("GET /api/v1/agreements", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — create agreement draft (ops only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!OPS_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      hospitalId?: string;
      doctorId?: string;
      entityType?: string;
      agreementType?: string;
      termsVersion?: string;
      customTerms?: string;
      tierCode?: string;
      commissionPercent?: number;
      commissionFlat?: number;
      revenueShareNotes?: string;
      expiresAt?: number;
      notes?: string;
    };

    if (!body.hospitalId && !body.doctorId) {
      return NextResponse.json({ error: "hospitalId or doctorId required" }, { status: 400 });
    }

    const [agreement] = await db.insert(providerAgreements).values({
      hospitalId: body.hospitalId ?? null,
      doctorId: body.doctorId ?? null,
      entityType: body.entityType ?? (body.hospitalId ? "hospital" : "doctor"),
      agreementType: body.agreementType ?? "network_partnership",
      termsVersion: body.termsVersion ?? "v1",
      customTerms: body.customTerms,
      tierCode: body.tierCode,
      commissionPercent: body.commissionPercent,
      commissionFlat: body.commissionFlat,
      revenueShareNotes: body.revenueShareNotes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      status: "draft",
      createdBy: auth.userId,
      notes: body.notes,
    }).returning();

    await db.insert(agreementEvents).values({
      agreementId: agreement.id,
      eventType: "created",
      actorId: auth.userId,
      actorType: "operator",
    });

    return NextResponse.json({ data: agreement }, { status: 201 });
  } catch (e) {
    console.error("POST /api/v1/agreements", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
