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
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // ── Google Identity Services ──────────────────────────────────────────────

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") return;

    // Load GSI script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogleButton(clientId);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  function initGoogleButton(clientId: string) {
    const w = window as any;
    if (!w.google || !googleBtnRef.current) return;

    w.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
    });

    w.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 368,
      text: "continue_with",
    });
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

              {/* Google Sign-In button (rendered by GSI library) */}
              {googleEnabled && (
                <>
                  <div ref={googleBtnRef} className="w-full mb-4" />
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
