"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

type LoginMode = "password" | "otp" | "google";
type OtpStep = "phone" | "verify";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function PortalLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");

  // Password login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // OTP login
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState<OtpStep>("phone");
  const [otpToken, setOtpToken] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Redirect helper ─────────────────────────────────────────────────────────
  function redirect(data: { role?: string; portalUrl?: string }) {
    const { role, portalUrl } = data;
    if (portalUrl) { router.push(portalUrl); return; }
    if (role === "hospital_admin") { router.push("/portal/hospital/dashboard"); return; }
    if (role === "doctor") { router.push("/portal/doctor/dashboard"); return; }
    if (["owner", "admin", "advisor", "admin_manager", "admin_editor"].includes(role ?? "")) {
      router.push("/admin"); return;
    }
    router.push("/portal/login");
  }

  // ── Password login ───────────────────────────────────────────────────────────
  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json() as { data?: { role: string; portalUrl?: string }; error?: string };
      if (!res.ok) { setError(json.error ?? "Login failed"); return; }
      redirect(json.data ?? {});
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── OTP: send code ───────────────────────────────────────────────────────────
  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json() as { error?: string; data?: { otpToken?: string } };
      if (!res.ok) { setError(json.error ?? "Failed to send OTP"); return; }
      setOtpToken(json.data?.otpToken ?? null);
      setOtpStep("verify");
      setSuccessMsg("OTP sent to your phone.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── OTP: verify ──────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, otpToken }),
      });
      const json = await res.json() as { data?: { role: string; portalUrl?: string }; error?: string };
      if (!res.ok) { setError(json.error ?? "OTP verification failed"); return; }
      redirect(json.data ?? {});
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "google" || !GOOGLE_CLIENT_ID) return;

    function initGoogle() {
      const win = window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (opts: unknown) => void;
              renderButton: (el: HTMLElement, opts: unknown) => void;
            };
          };
        };
      };
      if (!win.google?.accounts) return;

      win.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
      });

      const btn = document.getElementById("google-portal-btn");
      if (btn) {
        win.google.accounts.id.renderButton(btn, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      }
    }

    // Try immediately then after GSI script loads
    initGoogle();
    window.addEventListener("google-gsi-loaded", initGoogle);
    return () => window.removeEventListener("google-gsi-loaded", initGoogle);
  }, [mode]);

  async function handleGoogleCredential(response: { credential: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential, portalLogin: true }),
      });
      const json = await res.json() as { data?: { role: string; portalUrl?: string }; error?: string };
      if (!res.ok) { setError(json.error ?? "Google sign-in failed"); return; }
      redirect(json.data ?? {});
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => window.dispatchEvent(new Event("google-gsi-loaded"))}
      />

      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="text-3xl mb-2">🏥</div>
            <h1 className="text-2xl font-bold text-slate-800">Provider Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to manage your hospital or clinic profile</p>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            {(["password", "otp", "google"] as LoginMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === m
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "password" ? "📧 Email" : m === "otp" ? "📱 Phone OTP" : "🔵 Google"}
              </button>
            ))}
          </div>

          {/* ── PASSWORD ── */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="you@hospital.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
              {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{error}</div>}
              <SubmitButton busy={busy} label="Sign In" />
            </form>
          )}

          {/* ── PHONE OTP ── */}
          {mode === "otp" && (
            <>
              {otpStep === "phone" ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                      placeholder="+91 98765 43210"
                    />
                    <p className="text-xs text-slate-400 mt-1">Enter the registered mobile number for your hospital or doctor account.</p>
                  </div>
                  {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{error}</div>}
                  <SubmitButton busy={busy} label="Send OTP" />
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {successMsg && (
                    <div className="p-3 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-sm">{successMsg}</div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Enter OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm tracking-widest text-center text-lg font-mono"
                      placeholder="123456"
                    />
                    <p className="text-xs text-slate-400 mt-1">OTP sent to {phone}. <button type="button" className="text-teal-600 hover:underline" onClick={() => setOtpStep("phone")}>Change number</button></p>
                  </div>
                  {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{error}</div>}
                  <SubmitButton busy={busy} label="Verify OTP" />
                </form>
              )}
            </>
          )}

          {/* ── GOOGLE ── */}
          {mode === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 text-center">
                Use your Google account linked to your hospital or clinic profile.
              </p>
              {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{error}</div>}
              <div className="flex justify-center">
                <div id="google-portal-btn" />
              </div>
              {!GOOGLE_CLIENT_ID && (
                <p className="text-xs text-red-500 text-center">Google Client ID not configured.</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-400">
              New provider? <a href="/portal/kyc-request" className="text-teal-600 hover:underline">Request access →</a>
            </p>
            <p className="text-xs text-slate-400">
              EasyHeals Provider Portal · <a href="/" className="hover:underline">Home</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {busy ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Please wait...
        </>
      ) : label}
    </button>
  );
}
