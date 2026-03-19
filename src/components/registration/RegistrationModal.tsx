"use client";

import { useState } from "react";

import styles from "@/components/phase1/phase1.module.css";

type Match = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  addressLine1: string | null;
  claimed: boolean;
};

type RegistrationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function RegistrationModal({ isOpen, onClose }: RegistrationModalProps) {
  const [step, setStep] = useState(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpId, setOtpId] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    city: "",
    type: "hospital",
    contactName: "",
    designation: "",
    email: "",
    website: "",
    phone: "",
    otp: "",
  });

  if (!isOpen) return null;

  async function checkExisting() {
    const response = await fetch("/api/register/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, city: form.city }),
    });

    const data = (await response.json()) as { matches?: Match[] };
    setMatches(data.matches ?? []);
  }

  async function sendOtp() {
    setError(null);
    setSendingOtp(true);

    try {
      const response = await fetch("/api/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });

      const data = (await response.json()) as {
        otpId?: string;
        sent?: boolean;
        debugOtp?: string;
        error?: string;
      };

      if (!response.ok || !data.otpId) {
        setError(data.error ?? "Could not send OTP. Please check your mobile number.");
        return;
      }

      setOtpId(data.otpId);
      setDebugOtp(data.debugOtp ?? null);
    } catch {
      setError("Network error. Please check your connection and retry.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function completeRegistration() {
    setError(null);
    setSubmitting(true);

    try {
      // Normalise website: add https:// if missing
      let website = form.website.trim() || undefined;
      if (website && !/^https?:\/\//i.test(website)) {
        website = `https://${website}`;
      }

      const payload: Record<string, unknown> = {
        otpId,
        otp: form.otp.trim(),
        phone: form.phone,
        email: form.email,
        contactName: form.contactName,
        designation: form.designation,
      };

      if (selectedHospitalId) {
        payload.hospitalId = selectedHospitalId;
      } else {
        payload.newHospitalData = {
          name: form.name,
          city: form.city,
          type: form.type,
          website,
        };
      }

      const response = await fetch("/api/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        success?: boolean;
        dashboardUrl?: string;
        error?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      };

      if (!response.ok || !data.success) {
        // Show field-level errors if available, otherwise show top-level error
        if (data.details?.fieldErrors) {
          const msgs = Object.entries(data.details.fieldErrors)
            .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
            .join(" | ");
          setError(msgs || data.error || "Validation failed.");
        } else {
          setError(data.error ?? "Registration failed. Please check your details.");
        }
        return;
      }

      setSuccess(data.dashboardUrl ?? "/admin");
    } catch {
      setError("Network error. Please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextStep() {
    setError(null);

    if (step === 1 && (!form.name.trim() || !form.city.trim())) {
      setError("Please enter hospital name and city.");
      return;
    }

    if (step === 2 && (!form.contactName.trim() || !form.email.trim())) {
      setError("Please enter contact name and email.");
      return;
    }

    setStep((prev) => Math.min(prev + 1, 3));
  }

  function resetAndClose() {
    setStep(1);
    setMatches([]);
    setSelectedHospitalId(null);
    setOtpId("");
    setSuccess(null);
    setDebugOtp(null);
    setError(null);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onClick={resetAndClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h3>List Your Hospital</h3>
            <p>Step {success ? "Done" : `${step} of 3`} · RC#6 Self-registration</p>
          </div>
          <button type="button" onClick={resetAndClose}>
            Close
          </button>
        </div>

        {error ? (
          <div className={styles.regError}>
            <strong>⚠ </strong>{error}
          </div>
        ) : null}

        {success ? (
          <div className={styles.successBox}>
            <h4>Registration Complete</h4>
            <p>Your hospital account is live and OTP verified.</p>
            <a href={success}>Go to Dashboard</a>
          </div>
        ) : null}

        {!success && step === 1 ? (
          <div className={styles.modalBody}>
            <label>
              Hospital Name
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              City
              <input
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="diagnostic">Diagnostic Centre</option>
                <option value="nursing_home">Nursing Home</option>
              </select>
            </label>

            <div className={styles.inlineButtons}>
              <button type="button" onClick={() => void checkExisting()}>
                Check Existing Listings
              </button>
              <button type="button" onClick={nextStep}>
                Continue
              </button>
            </div>

            {matches.length ? (
              <div className={styles.matchList}>
                <p>Claim an existing listing (optional):</p>
                {matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    className={selectedHospitalId === match.id ? styles.matchSelected : ""}
                    onClick={() => setSelectedHospitalId(match.id)}
                  >
                    {match.name} · {match.city}
                    {match.claimed ? " (Already claimed)" : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!success && step === 2 ? (
          <div className={styles.modalBody}>
            <label>
              Contact Person
              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactName: event.target.value }))
                }
              />
            </label>
            <label>
              Designation
              <input
                value={form.designation}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, designation: event.target.value }))
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Website (optional)
              <input
                type="url"
                value={form.website}
                onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
              />
            </label>

            <div className={styles.inlineButtons}>
              <button type="button" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" onClick={nextStep}>
                Continue to OTP
              </button>
            </div>
          </div>
        ) : null}

        {!success && step === 3 ? (
          <div className={styles.modalBody}>
            <label>
              Mobile Number
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="9876543210"
              />
            </label>

            <div className={styles.inlineButtons}>
              <button type="button" onClick={() => void sendOtp()} disabled={sendingOtp}>
                {sendingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>

            {otpId ? (
              <>
                <label>
                  Enter OTP
                  <input
                    value={form.otp}
                    onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value }))}
                    placeholder="6-digit OTP"
                  />
                </label>
                {debugOtp ? <p className={styles.debugText}>Dev OTP: {debugOtp}</p> : null}
                <div className={styles.inlineButtons}>
                  <button type="button" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button type="button" onClick={() => void completeRegistration()} disabled={submitting}>
                    {submitting ? "Completing..." : "Complete Registration"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

