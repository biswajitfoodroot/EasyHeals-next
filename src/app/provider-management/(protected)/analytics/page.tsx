import { db } from "@/db/client";
import {
  commissionEntries, referralCases, hospitals, providerAgreements,
} from "@/db/schema";
import { eq, desc, sum, count, sql, and, gte } from "drizzle-orm";

export const metadata = { title: "Analytics | EasyHeals Provider Management" };

function formatInr(paise: number | string | bigint | null | undefined) {
  const n = typeof paise === "bigint" ? Number(paise) : Number(paise ?? 0);
  if (!n) return "₹0";
  return `₹${(n / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default async function AnalyticsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Commission totals by status
  const commissionByStatus = await db
    .select({
      status: commissionEntries.status,
      total: sum(commissionEntries.amountPaise),
      count: count(),
    })
    .from(commissionEntries)
    .groupBy(commissionEntries.status);

  const commMap = Object.fromEntries(commissionByStatus.map((r) => [r.status, r]));

  // Referral funnel counts
  const referralByStatus = await db
    .select({
      status: referralCases.status,
      count: count(),
    })
    .from(referralCases)
    .groupBy(referralCases.status);

  const refMap = Object.fromEntries(referralByStatus.map((r) => [r.status, r.count]));

  const totalReferrals = referralByStatus.reduce((s, r) => s + r.count, 0);

  // Top hospitals by commissions earned
  const topHospitals = await db
    .select({
      hospitalName: hospitals.name,
      hospitalId: commissionEntries.hospitalId,
      total: sum(commissionEntries.amountPaise),
      count: count(),
    })
    .from(commissionEntries)
    .leftJoin(hospitals, eq(hospitals.id, commissionEntries.hospitalId))
    .where(eq(commissionEntries.status, "paid"))
    .groupBy(commissionEntries.hospitalId)
    .orderBy(desc(sum(commissionEntries.amountPaise)))
    .limit(8);

  // Recent 30-day commissions total
  const [recent30] = await db
    .select({ total: sum(commissionEntries.amountPaise) })
    .from(commissionEntries)
    .where(gte(commissionEntries.createdAt, thirtyDaysAgo));

  // Agreement counts
  const agreementByStatus = await db
    .select({
      status: providerAgreements.status,
      count: count(),
    })
    .from(providerAgreements)
    .groupBy(providerAgreements.status);

  const agrMap = Object.fromEntries(agreementByStatus.map((r) => [r.status, r.count]));
  const totalAgreements = agreementByStatus.reduce((s, r) => s + r.count, 0);

  // Top hospitals by referrals sent
  const topReferringHospitals = await db
    .select({
      hospitalName: hospitals.name,
      orgId: referralCases.referringOrganizationId,
      count: count(),
    })
    .from(referralCases)
    .leftJoin(hospitals, eq(hospitals.id, referralCases.referringOrganizationId))
    .groupBy(referralCases.referringOrganizationId)
    .orderBy(desc(count()))
    .limit(6);

  // Referral funnel stages for funnel visualization
  const funnelStages = [
    { label: "Submitted", status: "submitted", value: (refMap["submitted"] ?? 0) + (refMap["triaging"] ?? 0) + (refMap["destination_suggested"] ?? 0) + (refMap["accepted"] ?? 0) + (refMap["booked"] ?? 0) + (refMap["completed"] ?? 0) },
    { label: "Accepted", status: "accepted", value: (refMap["accepted"] ?? 0) + (refMap["booked"] ?? 0) + (refMap["completed"] ?? 0) },
    { label: "Booked", status: "booked", value: (refMap["booked"] ?? 0) + (refMap["completed"] ?? 0) },
    { label: "Completed", status: "completed", value: refMap["completed"] ?? 0 },
  ];

  const maxFunnelValue = funnelStages[0]?.value || 1;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-400">Network performance, referral funnel, and commission overview</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Commissions (30 days)",
            value: formatInr(recent30?.total ?? 0),
            color: "text-indigo-700",
            sub: `${commMap["pending"]?.count ?? 0} pending · ${commMap["paid"]?.count ?? 0} paid`,
          },
          {
            label: "Total Paid Out",
            value: formatInr(commMap["paid"]?.total ?? 0),
            color: "text-green-700",
            sub: `${commMap["paid"]?.count ?? 0} entries`,
          },
          {
            label: "Total Referrals",
            value: totalReferrals.toString(),
            color: "text-slate-800",
            sub: `${refMap["completed"] ?? 0} completed`,
          },
          {
            label: "Active Agreements",
            value: (agrMap["accepted"] ?? 0).toString(),
            color: "text-blue-700",
            sub: `${agrMap["draft"] ?? 0} draft · ${totalAgreements} total`,
          },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">{c.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Commission by Status</h2>
          <div className="space-y-3">
            {[
              { status: "pending",   label: "Pending",   color: "bg-amber-400" },
              { status: "confirmed", label: "Confirmed", color: "bg-blue-400" },
              { status: "locked",    label: "Locked",    color: "bg-indigo-400" },
              { status: "paid",      label: "Paid",      color: "bg-green-500" },
              { status: "disputed",  label: "Disputed",  color: "bg-red-400" },
            ].map(({ status, label, color }) => {
              const row = commMap[status];
              const total = row ? Number(row.total ?? 0) : 0;
              const allTotal = commissionByStatus.reduce((s, r) => s + Number(r.total ?? 0), 1);
              const pct = Math.round((total / allTotal) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                    <span className="text-xs text-slate-500">{formatInr(total)} · {row?.count ?? 0} entries</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referral funnel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Referral Funnel</h2>
          {totalReferrals === 0 ? (
            <p className="text-sm text-slate-400">No referral data yet.</p>
          ) : (
            <div className="space-y-3">
              {funnelStages.map((stage, i) => {
                const pct = Math.round((stage.value / maxFunnelValue) * 100);
                const colors = ["bg-indigo-500", "bg-indigo-400", "bg-indigo-300", "bg-indigo-200"];
                const convRate = i > 0 && funnelStages[i - 1].value > 0
                  ? Math.round((stage.value / funnelStages[i - 1].value) * 100)
                  : null;
                return (
                  <div key={stage.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{stage.label}</span>
                      <span className="text-xs text-slate-500">
                        {stage.value}
                        {convRate !== null && (
                          <span className="ml-1 text-indigo-500">({convRate}% conv.)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[i] ?? "bg-indigo-200"} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Rejected", value: refMap["rejected"] ?? 0, color: "text-red-500" },
                  { label: "Dropped", value: refMap["dropped"] ?? 0, color: "text-slate-500" },
                  { label: "Disputed", value: refMap["disputed"] ?? 0, color: "text-amber-600" },
                  { label: "In Progress", value: (refMap["triaging"] ?? 0) + (refMap["destination_suggested"] ?? 0) + (refMap["accepted"] ?? 0), color: "text-blue-600" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-slate-500">{s.label}</span>
                    <span className={`font-semibold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top hospitals by commissions paid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">Top Hospitals by Commissions Paid</h2>
          </div>
          {topHospitals.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No paid commissions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {topHospitals.map((h, i) => (
                  <tr key={h.hospitalId ?? i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-400 w-6">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {h.hospitalName ?? h.hospitalId?.slice(0, 12) ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">{h.count} entries</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {formatInr(h.total ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top referring hospitals */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">Top Referring Hospitals</h2>
          </div>
          {topReferringHospitals.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No referral data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {topReferringHospitals.map((h, i) => (
                  <tr key={h.orgId ?? i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-400 w-6">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {h.hospitalName ?? h.orgId?.slice(0, 12) ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                      {h.count} referrals
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Agreement distribution */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Agreement Status Distribution</h2>
        <div className="flex flex-wrap gap-3">
          {agreementByStatus.map((a) => {
            const colors: Record<string, string> = {
              accepted:   "bg-green-50 text-green-700 border-green-200",
              draft:      "bg-slate-100 text-slate-500 border-slate-200",
              published:  "bg-blue-50 text-blue-700 border-blue-200",
              rejected:   "bg-amber-50 text-amber-700 border-amber-200",
              expired:    "bg-orange-50 text-orange-700 border-orange-200",
              terminated: "bg-red-50 text-red-700 border-red-200",
            };
            return (
              <div key={a.status}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${colors[a.status] ?? colors.draft}`}>
                <span className="capitalize">{a.status}</span>
                <span className="text-lg font-bold">{a.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
