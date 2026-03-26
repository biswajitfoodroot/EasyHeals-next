"use client";

import Link from "next/link";
import { useState } from "react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "",
    color: "border-slate-200",
    badgeText: null,
    badgeColor: null,
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
    comingSoon: false,
  },
  {
    id: "health_plus",
    name: "Health+",
    price: "₹99",
    period: "/month",
    color: "border-green-400",
    badgeText: "Most Popular",
    badgeColor: "bg-green-500",
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
    comingSoon: false,
  },
  {
    id: "health_pro",
    name: "Health Pro",
    price: "₹399",
    period: "/month",
    color: "border-purple-300",
    badgeText: "Coming Soon",
    badgeColor: "bg-purple-400",
    features: [
      "✓ Everything in Health+",
      "✓ Unlimited AI Coach messages",
      "✓ Unlimited device syncs",
      "✓ Family profiles (up to 5)",
      "✓ PDF health report export",
      "✓ Priority appointment booking",
      "✓ Pre-Visit AI Brief",
    ],
    cta: "Coming Soon",
    ctaDisabled: true,
    comingSoon: true,
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
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimPhone, setClaimPhone] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState<{ expiresAt: string } | null>(null);

  function handleUpgrade(planId: string) {
    alert(`Razorpay payment for ${planId} coming soon! Contact admin@easyheals.com to upgrade manually.`);
  }

  function openClaimModal() {
    setClaimPhone("");
    setClaimError("");
    setClaimSuccess(null);
    setClaimOpen(true);
  }

  async function submitClaim() {
    setClaimError("");
    setClaimBusy(true);
    try {
      const res = await fetch("/api/v1/patients/claim-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: claimPhone }),
      });
      const json = await res.json() as { data?: { expiresAt: string }; error?: string };
      if (!res.ok) {
        setClaimError(json.error ?? "Something went wrong. Please try again.");
      } else if (json.data) {
        setClaimSuccess({ expiresAt: json.data.expiresAt });
      }
    } catch {
      setClaimError("Network error. Please check your connection and try again.");
    } finally {
      setClaimBusy(false);
    }
  }

  function handleClaimClose() {
    setClaimOpen(false);
    if (claimSuccess) {
      window.location.reload();
    }
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
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Your health deserves AI-powered care
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
            EasyHeals reads your reports, remembers your health history, coaches you, and flags concerns — so you walk into every doctor visit fully prepared.
          </p>
        </div>

        {/* Limited time offer banner */}
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md"
          style={{ background: "linear-gradient(135deg, #0d6e3a 0%, #1a9e57 100%)" }}
        >
          <div className="text-white text-center sm:text-left">
            <div className="text-xs font-bold tracking-widest uppercase opacity-80 mb-1">🎉 Limited Time Launch Offer</div>
            <div className="text-xl font-bold">Health+ FREE for 3 Months</div>
            <div className="text-sm opacity-90 mt-1">
              Claim with any valid Indian mobile number — one offer per number.
            </div>
          </div>
          <button
            onClick={openClaimModal}
            className="flex-shrink-0 bg-white text-green-700 font-bold text-sm px-6 py-3 rounded-xl shadow hover:bg-green-50 transition whitespace-nowrap"
          >
            Claim Free 3 Months →
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 ${plan.color} shadow-sm p-6 flex flex-col relative ${plan.comingSoon ? "opacity-75" : ""}`}
            >
              {plan.badgeText && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`${plan.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                    {plan.badgeText}
                  </span>
                </div>
              )}
              <h2 className="text-lg font-bold text-slate-800 mb-1">{plan.name}</h2>
              <div className="flex items-baseline gap-0.5 mb-1">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              {plan.id === "health_plus" && (
                <div className="text-xs text-green-600 font-semibold mb-3">🎉 Free for 3 months — limited offer</div>
              )}
              {plan.id !== "health_plus" && <div className="mb-3" />}
              <ul className="space-y-2 text-xs text-slate-600 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className={f.startsWith("✗") ? "text-slate-300" : ""}>{f}</li>
                ))}
              </ul>

              {plan.id === "health_plus" ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={openClaimModal}
                    className="w-full py-2.5 text-sm font-semibold rounded-xl text-white transition"
                    style={{ background: "#1B8A4A" }}
                  >
                    Claim 3 Months Free
                  </button>
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    className="w-full py-2 text-xs font-medium rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                  >
                    Or pay ₹99/month
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => !plan.ctaDisabled && handleUpgrade(plan.id)}
                  disabled={plan.ctaDisabled}
                  className={`w-full py-2.5 text-sm font-semibold rounded-xl transition ${
                    plan.ctaDisabled
                      ? plan.comingSoon
                        ? "bg-purple-50 text-purple-300 cursor-default border border-purple-100"
                        : "bg-slate-100 text-slate-400 cursor-default"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </button>
              )}
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

      {/* Claim promo modal */}
      {claimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            {claimSuccess ? (
              /* Success state */
              <div className="text-center space-y-4">
                <div className="text-5xl">🎉</div>
                <h2 className="text-xl font-bold text-slate-900">Health+ Activated!</h2>
                <p className="text-sm text-slate-600">
                  Your 3-month free Health+ subscription is active.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                  Valid until{" "}
                  <strong>
                    {new Date(claimSuccess.expiresAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </div>
                <button
                  onClick={handleClaimClose}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition"
                  style={{ background: "#1B8A4A" }}
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              /* Input state */
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Claim 3 Months Free</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Enter your Indian mobile number to activate the offer.</p>
                  </div>
                  <button onClick={handleClaimClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-3">×</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number</label>
                    <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-400">
                      <span className="px-3 py-2.5 bg-slate-50 text-slate-500 text-sm border-r border-slate-300 select-none">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9876543210"
                        value={claimPhone}
                        onChange={(e) => {
                          setClaimPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                          setClaimError("");
                        }}
                        className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">One offer per mobile number across all accounts.</p>
                  </div>

                  {claimError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                      {claimError}
                    </div>
                  )}

                  <button
                    onClick={submitClaim}
                    disabled={claimBusy || claimPhone.length < 10}
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "#1B8A4A" }}
                  >
                    {claimBusy ? "Activating…" : "Activate Health+ Free"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
