import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { hospitalSubscriptions, packages, packageFeatures } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";

const PM_ROLES = ["owner", "admin", "admin_manager", "operator"];

const DEFAULT_PACKAGES = [
  {
    code: "free",
    name: "Free",
    monthlyPrice: 0,
    features: ["basic_listing", "appointment_booking", "opd_queue", "patient_records"],
  },
  {
    code: "pro",
    name: "Pro",
    monthlyPrice: 99900, // ₹999/month in paise — stored as real for display
    features: ["basic_listing", "appointment_booking", "opd_queue", "patient_records",
               "whatsapp_reminders", "smart_queue_eta", "ai_daily_summary", "digital_rx",
               "referral_earnings_dashboard"],
  },
  {
    code: "business",
    name: "Business",
    monthlyPrice: 249900, // ₹2499/month
    features: ["basic_listing", "appointment_booking", "opd_queue", "patient_records",
               "whatsapp_reminders", "smart_queue_eta", "ai_daily_summary", "digital_rx",
               "referral_earnings_dashboard", "auto_followup", "broadcast_messaging",
               "multi_doctor_management", "advanced_analytics"],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthlyPrice: 499900, // ₹4999/month
    features: ["basic_listing", "appointment_booking", "opd_queue", "patient_records",
               "whatsapp_reminders", "smart_queue_eta", "ai_daily_summary", "digital_rx",
               "referral_earnings_dashboard", "auto_followup", "broadcast_messaging",
               "multi_doctor_management", "advanced_analytics", "custom_integrations",
               "dedicated_support", "sla_guarantee"],
  },
];

// POST /api/provider-management/subscriptions
// body: { action: "seed_packages" | "assign_plan", hospitalId?, packageCode?, durationDays? }
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || !PM_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  // ── Seed default packages ─────────────────────────────────────────────────
  if (body.action === "seed_packages") {
    const seeded: string[] = [];
    for (const pkg of DEFAULT_PACKAGES) {
      const existing = await db
        .select({ id: packages.id })
        .from(packages)
        .where(eq(packages.code, pkg.code))
        .limit(1);

      if (existing.length) {
        // Update price if changed
        await db.update(packages)
          .set({ name: pkg.name, monthlyPrice: pkg.monthlyPrice / 100, isActive: true })
          .where(eq(packages.code, pkg.code));
      } else {
        const [inserted] = await db.insert(packages)
          .values({ code: pkg.code, name: pkg.name, monthlyPrice: pkg.monthlyPrice / 100 })
          .returning({ id: packages.id });

        // Insert features
        for (const featureKey of pkg.features) {
          await db.insert(packageFeatures).values({ packageId: inserted.id, featureKey, isEnabled: true })
            .onConflictDoNothing();
        }
      }
      seeded.push(pkg.code);
    }
    return NextResponse.json({ ok: true, seeded });
  }

  // ── Assign plan to hospital ───────────────────────────────────────────────
  if (body.action === "assign_plan") {
    const { hospitalId, packageCode, durationDays } = body as {
      hospitalId: string; packageCode: string; durationDays?: number;
    };
    if (!hospitalId || !packageCode) {
      return NextResponse.json({ error: "hospitalId and packageCode required" }, { status: 400 });
    }

    const [pkg] = await db
      .select({ id: packages.id, name: packages.name })
      .from(packages)
      .where(eq(packages.code, packageCode))
      .limit(1);

    if (!pkg) return NextResponse.json({ error: `Package "${packageCode}" not found. Seed packages first.` }, { status: 404 });

    const now = new Date();
    const endsAt = durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

    // Deactivate any existing active subscription
    await db.update(hospitalSubscriptions)
      .set({ status: "expired" })
      .where(and(
        eq(hospitalSubscriptions.hospitalId, hospitalId),
        eq(hospitalSubscriptions.status, "active"),
      ));

    await db.insert(hospitalSubscriptions).values({
      hospitalId,
      packageId: pkg.id,
      status: packageCode === "free" ? "active" : "active",
      startsAt: now,
      endsAt: endsAt,
    });

    return NextResponse.json({ ok: true, hospitalId, packageCode, packageName: pkg.name, endsAt });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
