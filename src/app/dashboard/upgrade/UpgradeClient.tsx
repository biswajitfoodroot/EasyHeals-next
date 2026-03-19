"use client";

import Link from "next/link";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "",
    color: "border-slate-200",
    badge: null,
    features: [
      "✓ Hospital & doctor search",
      "✓ Appointment booking",
      "✓ Basic dashboard",
      "✗ Document upload & AI extraction",
      "✗ AI Health Coach",
      "✗ Health Timeline",
      "✗ Vitals analytics",
    ],
    cta: "Current plan",
    ctaDisabled: true,
  },
  {
    id: "health_plus",
    name: "Health+",
    price: "₹299",
    period: "/month",
    color: "border-green-400",
    badge: "Most Popular",
    features: [
      "✓ Hospital & doctor search",
      "✓ Appointment booking",
      "✓ Document upload + AI extraction",
      "✓ AI Health Coach (50 messages/mo)",
      "✓ Health Timeline",
      "✓ Vitals analytics",
      "✓ 2 device syncs",
    ],
    cta: "Upgrade to Health+",
    ctaDisabled: false,
  },
  {
    id: "health_pro",
    name: "Health Pro",
    price: "₹599",
    period: "/month",
    color: "border-purple-400",
    badge: "Best Value",
    features: [
      "✓ Everything in Health+",
      "✓ Unlimited AI Coach messages",
      "✓ Unlimited device syncs",
      "✓ Family profiles (up to 5)",
      "✓ PDF health report export",
      "✓ Priority appointment booking",
      "✓ Pre-Visit AI Brief",
    ],
    cta: "Upgrade to Pro",
    ctaDisabled: false,
  },
];

const PREMIUM_FEATURES = [
  {
    icon: "🔬",
    title: "AI Document Extraction",
    desc: "Upload any lab report or prescription. Our AI reads it and extracts diagnoses, vitals, medications, and lab values — stored securely in your encrypted health memory.",
  },
  {
    icon: "🤖",
    title: "AI Health Coach",
    desc: "Ask anything about your health. The coach understands your full history — past reports, medications, vitals — and gives personalised, context-aware guidance.",
  },
  {
    icon: "📈",
    title: "Vitals Analytics",
    desc: "Track trends in your blood pressure, glucose, weight, and more over time. Get AI-generated insights when readings fall outside normal range.",
  },
  {
    icon: "📷",
    title: "Camera Capture",
    desc: "Take a photo of your prescription or report from your phone. AI extracts the data instantly — no scanning needed.",
  },
];

export default function UpgradeClient() {
  function handleUpgrade(planId: string) {
    // TODO: integrate Razorpay subscription flow (P7)
    alert(`Razorpay payment for ${planId} coming soon! Contact admin@easyheals.com to upgrade manually.`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Upgrade</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

        {/* Hero */}
        <div className="text-center">
          <div className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
            21-DAY FREE TRIAL INCLUDED
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Your health deserves AI-powered care
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
            EasyHeals reads your reports, remembers your health history, coaches you, and flags concerns — so you walk into every doctor visit fully prepared.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 ${plan.color} shadow-sm p-6 flex flex-col relative`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}
              <h2 className="text-lg font-bold text-slate-800 mb-1">{plan.name}</h2>
              <div className="flex items-baseline gap-0.5 mb-4">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className={f.startsWith("✗") ? "text-slate-300" : ""}>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => !plan.ctaDisabled && handleUpgrade(plan.id)}
                disabled={plan.ctaDisabled}
                className={`w-full py-2.5 text-sm font-semibold rounded-xl transition ${
                  plan.ctaDisabled
                    ? "bg-slate-100 text-slate-400 cursor-default"
                    : plan.id === "health_plus"
                    ? "text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                style={!plan.ctaDisabled && plan.id === "health_plus" ? { background: "#1B8A4A" } : {}}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Feature highlights */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 text-center mb-6">What you unlock with Health+</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PREMIUM_FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">{f.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DPDP / security note */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-xs text-blue-700 text-center">
          <strong>Your data is safe.</strong> All health records are encrypted with AES-256-GCM. We comply with the
          Digital Personal Data Protection (DPDP) Act 2023. You can export or delete your data at any time
          from <Link href="/dashboard/privacy" className="underline">Privacy Settings</Link>.
        </div>

        {/* Contact */}
        <p className="text-center text-xs text-slate-400">
          Questions? Email <a href="mailto:admin@easyheals.com" className="underline">admin@easyheals.com</a>
        </p>
      </div>
    </div>
  );
}
