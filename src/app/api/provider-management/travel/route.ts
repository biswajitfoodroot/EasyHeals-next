import { eq, desc, count } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { travelCases, travelQuotes, users } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const ALLOWED_ROLES = ["owner", "admin", "operator", "coordinator"];

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const rows = await db
    .select({
      id: travelCases.id,
      referralCaseId: travelCases.referralCaseId,
      patientName: travelCases.patientName,
      patientPhone: travelCases.patientPhone,
      destinationCity: travelCases.destinationCity,
      checkInDate: travelCases.checkInDate,
      checkOutDate: travelCases.checkOutDate,
      guestCount: travelCases.guestCount,
      budgetPaise: travelCases.budgetPaise,
      requirements: travelCases.requirements,
      status: travelCases.status,
      assignedCoordinatorId: travelCases.assignedCoordinatorId,
      coordinatorName: users.fullName,
      commissionPaise: travelCases.commissionPaise,
      notes: travelCases.notes,
      createdAt: travelCases.createdAt,
      updatedAt: travelCases.updatedAt,
    })
    .from(travelCases)
    .leftJoin(users, eq(users.id, travelCases.assignedCoordinatorId))
    .where(status ? eq(travelCases.status, status) : undefined)
    .orderBy(desc(travelCases.createdAt))
    .limit(100);

  // Attach quote counts
  const quoteCounts = await db
    .select({ travelCaseId: travelQuotes.travelCaseId, cnt: count() })
    .from(travelQuotes)
    .groupBy(travelQuotes.travelCaseId);

  const quoteMap = new Map(quoteCounts.map((q) => [q.travelCaseId, q.cnt]));

  const data = rows.map((r) => ({ ...r, quoteCount: quoteMap.get(r.id) ?? 0 }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    patientName?: string;
    patientPhone?: string;
    destinationCity?: string;
    checkInDate?: string;
    checkOutDate?: string;
    guestCount?: number;
    budgetPaise?: number;
    requirements?: string;
    referralCaseId?: string;
  } | null;

  if (!body?.patientName) {
    return NextResponse.json({ error: "patientName required" }, { status: 400 });
  }

  const [row] = await db
    .insert(travelCases)
    .values({
      patientName: body.patientName,
      patientPhone: body.patientPhone ?? null,
      destinationCity: body.destinationCity ?? null,
      checkInDate: body.checkInDate ? new Date(body.checkInDate) : null,
      checkOutDate: body.checkOutDate ? new Date(body.checkOutDate) : null,
      guestCount: body.guestCount ?? 1,
      budgetPaise: body.budgetPaise ?? null,
      requirements: body.requirements ?? null,
      referralCaseId: body.referralCaseId ?? null,
      createdByUserId: auth.userId,
    })
    .returning({ id: travelCases.id });

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
