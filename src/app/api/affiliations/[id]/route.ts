import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctorHospitalAffiliations } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const { id } = await params;

  const [updated] = await db
    .update(doctorHospitalAffiliations)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(doctorHospitalAffiliations.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Affiliation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: updated });
}
