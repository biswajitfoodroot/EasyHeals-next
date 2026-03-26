import { db } from "@/db/client";
import {
  hospitals, providerAgreements, commissionEntries, commissionDisputes,
  hospitalSubscriptions, packages, referralCases, entityAccessRequests,
  payoutBatches,
} from "@/db/schema";
import { eq, count, sum, and, gte, desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";

export const metadata = { title: "Provider Management Dashboard | EasyHeals" };

export default async function ProviderManagementDashboard() {
  const auth = await getAuthFromCookies();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Core KPIs — run in parallel
  const [
    [totalHospitals],
    [totalAgreements],
    [pendingCommissions],
    [paidCommissions],
    [lockedCommissions],
    [activeSubscriptions],
    [openDisputes],
    [pendingKyc],
    [pendingPayoutBatches],
  ] = await Promise.all([
    db.select({ count: count() }).from(hospitals).where(eq(hospitals.isActive, true)),
    db.select({ count: count() }).from(providerAgreements).where(eq(providerAgreements.status, "accepted")),
    db.select({ total: sum(commissionEntries.amountPaise) }).from(commissionEntries).where(eq(commissionEntries.status, "pending")),
    db.select({ total: sum(commissionEntries.amountPaise) }).from(commissionEntries).where(eq(commissionEntries.status, "paid")),
    db.select({ total: sum(commissionEntries.amountPaise) }).from(commissionEntries).where(eq(commissionEntries.status, "locked")),
    db.select({ count: count() }).from(hospitalSubscriptions).where(eq(hospitalSubscriptions.status, "active")),
    db.select({ count: count() }).from(commissionDisputes).where(eq(commissionDisputes.status, "open")),
    db.select({ count: count() }).from(entityAccessRequests).where(eq(entityAccessRequests.status, "pending")),
    db.select({ count: count() }).from(payoutBatches).where(eq(payoutBatches.status, "draft")),
  ]);

  // Referral funnel — statuses
  const referralCounts = await db
    .select({ status: referralCases.status, count: count() })
    .from(referralCases)
    .groupBy(referralCases.status);

  const referralMap = Object.fromEntries(referralCounts.map(r => [r.status, r.count]));
  const totalReferrals = Object.values(referralMap).reduce((s, c) => s + c, 0);

  // MRR by tier
  const activeSubs = await db
    .select({ monthlyPrice: packages.monthlyPrice, code: packages.code })
    .from(hospitalSubscriptions)
    .leftJoin(packages, eq(packages.id, hospitalSubscriptions.packageId))
    .where(eq(hospitalSubscriptions.status, "active"));

  const mrrByTier: Record<string, number> = {};
  let totalMrr = 0;
  for (const s of activeSubs) {
    const tier = s.code ?? "unknown";
    mrrByTier[tier] = (mrrByTier[tier] ?? 0) + (s.monthlyPrice ?? 0);
    totalMrr += s.monthlyPrice ?? 0;
  }

  // Recent activity — unassigned referrals
  const unassignedReferrals = await db
    .select({ id: referralCases.id, referralCode: referralCases.referralCode, clinicalCategory: referralCases.clinicalCategory, urgency: referralCases.urgency, createdAt: referralCases.createdAt })
    .from(referralCases)
    .where(and(eq(referralCases.status, "submitted")))
    .orderBy(desc(referralCases.createdAt))
    .limit(5);

  const FUNNEL = [
    { key: "submitted",   label: "Submitted" },
    { key: "triaging",    label: "Triaging" },
    { key: "accepted",    label: "Accepted" },
    { key: "booked",      label: "Booked" },
    { key: "completed",   label: "Completed" },
    { key: "paid",        label: "Paid" },
  ];

  const maxFunnelCount = Math.max(...FUNNEL.map(f => referralMap[f.key] ?? 0), 1);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Provider Management</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Welcome, {auth?.fullName}. Internal EasyHeals operations dashboard.
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Hospitals", value: totalHospitals?.count ?? 0, icon: "🏥", color: "text-slate-800" },
          { label: "Network Agreements", value: totalAgreements?.count ?? 0, icon: "📝", color: "text-indigo-700" },
          { label: "Active Subscriptions", value: activeSubscriptions?.count ?? 0, icon: "💳", color: "text-blue-700" },
          { label: "Total MRR", value: `₹${totalMrr.toLocaleString("en-IN")}`, icon: "📈", color: "text-green-700" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Commission & Ops row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Commission", value: formatInr(pendingCommissions?.total ?? 0), icon: "⏳", color: "text-amber-700" },
          { label: "Locked (in cooldown)", value: formatInr(lockedCommissions?.total ?? 0), icon: "🔒", color: "text-orange-700" },
          { label: "Paid Commission", value: formatInr(paidCommissions?.total ?? 0), icon: "✅", color: "text-green-700" },
          { label: "Open Disputes", value: openDisputes?.count ?? 0, icon: "⚠️", color: "text-red-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Operations Queue + Referral Funnel row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operations Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Operations Queue</h2>
          <div className="space-y-3">
            {[
              { label: "Pending KYC Submissions", value: pendingKyc?.count ?? 0, href: "/provider-management/kyc", color: "text-amber-700", bg: "bg-amber-50" },
              { label: "Pending Payout Batches", value: pendingPayoutBatches?.count ?? 0, href: "/provider-management/payouts", color: "text-indigo-700", bg: "bg-indigo-50" },
              { label: "Unassigned Referrals", value: referralMap["submitted"] ?? 0, href: "/provider-management/referrals", color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Open Commission Disputes", value: openDisputes?.count ?? 0, href: "/provider-management/commissions", color: "text-red-600", bg: "bg-red-50" },
            ].map(item => (
              <a key={item.label} href={item.href}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${item.bg} hover:opacity-80 transition no-underline`}>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Referral Funnel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Referral Funnel
            <span className="ml-2 font-normal text-slate-400 text-xs">({totalReferrals} total)</span>
          </h2>
          <div className="space-y-2.5">
            {FUNNEL.map(f => {
              const val = referralMap[f.key] ?? 0;
              const pct = Math.round((val / maxFunnelCount) * 100);
              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600 font-medium">{f.label}</span>
                    <span className="text-xs font-bold text-slate-700">{val}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MRR by tier */}
      {Object.keys(mrrByTier).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">MRR by Plan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(mrrByTier).sort((a, b) => b[1] - a[1]).map(([tier, mrr]) => (
              <div key={tier} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{tier}</p>
                <p className="text-lg font-bold text-indigo-700">₹{mrr.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned referrals */}
      {unassignedReferrals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-700">Submitted Referrals Needing Action</h2>
            <a href="/provider-management/referrals" className="text-xs font-semibold text-indigo-600 hover:underline">View all →</a>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Urgency</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unassignedReferrals.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.referralCode ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.clinicalCategory ?? "—"}</td>
                    <td className="px-4 py-3">
                      <UrgencyBadge urgency={r.urgency} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href="/provider-management/referrals" className="text-xs font-semibold text-indigo-600 hover:underline">Assign →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: "/provider-management/providers",     icon: "🏥", title: "Providers",        desc: "View and manage all hospitals on the network" },
          { href: "/provider-management/agreements",    icon: "📝", title: "Agreements",        desc: "Manage EasyHeals network agreements" },
          { href: "/provider-management/referrals",     icon: "🔀", title: "Referrals",         desc: "View and coordinate all referral cases" },
          { href: "/provider-management/commissions",   icon: "💰", title: "Commissions",       desc: "Log and track per-case commission entries" },
          { href: "/provider-management/payouts",       icon: "🏦", title: "Payouts",           desc: "Batch-process and export commission payouts" },
          { href: "/provider-management/subscriptions", icon: "💳", title: "Subscriptions",     desc: "Provider plans, MRR, and upcoming renewals" },
          { href: "/provider-management/agents",        icon: "🤝", title: "Field Agents",      desc: "Agent registrations and attribution tracking" },
          { href: "/provider-management/coordinators",  icon: "👤", title: "Coordinators",      desc: "Care coordinator access configuration" },
          { href: "/provider-management/kyc",           icon: "🪪", title: "KYC Review",        desc: "Review and approve provider KYC requests" },
          { href: "/provider-management/analytics",     icon: "📊", title: "Analytics",         desc: "Referral funnel, commission trends" },
          { href: "/provider-management/appointments",  icon: "📅", title: "Appointments",      desc: "All platform appointments and operations" },
          { href: "/provider-management/travel",        icon: "✈️", title: "Travel Cases",      desc: "Medical travel and accommodation coordination" },
        ].map((l) => (
          <a key={l.href} href={l.href}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all no-underline block">
            <div className="text-xl mb-2">{l.icon}</div>
            <p className="text-sm font-bold text-slate-800">{l.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{l.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatInr(paise: number | string | bigint): string {
  const n = typeof paise === "bigint" ? Number(paise) : Number(paise);
  if (!n) return "₹0";
  return `₹${(n / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const colors: Record<string, string> = {
    routine:            "bg-slate-100 text-slate-600 border-slate-200",
    priority:           "bg-blue-50 text-blue-700 border-blue-200",
    urgent:             "bg-amber-50 text-amber-700 border-amber-200",
    emergency_transfer: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[urgency] ?? colors.routine}`}>
      {urgency.replace("_", " ")}
    </span>
  );
}
