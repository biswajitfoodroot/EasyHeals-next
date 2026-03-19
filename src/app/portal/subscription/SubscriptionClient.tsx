"use client";

import Link from "next/link";

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

interface Props {
  currentSub: CurrentSub | null;
  plans: Plan[];
  userRole: string;
  hospitalId?: string;
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function SubscriptionClient({ currentSub, plans, userRole, hospitalId }: Props) {
  const STATUS_COLORS: Record<string, string> = {
    active:    "bg-green-50 text-green-700 border-green-200",
    expired:   "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
    trial:     "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-14 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "#1B8A4A" }}>E</span>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">EasyHeals</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { href: "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard" },
            { href: "/portal/hospital", icon: "🏥", label: "Edit Profile" },
            { href: "/portal/schedule", icon: "📅", label: "Schedule" },
            { href: "/portal/queue", icon: "🎫", label: "OPD Queue" },
            { href: "/portal/staff", icon: "👥", label: "Staff" },
            { href: "/portal/subscription", icon: "💳", label: "Subscription", active: true },
          ].map((n) => (
            <Link key={n.label} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${"active" in n && n.active ? "text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={"active" in n && n.active ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base">{n.icon}</span>
              <span className="hidden lg:block">{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
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
      </main>
    </div>
  );
}
