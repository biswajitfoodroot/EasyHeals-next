"use client";

/**
 * ReauthModal — Session expiry re-authentication overlay
 *
 * Mobile-first bottom sheet overlay (no page redirect).
 * Renders as a blurred overlay with OTP verification form.
 * On success: calls onSuccess() so caller can resume without losing state.
 * On session expired (not just warning): shows non-dismissable overlay.
 *
 * Used by: SessionHealthProvider (in dashboard layout)
 */

import { useState, useEffect, useRef } from "react";

interface ReauthModalProps {
  isExpired: boolean;          // true = session dead, must re-auth; false = just a warning
  minutesRemaining: number | null;
  onSuccess: () => void;
  onDismiss?: () => void;      // only available when isExpired=false (warning mode)
}

export function ReauthModal({ isExpired, minutesRemaining, onSuccess, onDismiss }: ReauthModalProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus
  useEffect(() => {
    if (step === "phone") phoneInputRef.current?.focus();
    else otpInputRef.current?.focus();
  }, [step]);

  // Countdown for resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP. Try again.");
        return;
      }
      setStep("otp");
      setCountdown(60);
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) {
      setError("Enter the OTP sent to your number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid OTP. Try again.");
        return;
      }
      // Session refreshed — notify parent
      onSuccess();
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const canDismiss = !isExpired && onDismiss;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={canDismiss ? onDismiss : undefined}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Bottom sheet — slides up on mobile, centered card on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verify your identity to continue"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 32px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          maxWidth: 480,
          margin: "0 auto",
          animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        className="reauth-sheet"
      >
        {/* Drag handle */}
        <div style={{
          width: 40,
          height: 4,
          background: "#e2e8f0",
          borderRadius: 2,
          margin: "0 auto 20px",
        }} />

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
            {isExpired ? "Session expired" : "Stay signed in"}
          </div>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            {isExpired
              ? "Verify your mobile number to continue"
              : minutesRemaining !== null && minutesRemaining > 0
                ? `Your session expires in ${minutesRemaining} min. Re-verify to stay signed in.`
                : "Verify to continue where you left off"}
          </div>
        </div>

        {step === "phone" ? (
          <form onSubmit={sendOtp}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Mobile Number
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 12px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                color: "#374151",
                fontSize: 15,
                fontWeight: 500,
                background: "#f8fafc",
              }}>
                +91
              </div>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(null); }}
                placeholder="10-digit number"
                maxLength={10}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 16,
                  outline: "none",
                  color: "#0f172a",
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: loading ? "#94a3b8" : "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                marginBottom: canDismiss ? 12 : 0,
              }}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>

            {canDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "transparent",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Remind me later
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                OTP sent to <strong>+91 {phone}</strong>
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(null); }}
                  style={{ marginLeft: 8, color: "#0f766e", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
                >
                  Change
                </button>
              </div>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                placeholder="Enter OTP"
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 22,
                  letterSpacing: 8,
                  textAlign: "center",
                  outline: "none",
                  color: "#0f172a",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              style={{
                width: "100%",
                padding: "14px",
                background: (loading || otp.length < 4) ? "#94a3b8" : "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: (loading || otp.length < 4) ? "not-allowed" : "pointer",
                marginBottom: 12,
              }}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: "#64748b" }}>
              {countdown > 0 ? (
                <span>Resend OTP in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(null); }}
                  style={{ color: "#0f766e", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 640px) {
          .reauth-sheet {
            bottom: auto !important;
            top: 50% !important;
            left: 50% !important;
            right: auto !important;
            transform: translate(-50%, -50%) !important;
            border-radius: 20px !important;
            animation: fadeIn 0.2s ease !important;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}
