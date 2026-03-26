import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { channelPartners } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "operator"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    fullName?: string; phone?: string; email?: string; city?: string;
    state?: string; status?: string; fraudFlag?: boolean; notes?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await db.update(channelPartners).set({
    ...(body.fullName !== undefined && { fullName: body.fullName }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.email !== undefined && { email: body.email }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.state !== undefined && { state: body.state }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.fraudFlag !== undefined && { fraudFlag: body.fraudFlag }),
    ...(body.notes !== undefined && { notes: body.notes }),
    updatedAt: new Date(),
  }).where(eq(channelPartners.id, id));

  return NextResponse.json({ ok: true });
}
