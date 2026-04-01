import { NextRequest, NextResponse } from "next/server";
import { eq, and, sum, count, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionEntries } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

/**
 * GET /api/v1/commissions/summary
 * Returns aggregated earnings for the authenticated provider (hospital_admin / doctor)
 * or a specific entity for ops (pass ?entityId=&entityType=hospital|doctor).
 *
 * Response shape:
 * {
 *   totalPaise: number,       // all-time total (confirmed + locked + paid)
 *   pendingPaise: number,     // pending entries
 *   confirmedPaise: number,   // confirmed, not yet locked
 *   lockedPaise: number,      // locked, awaiting payout
 *   paidPaise: number,        // already paid out
 *   disputedPaise: number,    // under dispute
 *   entryCount: number,       // total entry rows
 *   pendingCount: number,
 *   lockedCount: number,
 * }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);

  let hospitalId: string | null = null;
  let doctorId: string | null = null;

  if (OPS_ROLES.includes(auth.role)) {
    const entityId = searchParams.get("entityId");
    const entityType = searchParams.get("entityType") ?? "hospital";
    if (!entityId) return NextResponse.json({ error: "entityId required for ops" }, { status: 400 });
    if (entityType === "hospital") hospitalId = entityId;
    else doctorId = entityId;
  } else if (auth.role === "hospital_admin" && auth.entityId) {
    hospitalId = auth.entityId;
  } else if (auth.role === "doctor" && auth.entityId) {
    doctorId = auth.entityId;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const whereClause = hospitalId
      ? eq(commissionEntries.hospitalId, hospitalId)
      : eq(commissionEntries.doctorId, doctorId!);

    const rows = await db.select({
      status: commissionEntries.status,
      amount: commissionEntries.amountPaise,
    }).from(commissionEntries).where(whereClause);

    const summary = {
      totalPaise: 0,
      pendingPaise: 0,
      confirmedPaise: 0,
      lockedPaise: 0,
      paidPaise: 0,
      disputedPaise: 0,
      entryCount: rows.length,
      pendingCount: 0,
      lockedCount: 0,
    };

    for (const row of rows) {
      const amt = row.amount ?? 0;
      switch (row.status) {
        case "pending":
          summary.pendingPaise += amt;
          summary.pendingCount++;
          break;
        case "confirmed":
          summary.confirmedPaise += amt;
          summary.totalPaise += amt;
          break;
        case "locked":
          summary.lockedPaise += amt;
          summary.lockedCount++;
          summary.totalPaise += amt;
          break;
        case "paid":
          summary.paidPaise += amt;
          summary.totalPaise += amt;
          break;
        case "disputed":
          summary.disputedPaise += amt;
          break;
        // reversed — excluded from all totals
      }
    }

    return NextResponse.json({ data: summary });
  } catch (e) {
    console.error("GET /api/v1/commissions/summary", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
