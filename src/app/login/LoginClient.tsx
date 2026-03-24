"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "phone" | "otp";


export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otpRef = useRef<HTMLInputElement>(null);
  const [googleReady, setGoogleReady] = useState(false);

  // ── Google Identity Services ──────────────────────────────────────────────
  // Uses a custom native button + google.accounts.id.prompt() instead of
  // renderButton(), which renders an iframe that blocks touch events on iOS.

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const w = window as any;
      if (!w.google) return;
      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        ux_mode: "popup",
      });
      setGoogleReady(true);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  function triggerGoogleSignIn() {
    const w = window as any;
    if (w.google?.accounts?.id) {
      w.google.accounts.id.prompt();
    }
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential }),
        credentials: "include",
      });

      const json = (await res.json()) as {
        patientId?: string;
        error?: { userMessage?: string };
      };

      if (!res.ok) {
        setError(json?.error?.userMessage ?? "Google sign-in failed. Please try again.");
        return;
      }

      router.push(nextPath);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), lang: "en" }),
      });

      const json = (await res.json()) as { message?: string; error?: { userMessage?: string } };

      if (!res.ok) {
        setError(json?.error?.userMessage ?? "Failed to send OTP. Please try again.");
        return;
      }

      setInfo("OTP sent to your phone. It expires in 10 minutes.");
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
        credentials: "include",
      });

      const json = (await res.json()) as { patientId?: string; error?: { userMessage?: string } };

      if (!res.ok) {
        setError(json?.error?.userMessage ?? "Incorrect OTP. Please try again.");
        return;
      }

      router.push(nextPath);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleResend() {
    setStep("phone");
    setOtp("");
    setError(null);
    setInfo(null);
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleEnabled = !!clientId && clientId !== "YOUR_GOOGLE_CLIENT_ID_HERE";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
              style={{ background: "#1B8A4A" }}
            >
              E
            </span>
            <span className="text-2xl font-bold text-slate-800">EasyHeals</span>
          </span>
          <p className="mt-2 text-sm text-slate-500">Your health, simplified</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-1.5 flex-1 rounded-full" style={{ background: "#1B8A4A" }} />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                step === "otp" ? "" : "bg-slate-200"
              }`}
              style={step === "otp" ? { background: "#1B8A4A" } : {}}
            />
          </div>

          {step === "phone" ? (
            <>
              <h1 className="text-xl font-bold text-slate-800 mb-1">Sign in to EasyHeals</h1>
              <p className="text-sm text-slate-500 mb-6">
                Use your phone number or Google account.
              </p>

              {/* Google Sign-In — custom native button (avoids iframe touch issues on iOS) */}
              {googleEnabled && (
                <>
                  <button
                    type="button"
                    onClick={triggerGoogleSignIn}
                    disabled={!googleReady || busy}
                    className="w-full mb-4 flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 text-sm font-medium text-slate-700"
                    style={{ cursor: googleReady ? "pointer" : "default" }}
                  >
                    {/* Google G logo */}
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    {googleReady ? "Continue with Google" : "Loading…"}
                  </button>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium">or continue with phone</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                </>
              )}

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus={!googleEnabled}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:border-transparent outline-none text-sm transition"
                    style={{ "--tw-ring-color": "#1B8A4A" } as React.CSSProperties}
                  />
                  <p className="mt-1 text-xs text-slate-400">Include country code (e.g. +91 for India)</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !phone.trim()}
                  className="w-full py-3 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
                  style={{ background: "#1B8A4A" }}
                >
                  {busy ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-800 mb-1">Enter OTP</h1>
              <p className="text-sm text-slate-500 mb-1">
                Code sent to <span className="font-medium text-slate-700">{phone}</span>
              </p>
              {info && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                  {info}
                </p>
              )}

              <form onSubmit={handleVerify} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    6-digit OTP
                  </label>
                  <input
                    ref={otpRef}
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    placeholder="• • • • • •"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:border-transparent outline-none text-center text-2xl tracking-widest font-mono transition"
                    style={{ "--tw-ring-color": "#1B8A4A" } as React.CSSProperties}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || otp.length !== 6}
                  className="w-full py-3 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
                  style={{ background: "#1B8A4A" }}
                >
                  {busy ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Sign In"
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Wrong number? Go back
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          By signing in, you agree to our{" "}
          <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
