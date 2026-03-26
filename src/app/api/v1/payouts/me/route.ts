import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { commissionEntries, providerPayoutProfiles } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];

/**
 * GET /api/v1/payouts/me
 * Returns the authenticated provider's earnings ledger (recent commission entries)
 * along with their payout profile status.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let hospitalId: string | null = null;
  let doctorId: string | null = null;
  let entityId: string | null = null;

  if (auth.role === "hospital_admin" && auth.entityId) {
    hospitalId = auth.entityId;
    entityId = auth.entityId;
  } else if (auth.role === "doctor" && auth.entityId) {
    doctorId = auth.entityId;
    entityId = auth.entityId;
  } else if (OPS_ROLES.includes(auth.role)) {
    const id = new URL(req.url).searchParams.get("entityId");
    const type = new URL(req.url).searchParams.get("entityType") ?? "hospital";
    if (!id) return NextResponse.json({ error: "entityId required" }, { status: 400 });
    entityId = id;
    if (type === "hospital") hospitalId = id;
    else doctorId = id;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const whereClause = hospitalId
      ? eq(commissionEntries.hospitalId, hospitalId)
      : eq(commissionEntries.doctorId, doctorId!);

    const [entries, payoutProfile] = await Promise.all([
      db.select().from(commissionEntries)
        .where(whereClause)
        .orderBy(desc(commissionEntries.createdAt))
        .limit(50),
      db.select().from(providerPayoutProfiles)
        .where(eq(providerPayoutProfiles.entityId, entityId!))
        .limit(1),
    ]);

    const profile = payoutProfile[0] ?? null;

    return NextResponse.json({
      data: {
        entries,
        payoutProfile: profile
          ? {
              ...profile,
              // Mask sensitive fields for providers (not ops)
              bankAccountNumber: !OPS_ROLES.includes(auth.role) && profile.bankAccountNumber
                ? `****${profile.bankAccountNumber.slice(-4)}`
                : profile.bankAccountNumber,
              panNumber: !OPS_ROLES.includes(auth.role) && profile.panNumber
                ? `${profile.panNumber.slice(0, 3)}****${profile.panNumber.slice(-2)}`
                : profile.panNumber,
            }
          : null,
      },
    });
  } catch (e) {
    console.error("GET /api/v1/payouts/me", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
