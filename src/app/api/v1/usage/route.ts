/**
 * POST /api/v1/usage
 * Internal endpoint called by messaging/AI services to record usage.
 * Body: { hospitalId, type: "sms" | "whatsapp" | "ai_reports", count?: number }
 */
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { subscriptionUsage } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const INTERNAL_ROLES = ["owner", "admin", "operator"];

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !INTERNAL_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    hospitalId?: string;
    type?: "sms" | "whatsapp" | "ai_reports";
    count?: number;
  } | null;

  if (!body?.hospitalId || !body.type) {
    return NextResponse.json({ error: "hospitalId and type required" }, { status: 400 });
  }

  const count = Math.max(1, body.count ?? 1);
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const colMap: Record<string, string> = {
    sms: "sms_used",
    whatsapp: "whatsapp_used",
    ai_reports: "ai_reports_used",
  };
  const col = colMap[body.type];
  if (!col) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  // Upsert the row — increment the used counter
  const [existing] = await db
    .select({ id: subscriptionUsage.id })
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.hospitalId, body.hospitalId),
        eq(subscriptionUsage.billingPeriod, billingPeriod),
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(subscriptionUsage)
      .set({
        ...(body.type === "sms"       ? { smsUsed:       sql`${subscriptionUsage.smsUsed} + ${count}` }       : {}),
        ...(body.type === "whatsapp"  ? { whatsappUsed:  sql`${subscriptionUsage.whatsappUsed} + ${count}` }  : {}),
        ...(body.type === "ai_reports"? { aiReportsUsed: sql`${subscriptionUsage.aiReportsUsed} + ${count}` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionUsage.id, existing.id));
  } else {
    await db.insert(subscriptionUsage).values({
      hospitalId: body.hospitalId,
      billingPeriod,
      smsUsed:        body.type === "sms"        ? count : 0,
      whatsappUsed:   body.type === "whatsapp"   ? count : 0,
      aiReportsUsed:  body.type === "ai_reports" ? count : 0,
      smsQuota: 0,
      whatsappQuota: 0,
      aiReportsQuota: 0,
    });
  }

  return NextResponse.json({ ok: true, billingPeriod });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const hospitalId = url.searchParams.get("hospitalId") ?? auth.entityId;
  const period = url.searchParams.get("period");

  if (!hospitalId) return NextResponse.json({ error: "hospitalId required" }, { status: 400 });

  const conditions = [eq(subscriptionUsage.hospitalId, hospitalId)];
  if (period) conditions.push(eq(subscriptionUsage.billingPeriod, period));

  const rows = await db
    .select()
    .from(subscriptionUsage)
    .where(and(...conditions))
    .orderBy(subscriptionUsage.billingPeriod)
    .limit(24);

  return NextResponse.json({ data: rows });
}
