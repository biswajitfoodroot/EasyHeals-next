import { desc, eq, sum, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptionUsage, usageTopups, hospitals } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";

export const metadata = { title: "Messaging Usage | EasyHeals Provider Management" };

function UsageBar({ used, quota, color = "bg-indigo-500" }: { used: number; quota: number; color?: string }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-12 text-right ${danger ? "text-red-600" : "text-slate-600"}`}>
        {pct}%
      </span>
    </div>
  );
}

export default async function MessagingUsagePage() {
  await getAuthFromCookies(); // auth in layout

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  type UsageRow = { id: string; hospitalId: string; hospitalName: string | null; billingPeriod: string; smsUsed: number; whatsappUsed: number; aiReportsUsed: number; smsQuota: number; whatsappQuota: number; aiReportsQuota: number; updatedAt: Date | null };
  type TopupRow = { id: string; hospitalId: string; hospitalName: string | null; topupType: string; quantityAdded: number; amountPaise: number; status: string; expiresAt: Date | null; createdAt: Date | null };

  let currentUsage: UsageRow[] = [];
  let topups: TopupRow[] = [];

  try {
    // Current month usage joined with hospital names
    currentUsage = await db
      .select({
        id: subscriptionUsage.id,
        hospitalId: subscriptionUsage.hospitalId,
        hospitalName: hospitals.name,
        billingPeriod: subscriptionUsage.billingPeriod,
        smsUsed: subscriptionUsage.smsUsed,
        whatsappUsed: subscriptionUsage.whatsappUsed,
        aiReportsUsed: subscriptionUsage.aiReportsUsed,
        smsQuota: subscriptionUsage.smsQuota,
        whatsappQuota: subscriptionUsage.whatsappQuota,
        aiReportsQuota: subscriptionUsage.aiReportsQuota,
        updatedAt: subscriptionUsage.updatedAt,
      })
      .from(subscriptionUsage)
      .leftJoin(hospitals, eq(hospitals.id, subscriptionUsage.hospitalId))
      .where(eq(subscriptionUsage.billingPeriod, currentPeriod))
      .orderBy(desc(subscriptionUsage.smsUsed));

    // Active topups
    topups = await db
      .select({
        id: usageTopups.id,
        hospitalId: usageTopups.hospitalId,
        hospitalName: hospitals.name,
        topupType: usageTopups.topupType,
        quantityAdded: usageTopups.quantityAdded,
        amountPaise: usageTopups.amountPaise,
        status: usageTopups.status,
        expiresAt: usageTopups.expiresAt,
        createdAt: usageTopups.createdAt,
      })
      .from(usageTopups)
      .leftJoin(hospitals, eq(hospitals.id, usageTopups.hospitalId))
      .where(eq(usageTopups.status, "active"))
      .orderBy(desc(usageTopups.createdAt))
      .limit(50);
  } catch {
    // Tables may not exist yet — run db:push to create new schema tables
  }

  // Platform totals
  const totalSmsUsed = currentUsage.reduce((s, r) => s + (r.smsUsed ?? 0), 0);
  const totalWhatsappUsed = currentUsage.reduce((s, r) => s + (r.whatsappUsed ?? 0), 0);
  const totalAiUsed = currentUsage.reduce((s, r) => s + (r.aiReportsUsed ?? 0), 0);
  const totalSmsQuota = currentUsage.reduce((s, r) => s + (r.smsQuota ?? 0), 0);
  const totalWhatsappQuota = currentUsage.reduce((s, r) => s + (r.whatsappQuota ?? 0), 0);
  const totalAiQuota = currentUsage.reduce((s, r) => s + (r.aiReportsQuota ?? 0), 0);

  const overQuota = currentUsage.filter(
    r => (r.smsQuota > 0 && r.smsUsed >= r.smsQuota) ||
         (r.whatsappQuota > 0 && r.whatsappUsed >= r.whatsappQuota) ||
         (r.aiReportsQuota > 0 && r.aiReportsUsed >= r.aiReportsQuota)
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Messaging & AI Usage</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Platform quota consumption for {currentPeriod}
        </p>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "SMS", used: totalSmsUsed, quota: totalSmsQuota, color: "bg-blue-500", icon: "💬" },
          { label: "WhatsApp", used: totalWhatsappUsed, quota: totalWhatsappQuota, color: "bg-green-500", icon: "📱" },
          { label: "AI Reports", used: totalAiUsed, quota: totalAiQuota, color: "bg-indigo-500", icon: "🤖" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">{s.icon} {s.label}</p>
              <p className="text-xs text-slate-400">{s.quota > 0 ? `${s.quota} quota` : "no quota"}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 mb-2">{s.used.toLocaleString()}</p>
            {s.quota > 0 && <UsageBar used={s.used} quota={s.quota} color={s.color} />}
          </div>
        ))}
      </div>

      {/* Over-quota alerts */}
      {overQuota.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">⚠️ Quota Exhausted ({overQuota.length} hospital{overQuota.length > 1 ? "s" : ""})</p>
          <div className="space-y-1">
            {overQuota.map(r => (
              <p key={r.id} className="text-xs text-red-600">
                <span className="font-semibold">{r.hospitalName ?? r.hospitalId}</span>
                {r.smsQuota > 0 && r.smsUsed >= r.smsQuota && " — SMS at limit"}
                {r.whatsappQuota > 0 && r.whatsappUsed >= r.whatsappQuota && " — WhatsApp at limit"}
                {r.aiReportsQuota > 0 && r.aiReportsUsed >= r.aiReportsQuota && " — AI Reports at limit"}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Per-hospital usage table */}
      {currentUsage.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Per-Hospital Usage — {currentPeriod}</h2>
            <span className="text-xs text-slate-400">{currentUsage.length} hospitals</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SMS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">WhatsApp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">AI Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentUsage.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{r.hospitalName ?? "—"}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.hospitalId.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <p className="text-xs text-slate-600 mb-1">{r.smsUsed} / {r.smsQuota}</p>
                      <UsageBar used={r.smsUsed} quota={r.smsQuota} color="bg-blue-500" />
                    </td>
                    <td className="px-4 py-3 min-w-[140px] hidden md:table-cell">
                      <p className="text-xs text-slate-600 mb-1">{r.whatsappUsed} / {r.whatsappQuota}</p>
                      <UsageBar used={r.whatsappUsed} quota={r.whatsappQuota} color="bg-green-500" />
                    </td>
                    <td className="px-4 py-3 min-w-[140px] hidden md:table-cell">
                      <p className="text-xs text-slate-600 mb-1">{r.aiReportsUsed} / {r.aiReportsQuota}</p>
                      <UsageBar used={r.aiReportsUsed} quota={r.aiReportsQuota} color="bg-indigo-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-400 text-sm">No usage data for {currentPeriod} yet.</p>
          <p className="text-xs text-slate-300 mt-1">Usage records are written when hospitals send messages or generate AI reports.</p>
        </div>
      )}

      {/* Active top-ups */}
      {topups.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">Active Top-ups</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topups.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.hospitalName ?? t.hospitalId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {t.topupType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-semibold">+{t.quantityAdded.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {t.amountPaise ? `₹${(t.amountPaise / 100).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString("en-IN") : "No expiry"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
