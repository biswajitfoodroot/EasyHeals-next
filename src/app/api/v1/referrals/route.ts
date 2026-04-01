import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, desc, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { referralCases, referralCaseEvents, providerAgreements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator", "coordinator"];

// GET — list referral cases
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 30;
  const offset = (page - 1) * limit;

  let auth;
  try {
    const result = await requireAuth(req);
    // requireAuth returns NextResponse on auth failure
    if (result instanceof NextResponse) return result;
    auth = result;
  } catch (e) {
    console.error("GET /api/v1/referrals auth error", e);
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  try {
    let rows;

    if (OPS_ROLES.includes(auth.role)) {
      // Ops see all cases
      let q = db.select().from(referralCases);
      if (statusFilter) q = q.where(eq(referralCases.status, statusFilter)) as typeof q;
      rows = await q.orderBy(desc(referralCases.createdAt)).limit(limit).offset(offset);
    } else if (auth.role === "hospital_admin" && auth.entityId) {
      // Hospital sees: cases they referred out OR cases incoming to them
      rows = await db.select().from(referralCases)
        .where(or(
          eq(referralCases.referringOrganizationId, auth.entityId),
          eq(referralCases.selectedDestinationOrgId, auth.entityId),
        ))
        .orderBy(desc(referralCases.createdAt))
        .limit(limit).offset(offset);
    } else if (auth.role === "doctor" && auth.entityId) {
      rows = await db.select().from(referralCases)
        .where(or(
          eq(referralCases.referringProviderId, auth.entityId),
          eq(referralCases.selectedDestinationProviderId, auth.entityId),
        ))
        .orderBy(desc(referralCases.createdAt))
        .limit(limit).offset(offset);
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: rows, page, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Table/column not yet created — return empty result until db:push is run
    if (msg.includes("no such table") || msg.includes("no such column") || msg.includes("has no column")) {
      return NextResponse.json({ data: [], page, limit });
    }
    console.error("GET /api/v1/referrals", e);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}

// POST — create referral case
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!["hospital_admin", "doctor", "receptionist", "owner", "admin", "operator"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      patientId?: string;
      patientName?: string;
      patientPhone?: string;
      referralType?: string;
      clinicalCategory?: string;
      suspectedCondition?: string;
      urgency?: string;
      clinicalNotes?: string;
      destinationMode?: string;
      selectedDestinationProviderId?: string;
      selectedDestinationOrgId?: string;
      destinationCity?: string;
      destinationState?: string;
      outstationRequired?: boolean;
      accommodationRequired?: boolean;
      consentGiven?: boolean;
      agreementId?: string;
    };

    if (!body.patientId && !body.patientName) {
      return NextResponse.json({ error: "patientId or patientName required" }, { status: 400 });
    }

    const referralCode = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const [created] = await db.insert(referralCases).values({
      referralCode,
      patientId: body.patientId,
      patientName: body.patientName,
      patientPhone: body.patientPhone,
      sourceType: auth.role === "doctor" ? "doctor" : "clinic",
      referringProviderId: auth.role === "doctor" ? auth.entityId : undefined,
      referringOrganizationId: auth.role === "hospital_admin" || auth.role === "receptionist"
        ? auth.entityId : undefined,
      referralType: body.referralType ?? "doctor_to_hospital",
      clinicalCategory: body.clinicalCategory,
      suspectedCondition: body.suspectedCondition,
      urgency: body.urgency ?? "routine",
      clinicalNotes: body.clinicalNotes,
      destinationMode: body.destinationMode ?? "selected_provider",
      selectedDestinationProviderId: body.selectedDestinationProviderId,
      selectedDestinationOrgId: body.selectedDestinationOrgId,
      destinationCity: body.destinationCity,
      destinationState: body.destinationState,
      outstationRequired: body.outstationRequired ?? false,
      accommodationRequired: body.accommodationRequired ?? false,
      status: "submitted",
      consentGiven: body.consentGiven ?? false,
      agreementId: body.agreementId,
      createdByActorType: auth.role,
      createdByActorId: auth.userId,
    }).returning();

    await db.insert(referralCaseEvents).values({
      referralCaseId: created.id,
      eventType: "submitted",
      createdByActorType: auth.role,
      createdByActorId: auth.userId,
      note: "Referral case created and submitted.",
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/v1/referrals", msg);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}
