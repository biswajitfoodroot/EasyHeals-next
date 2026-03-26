import { db } from "@/db/client";
import { hospitalSubscriptions, hospitals, packages } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import SubscriptionsClient from "./SubscriptionsClient";

export const metadata = { title: "Subscriptions | EasyHeals Provider Management" };

export default async function SubscriptionsPage() {
  const subs = await db
    .select({
      id: hospitalSubscriptions.id,
      status: hospitalSubscriptions.status,
      startsAt: hospitalSubscriptions.startsAt,
      endsAt: hospitalSubscriptions.endsAt,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      hospitalId: hospitalSubscriptions.hospitalId,
      packageName: packages.name,
      packageCode: packages.code,
      monthlyPrice: packages.monthlyPrice,
    })
    .from(hospitalSubscriptions)
    .leftJoin(hospitals, eq(hospitals.id, hospitalSubscriptions.hospitalId))
    .leftJoin(packages, eq(packages.id, hospitalSubscriptions.packageId))
    .orderBy(desc(hospitalSubscriptions.startsAt))
    .limit(200);

  const allPackages = await db
    .select({ id: packages.id, code: packages.code, name: packages.name, monthlyPrice: packages.monthlyPrice })
    .from(packages)
    .where(eq(packages.isActive, true))
    .orderBy(packages.monthlyPrice);

  // KPIs
  const [totalActive] = await db
    .select({ count: count() })
    .from(hospitalSubscriptions)
    .where(eq(hospitalSubscriptions.status, "active"));

  const [totalTrial] = await db
    .select({ count: count() })
    .from(hospitalSubscriptions)
    .where(eq(hospitalSubscriptions.status, "trial"));

  const mrr = subs
    .filter((s) => s.status === "active" && s.monthlyPrice)
    .reduce((sum, s) => sum + (s.monthlyPrice ?? 0), 0);

  const now = Date.now();
  const expiringSoon = subs.filter(
    (s) => s.status === "active" && s.endsAt && new Date(s.endsAt).getTime() - now < 7 * 24 * 60 * 60 * 1000,
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Subscriptions</h1>
          <p className="text-sm text-slate-400">Provider subscription tiers, MRR, and renewals</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active", value: (totalActive?.count ?? 0).toString(), color: "text-green-700" },
          { label: "Trials", value: (totalTrial?.count ?? 0).toString(), color: "text-amber-700" },
          { label: "MRR", value: `₹${mrr.toLocaleString("en-IN")}`, color: "text-indigo-700" },
          { label: "Expiring in 7 days", value: expiringSoon.length.toString(), color: "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800">
            {expiringSoon.length} subscription{expiringSoon.length > 1 ? "s" : ""} expiring within 7 days
          </p>
          <ul className="mt-2 space-y-0.5">
            {expiringSoon.map((s) => (
              <li key={s.id} className="text-xs text-amber-700">
                {s.hospitalName ?? s.hospitalId} — {s.packageName} — expires{" "}
                {s.endsAt ? new Date(s.endsAt).toLocaleDateString("en-IN") : "—"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SubscriptionsClient
        subs={subs.map((s) => ({
          ...s,
          startsAt: s.startsAt ? new Date(s.startsAt).toISOString() : null,
          endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : null,
          hospitalName: s.hospitalName ?? null,
          hospitalCity: s.hospitalCity ?? null,
          packageName: s.packageName ?? null,
          packageCode: s.packageCode ?? null,
          monthlyPrice: s.monthlyPrice ?? null,
        }))}
        packages={allPackages}
        hasPackages={allPackages.length > 0}
      />
    </div>
  );
}
