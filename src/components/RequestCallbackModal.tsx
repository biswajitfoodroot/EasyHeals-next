"use client";

/**
 * RequestCallbackModal — Task 3.2
 *
 * 5-step flow (per PLAN.md UX-2):
 *   Step 1: Consent (ConsentModal — shown inline)
 *   Step 2: Phone entry + Send OTP
 *   Step 3: OTP verification (6 digit boxes)
 *   Step 4: Request details (name + concern + preferred time)
 *   Step 5: Confirmation + gamification nudge
 *
 * Replaces AppointmentModal.
 * POSTs to /api/v1/auth/otp/send → /api/v1/auth/otp/verify → /api/v1/leads
 * Includes honeypot field for bot protection.
 */

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import ConsentModal from "./ConsentModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hospitalId?: string;
  hospitalName?: string;
  doctorName?: string;
}

type Step = "consent" | "phone" | "otp" | "details" | "success";

const TIME_PREFS = [
  "Morning (8am–12pm)",
  "Afternoon (12pm–4pm)",
  "Evening (4pm–8pm)",
  "Any time",
];

export default function RequestCallbackModal({
  isOpen,
  onClose,
  hospitalId,
  hospitalName = "the hospital",
  doctorName,
}: Props) {
  const [step, setStep] = useState<Step>("consent");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [patientId, setPatientId] = useState("");
  const [fullName, setFullName] = useState("");
  const [concern, setConcern] = useState("");
  const [timePref, setTimePref] = useState(TIME_PREFS[0]);
  const [honeypot, setHoneypot] = useState(""); // bot detection
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset on close
      setTimeout(() => {
        setStep("consent");
        setPhone("");
        setOtp(["", "", "", "", "", ""]);
        setPatientId("");
        setFullName("");
        setConcern("");
        setTimePref(TIME_PREFS[0]);
        setError("");
        setCountdown(0);
        if (timerRef.current) clearInterval(timerRef.current);
      }, 300);
    }
  }, [isOpen]);

  function startCountdown(seconds = 45) {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // ── Step 1: Consent ───────────────────────────────────────────────────────

  async function handleConsentAgree(_includeAnalytics: boolean) {
    // Analytics consent will be saved server-side after OTP verify
    setStep("phone");
  }

  function handleConsentDecline() {
    onClose();
  }

  // ── Step 2: Send OTP ─────────────────────────────────────────────────────

  async function handleSendOTP() {
    if (!phone.trim()) {
      setError("Please enter your mobile number");
      return;
    }
    if (honeypot) {
      // Bot detected — fail silently
      setStep("success");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\s/g, "")}`;
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.code === "RATE_OTP_FLOOD") {
          setError("Too many attempts. Please try again after 1 hour.");
        } else {
          setError(body?.error?.message ?? "Failed to send OTP. Please try again.");
        }
        return;
      }

      setStep("otp");
      startCountdown(45);
      // Focus first OTP box
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Verify OTP ───────────────────────────────────────────────────

  function handleOTPInput(idx: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digits;
    setOtp(next);

    if (digits && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (next.every((d) => d) && next.join("").length === 6) {
      verifyOTP(next.join(""));
    }
  }

  function handleOTPKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  async function verifyOTP(code: string) {
    setLoading(true);
    setError("");

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\s/g, "")}`;
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, otp: code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "Invalid OTP. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }

      const data = await res.json();
      setPatientId(data.patientId);

      // Now record booking_lead consent
      await fetch("/api/v1/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: data.patientId,
          purposes: ["booking_lead"],
          version: "1.0",
        }),
      });

      setStep("details");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: Submit Lead ──────────────────────────────────────────────────

  async function handleSubmit() {
    if (!fullName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!hospitalId) {
      setError("Hospital information missing. Please refresh and try again.");
      return;
    }
    if (honeypot) {
      setStep("success");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\s/g, "")}`;
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          patientPhone: formattedPhone,
          symptom: [concern, doctorName ? `Doctor preference: ${doctorName}` : null, `Preferred time: ${timePref}`]
            .filter(Boolean)
            .join(". "),
          consentGranted: true,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Duplicate lead is not really an error — reassure patient
        if (body?.error?.code === "LEAD_DUPLICATE") {
          setStep("success");
          return;
        }
        throw new Error(body?.error?.message ?? "Submission failed. Please try again.");
      }

      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  // ── Render: Step 1 — Consent ─────────────────────────────────────────────

  if (step === "consent") {
    return (
      <ConsentModal
        hospitalName={hospitalName}
        onAgree={handleConsentAgree}
        onDecline={handleConsentDecline}
      />
    );
  }

  // ── Shared modal shell ───────────────────────────────────────────────────

  return (
    <div className="rcm-overlay" role="dialog" aria-modal="true" aria-labelledby="rcm-title">
      <div className="rcm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rcm-header">
          <div>
            <p className="rcm-header-eyebrow">EasyHeals</p>
            <h2 id="rcm-title" className="rcm-header-title">
              {step === "success"
                ? "Request Sent! ✅"
                : doctorName
                  ? `Request callback from Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}`
                  : "Request a Callback"}
            </h2>
            {hospitalName && step !== "success" && (
              <p className="rcm-header-sub">{hospitalName}</p>
            )}
          </div>
          {step === "success" && (
            <button onClick={onClose} className="rcm-close-btn" aria-label="Close">×</button>
          )}
        </div>

        <div className="rcm-body">

          {/* Honeypot — hidden from real users, visible to bots */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
          />

          {error && (
            <div className="rcm-error" role="alert">{error}</div>
          )}

          {/* ── Step 2: Phone input ──────────────────────────────────────── */}
          {step === "phone" && (
            <div className="rcm-step">
              <p className="rcm-step-label">Step 1 of 3 — Verify your mobile</p>
              <label className="rcm-label" htmlFor="rcm-phone">Mobile Number *</label>
              <div className="rcm-phone-row">
                <span className="rcm-phone-prefix">+91</span>
                <input
                  id="rcm-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="XXXXX XXXXX"
                  className="rcm-input rcm-phone-input"
                  autoComplete="tel"
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                />
              </div>
              <p className="rcm-helper">We'll connect you with the hospital</p>
              <button
                type="button"
                id="rcm-send-otp-btn"
                onClick={handleSendOTP}
                disabled={loading || !phone.trim()}
                className="rcm-btn-primary"
              >
                {loading ? <span className="rcm-spinner" /> : null}
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </div>
          )}

          {/* ── Step 3: OTP entry ────────────────────────────────────────── */}
          {step === "otp" && (
            <div className="rcm-step">
              <p className="rcm-step-label">Step 2 of 3 — Enter OTP</p>
              <p className="rcm-helper">Sent to {phone.startsWith("+91") ? phone : `+91 ${phone}`}</p>
              <div className="rcm-otp-row">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPInput(i, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(i, e)}
                    className="rcm-otp-box"
                    aria-label={`OTP digit ${i + 1}`}
                    disabled={loading}
                  />
                ))}
              </div>
              {loading && <p className="rcm-helper" style={{ textAlign: "center" }}>Verifying…</p>}
              <div className="rcm-resend-row">
                {countdown > 0 ? (
                  <span className="rcm-countdown">Resend in {countdown}s</span>
                ) : (
                  <button type="button" onClick={handleSendOTP} className="rcm-resend-btn">
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Request details ──────────────────────────────────── */}
          {step === "details" && (
            <div className="rcm-step">
              <p className="rcm-step-label">Step 3 of 3 — Your request</p>
              <label className="rcm-label" htmlFor="rcm-name">Your Name *</label>
              <input
                id="rcm-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="rcm-input"
                autoComplete="name"
              />
              <label className="rcm-label" htmlFor="rcm-concern">Concern / Query</label>
              <textarea
                id="rcm-concern"
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                placeholder="Describe your symptoms or health concern (optional)"
                className="rcm-textarea"
                rows={3}
              />
              <label className="rcm-label" htmlFor="rcm-time">Preferred Time</label>
              <select
                id="rcm-time"
                value={timePref}
                onChange={(e) => setTimePref(e.target.value)}
                className="rcm-input"
              >
                {TIME_PREFS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button
                type="button"
                id="rcm-submit-btn"
                onClick={handleSubmit}
                disabled={loading || !fullName.trim()}
                className="rcm-btn-primary"
              >
                {loading ? <span className="rcm-spinner" /> : null}
                {loading ? "Submitting…" : "Submit Callback Request"}
              </button>
              <p className="rcm-helper" style={{ textAlign: "center" }}>
                Free service · No booking fee · Hospital will call you back
              </p>
            </div>
          )}

          {/* ── Step 5: Success ──────────────────────────────────────────── */}
          {step === "success" && (
            <div className="rcm-success">
              <div className="rcm-success-icon" aria-hidden="true">✅</div>
              <h3 className="rcm-success-title">
                {hospitalName} will call you back within 24 hours.
              </h3>
              <p className="rcm-success-sub">
                We've received your request and forwarded it to the hospital team.
                They'll reach you on your verified number.
              </p>
              <div className="rcm-points-nudge" aria-label="Gamification nudge">
                🏅 +10 points earned — keep exploring to earn more!
              </div>
              <div className="rcm-success-actions">
                <button type="button" onClick={onClose} className="rcm-btn-primary">
                  Done
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rcm-btn-secondary"
                >
                  Browse More Hospitals
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .rcm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          padding: 0;
        }

        @media (min-width: 640px) {
          .rcm-overlay { align-items: center; padding: 1rem; }
        }

        .rcm-card {
          background: #fff;
          border-radius: 20px 20px 0 0;
          width: 100%;
          max-width: 440px;
          overflow: hidden;
          box-shadow: 0 -4px 40px rgba(0,0,0,0.18);
          animation: rcmSlide 0.25s ease-out;
        }

        @media (min-width: 640px) {
          .rcm-card { border-radius: 20px; animation: rcmFade 0.2s ease-out; }
        }

        @keyframes rcmSlide {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        @keyframes rcmFade {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .rcm-header {
          background: linear-gradient(135deg, #1a5276, #2563eb);
          padding: 20px 24px 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .rcm-header-eyebrow {
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(255,255,255,0.65);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 2px;
        }

        .rcm-header-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .rcm-header-sub {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.75);
          margin: 2px 0 0;
        }

        .rcm-close-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
          padding: 0 0 0 12px;
          font-family: inherit;
        }

        .rcm-body {
          padding: 20px 24px 24px;
        }

        .rcm-error {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #92400e;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.875rem;
          margin-bottom: 16px;
        }

        .rcm-step {}

        .rcm-step-label {
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 600;
          margin-bottom: 14px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .rcm-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          margin-top: 14px;
        }

        .rcm-label:first-of-type { margin-top: 0; }

        .rcm-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9375rem;
          outline: none;
          background: #f9fafb;
          font-family: inherit;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }

        .rcm-input:focus {
          border-color: #2563eb;
          background: #fff;
        }

        .rcm-textarea {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9375rem;
          outline: none;
          background: #f9fafb;
          font-family: inherit;
          resize: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }

        .rcm-textarea:focus {
          border-color: #2563eb;
          background: #fff;
        }

        .rcm-phone-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .rcm-phone-prefix {
          padding: 11px 12px;
          background: #f3f4f6;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .rcm-phone-input { flex: 1; }

        .rcm-helper {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 6px 0 14px;
        }

        .rcm-btn-primary {
          width: 100%;
          padding: 13px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
        }

        .rcm-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .rcm-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .rcm-btn-secondary {
          width: 100%;
          padding: 11px;
          background: transparent;
          color: #6b7280;
          border: 1.5px solid #d1d5db;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s;
          margin-top: 10px;
          font-family: inherit;
        }

        .rcm-btn-secondary:hover { border-color: #9ca3af; color: #374151; }

        /* OTP boxes */
        .rcm-otp-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin: 16px 0 8px;
        }

        .rcm-otp-box {
          width: 44px;
          height: 52px;
          text-align: center;
          font-size: 1.375rem;
          font-weight: 700;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          outline: none;
          background: #f9fafb;
          font-family: monospace;
          transition: border-color 0.15s;
          -moz-appearance: textfield;
        }

        .rcm-otp-box:focus { border-color: #2563eb; background: #fff; }
        .rcm-otp-box::-webkit-outer-spin-button,
        .rcm-otp-box::-webkit-inner-spin-button { -webkit-appearance: none; }

        .rcm-resend-row { text-align: center; margin-top: 12px; }

        .rcm-countdown { font-size: 0.8125rem; color: #9ca3af; }

        .rcm-resend-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          text-decoration: underline;
        }

        /* Success state */
        .rcm-success { text-align: center; padding: 8px 0; }

        .rcm-success-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          display: block;
        }

        .rcm-success-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 10px;
        }

        .rcm-success-sub {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 18px;
          line-height: 1.6;
        }

        .rcm-points-nudge {
          display: inline-block;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 6px 16px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .rcm-success-actions { display: flex; flex-direction: column; gap: 10px; }

        /* Spinner */
        .rcm-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: rcmSpin 0.6s linear infinite;
        }

        @keyframes rcmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
