import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { travelCases, travelQuotes } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const ALLOWED_ROLES = ["owner", "admin", "operator", "coordinator"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [tc] = await db.select().from(travelCases).where(eq(travelCases.id, id)).limit(1);
  if (!tc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quotes = await db.select().from(travelQuotes).where(eq(travelQuotes.travelCaseId, id));

  return NextResponse.json({ data: { ...tc, quotes } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    status?: string;
    notes?: string;
    assignedCoordinatorId?: string | null;
    commissionPaise?: number;
    // quote actions
    action?: "add_quote" | "select_quote";
    quote?: {
      partnerName: string;
      propertyName?: string;
      ratePerNightPaise?: number;
      totalAmountPaise?: number;
      inclusions?: string;
      distanceFromHospitalKm?: number;
      partnerContactPhone?: string;
    };
    quoteId?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Handle quote actions separately
  if (body.action === "add_quote" && body.quote) {
    if (!body.quote.partnerName) {
      return NextResponse.json({ error: "partnerName required" }, { status: 400 });
    }
    await db.insert(travelQuotes).values({
      travelCaseId: id,
      partnerName: body.quote.partnerName,
      propertyName: body.quote.propertyName ?? null,
      ratePerNightPaise: body.quote.ratePerNightPaise ?? null,
      totalAmountPaise: body.quote.totalAmountPaise ?? null,
      inclusions: body.quote.inclusions ?? null,
      distanceFromHospitalKm: body.quote.distanceFromHospitalKm ?? null,
      partnerContactPhone: body.quote.partnerContactPhone ?? null,
    });
    // Auto-advance status to quoted
    await db.update(travelCases)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(travelCases.id, id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "select_quote" && body.quoteId) {
    // Mark selected, decline others
    const allQuotes = await db.select({ id: travelQuotes.id }).from(travelQuotes).where(eq(travelQuotes.travelCaseId, id));
    for (const q of allQuotes) {
      await db.update(travelQuotes)
        .set({ status: q.id === body.quoteId ? "selected" : "declined", selectedAt: q.id === body.quoteId ? new Date() : null })
        .where(eq(travelQuotes.id, q.id));
    }
    await db.update(travelCases)
      .set({ status: "booked", updatedAt: new Date() })
      .where(eq(travelCases.id, id));
    return NextResponse.json({ ok: true });
  }

  // General update
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if ("assignedCoordinatorId" in body) updates.assignedCoordinatorId = body.assignedCoordinatorId;
  if (body.commissionPaise !== undefined) updates.commissionPaise = body.commissionPaise;

  await db.update(travelCases).set(updates).where(eq(travelCases.id, id));

  return NextResponse.json({ ok: true });
}
