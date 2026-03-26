"use client";

interface CurrentSub {
  id: string;
  packageId: string;
  packageName: string;
  monthlyPrice: number;
  status: string;
  startsAt: string;
  endsAt: string | null;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  features: string[];
}

interface UsageMeters {
  smsUsed: number;
  smsQuota: number;
  whatsappUsed: number;
  whatsappQuota: number;
  aiReportsUsed: number;
  aiReportsQuota: number;
  billingPeriod: string;
}

interface Props {
  currentSub: CurrentSub | null;
  plans: Plan[];
  userRole: string;
  hospitalId?: string;
  usage?: UsageMeters | null;
}

function UsageMeter({ label, icon, used, quota, color }: {
  label: string; icon: string; used: number; quota: number; color: string;
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{icon} {label}</span>
        <span className={`text-xs font-bold ${danger ? "text-red-600" : "text-slate-600"}`}>
          {used.toLocaleString()} {quota > 0 ? `/ ${quota.toLocaleString()}` : "used"}
        </span>
      </div>
      {quota > 0 ? (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full w-0 rounded-full" />
        </div>
      )}
      {quota > 0 && (
        <p className={`text-[10px] mt-0.5 ${danger ? "text-red-500 font-semibold" : "text-slate-400"}`}>
          {pct}% used{danger ? " — quota nearly exhausted" : ""}
        </p>
      )}
    </div>
  );
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function SubscriptionClient({ currentSub, plans, userRole, hospitalId, usage }: Props) {
  const STATUS_COLORS: Record<string, string> = {
    active:    "bg-green-50 text-green-700 border-green-200",
    expired:   "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
    trial:     "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Subscription & Billing</h1>
            <p className="text-sm text-slate-400">Manage your EasyHeals plan</p>
          </div>

          {/* Current plan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">Current Plan</h2>
            {currentSub ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-xl font-bold text-slate-800">{currentSub.packageName}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[currentSub.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {currentSub.status}
                    </span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "#1B8A4A" }}>
                    ₹{currentSub.monthlyPrice.toLocaleString("en-IN")}
                    <span className="text-sm font-normal text-slate-400">/month</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Started {formatDate(currentSub.startsAt)}
                    {currentSub.endsAt ? ` · Renews ${formatDate(currentSub.endsAt)}` : " · Auto-renew on"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <a href="mailto:billing@easyheals.in"
                    className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition text-center">
                    Contact Billing
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm mb-3">No active subscription. Choose a plan below.</p>
              </div>
            )}
          </div>

          {/* Usage meters */}
          {usage && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-700">Usage — {usage.billingPeriod}</h2>
                <span className="text-xs text-slate-400">Current billing period</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <UsageMeter label="SMS" icon="💬" used={usage.smsUsed} quota={usage.smsQuota} color="bg-blue-500" />
                <UsageMeter label="WhatsApp" icon="📱" used={usage.whatsappUsed} quota={usage.whatsappQuota} color="bg-green-500" />
                <UsageMeter label="AI Reports" icon="🤖" used={usage.aiReportsUsed} quota={usage.aiReportsQuota} color="bg-indigo-500" />
              </div>
              {(usage.smsQuota === 0 && usage.whatsappQuota === 0 && usage.aiReportsQuota === 0) && (
                <p className="text-xs text-slate-400 mt-3">Quotas are configured by your plan. Contact billing to see quota details.</p>
              )}
            </div>
          )}

          {/* Available plans */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 mb-4">Available Plans</h2>
            {plans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-slate-400 text-sm">No plans available. Contact support.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isCurrent = currentSub?.packageId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col ${isCurrent ? "border-green-400" : "border-slate-200"}`}
                    >
                      {isCurrent && (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full self-start mb-2">Current Plan</span>
                      )}
                      <h3 className="text-base font-bold text-slate-800">{plan.name}</h3>
                      <p className="text-2xl font-bold mt-1" style={{ color: "#1B8A4A" }}>
                        {plan.monthlyPrice === 0 ? "Free" : `₹${plan.monthlyPrice.toLocaleString("en-IN")}`}
                        {plan.monthlyPrice > 0 && <span className="text-sm font-normal text-slate-400">/mo</span>}
                      </p>

                      {plan.features.length > 0 && (
                        <ul className="mt-3 space-y-1.5 flex-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span>{f.replace(/_/g, " ")}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4">
                        {isCurrent ? (
                          <div className="w-full py-2.5 text-center text-sm font-semibold rounded-xl bg-green-50 text-green-700">Active</div>
                        ) : (
                          <a
                            href={`mailto:billing@easyheals.in?subject=Upgrade to ${plan.name}&body=Hospital ID: ${hospitalId ?? "N/A"}`}
                            className="block w-full py-2.5 text-center text-sm font-semibold rounded-xl text-white transition"
                            style={{ background: "#1B8A4A" }}
                          >
                            {currentSub ? "Upgrade" : "Get Started"}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Billing contact */}
          <div className="bg-slate-100 rounded-2xl p-5">
            <p className="text-sm text-slate-600">
              For invoices, payment issues, or custom enterprise plans, contact{" "}
              <a href="mailto:billing@easyheals.in" className="font-semibold underline" style={{ color: "#1B8A4A" }}>
                billing@easyheals.in
              </a>
            </p>
          </div>
    </div>
  );
}
