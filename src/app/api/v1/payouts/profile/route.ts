import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { providerPayoutProfiles } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

const OPS_ROLES = ["owner", "admin", "operator"];
const PROVIDER_ROLES = ["hospital_admin", "doctor"];

// GET — fetch payout profile for the authenticated provider (or ?entityId= for ops)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let entityId: string;

  if (OPS_ROLES.includes(auth.role)) {
    const id = new URL(req.url).searchParams.get("entityId");
    if (!id) return NextResponse.json({ error: "entityId required" }, { status: 400 });
    entityId = id;
  } else if (PROVIDER_ROLES.includes(auth.role) && auth.entityId) {
    entityId = auth.entityId;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [profile] = await db.select().from(providerPayoutProfiles)
      .where(eq(providerPayoutProfiles.entityId, entityId))
      .limit(1);

    if (!profile) return NextResponse.json({ data: null });

    // Mask sensitive fields for non-ops
    if (!OPS_ROLES.includes(auth.role)) {
      return NextResponse.json({
        data: {
          ...profile,
          bankAccountNumber: profile.bankAccountNumber
            ? `****${profile.bankAccountNumber.slice(-4)}`
            : null,
          panNumber: profile.panNumber
            ? `${profile.panNumber.slice(0, 3)}****${profile.panNumber.slice(-2)}`
            : null,
        },
      });
    }

    return NextResponse.json({ data: profile });
  } catch (e) {
    console.error("GET /api/v1/payouts/profile", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — create or update payout profile
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let entityId: string;
  let entityType: string;

  if (OPS_ROLES.includes(auth.role)) {
    const body0 = await req.json() as {
      entityId: string;
      entityType: string;
      beneficiaryName?: string;
      bankAccountNumber?: string;
      ifscCode?: string;
      upiId?: string;
      panNumber?: string;
    };
    if (!body0.entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 });
    entityId = body0.entityId;
    entityType = body0.entityType ?? "hospital";

    return upsertProfile(entityId, entityType, body0);
  } else if (auth.role === "hospital_admin" && auth.entityId) {
    entityId = auth.entityId;
    entityType = "hospital";
  } else if (auth.role === "doctor" && auth.entityId) {
    entityId = auth.entityId;
    entityType = "doctor";
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      beneficiaryName?: string;
      bankAccountNumber?: string;
      ifscCode?: string;
      upiId?: string;
      panNumber?: string;
    };

    return upsertProfile(entityId, entityType, body);
  } catch (e) {
    console.error("POST /api/v1/payouts/profile", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function upsertProfile(
  entityId: string,
  entityType: string,
  fields: {
    beneficiaryName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    panNumber?: string;
  }
) {
  try {
    const now = new Date();
    const [existing] = await db.select().from(providerPayoutProfiles)
      .where(eq(providerPayoutProfiles.entityId, entityId))
      .limit(1);

    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: now };
      // Reset verification on sensitive field changes
      const sensitiveChanged =
        (fields.bankAccountNumber && fields.bankAccountNumber !== existing.bankAccountNumber) ||
        (fields.panNumber && fields.panNumber !== existing.panNumber);

      if (fields.beneficiaryName !== undefined) updates.beneficiaryName = fields.beneficiaryName;
      if (fields.bankAccountNumber !== undefined) updates.bankAccountNumber = fields.bankAccountNumber;
      if (fields.ifscCode !== undefined) updates.ifscCode = fields.ifscCode;
      if (fields.upiId !== undefined) updates.upiId = fields.upiId;
      if (fields.panNumber !== undefined) updates.panNumber = fields.panNumber;

      if (sensitiveChanged) {
        updates.status = "pending";
        updates.verifiedByUserId = null;
        updates.verifiedAt = null;
      }

      const [updated] = await db.update(providerPayoutProfiles)
        .set(updates)
        .where(eq(providerPayoutProfiles.entityId, entityId))
        .returning();
      return NextResponse.json({ data: updated });
    }

    const [created] = await db.insert(providerPayoutProfiles).values({
      entityId,
      entityType,
      beneficiaryName: fields.beneficiaryName,
      bankAccountNumber: fields.bankAccountNumber,
      ifscCode: fields.ifscCode,
      upiId: fields.upiId,
      panNumber: fields.panNumber,
      status: "pending",
    }).returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    console.error("upsertProfile error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
