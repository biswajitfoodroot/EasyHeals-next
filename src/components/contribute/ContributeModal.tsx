"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

type ContributeModalProps = {
  isOpen: boolean;
  target: SearchResult | null;
  onClose: () => void;
};

type ContributorSession = {
  userId: string;
  name: string;
  email: string;
  avatar: string;
};

const hospitalFields = [
  { key: "phone", label: "Phone Number" },
  { key: "addressLine1", label: "Address" },
  { key: "specialties", label: "Specialties" },
  { key: "feesRange", label: "Consultation Fee" },
  { key: "website", label: "Website" },
] as const;

const doctorFields = [
  { key: "phone", label: "Phone Number" },
  { key: "specialization", label: "Specialization" },
  { key: "specialties", label: "Specialties" },
  { key: "consultationFee", label: "Consultation Fee" },
  { key: "qualifications", label: "Qualifications" },
] as const;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("google-gsi")) { resolve(); return; }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function ContributeModal({ isOpen, target, onClose }: ContributeModalProps) {
  const fields = target?.type === "doctor" ? doctorFields : hospitalFields;
  const [field, setField] = useState<(typeof hospitalFields)[number]["key"] | (typeof doctorFields)[number]["key"]>("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contributor, setContributor] = useState<ContributorSession | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  const selectedField = useMemo(() => fields.find((item) => item.key === field) ?? fields[0], [field, fields]);

  // Load Google Sign-In script when modal opens
  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") return;
    setGoogleLoading(true);
    loadGoogleScript().then(() => {
      setGoogleLoading(false);
      if (!btnRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => void handleGoogleCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 300,
      });
    });
  }, [isOpen]);

  async function handleGoogleCredential(idToken: string) {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Google auth failed");
      const data = (await res.json()) as ContributorSession;
      setContributor(data);
    } catch {
      setToast("Google sign-in failed. Please try again.");
    }
  }

  if (!isOpen || !target) return null;

  async function submitContribution() {
    if (!target) return;
    if (!value.trim()) { setToast("Please enter the updated value."); return; }

    setSubmitting(true);
    try {
      const payload = {
        targetType: target.type,
        targetId: target.id,
        fieldChanged: field,
        oldValue: null,
        newValue:
          field === "specialties" || field === "qualifications"
            ? value.split(",").map((item) => item.trim()).filter(Boolean)
            : field === "consultationFee"
              ? Number(value)
              : value,
        changeType: "update",
        contributorId: contributor?.userId,
        sourceReason: reason,
      };

      const response = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { status?: string; reason?: string };
      if (!response.ok) {
        setToast(`Edit rejected: ${data.reason ?? "AI checks failed."}`);
        return;
      }

      // Show thank you toast and close
      setToast("✓ Thank you for contributing! Your edit has been submitted for review.");
      setValue("");
      setReason("");
      setTimeout(() => { setToast(null); onClose(); }, 2800);
    } catch {
      setToast("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const googleConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE";

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h3>Suggest an Edit</h3>
            <p>
              {contributor
                ? `Signed in as ${contributor.name}`
                : "Sign in with Google to contribute verified edits"}
            </p>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        {/* Toast notification */}
        {toast ? (
          <div style={{
            margin: "10px 16px 0",
            borderRadius: "10px",
            padding: "10px 14px",
            background: toast.startsWith("✓") ? "#e6f5ec" : "#fff2ee",
            border: `1px solid ${toast.startsWith("✓") ? "#b8ddc8" : "#f5c6b8"}`,
            color: toast.startsWith("✓") ? "#136836" : "#c1360f",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            {toast}
          </div>
        ) : null}

        {/* Step 1: Google Sign-In gate */}
        {!contributor ? (
          <div className={styles.modalBody}>
            <p className={styles.modalTarget}>
              Editing: <strong>{target.name}</strong>
            </p>

            <div className={styles.aiHint}>
              All edits are Google-verified and AI-scored before going live. Sign in to track your contributions and build trust score.
            </div>

            {googleConfigured ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                  {googleLoading ? (
                    <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading Google Sign-In...</p>
                  ) : (
                    <div ref={btnRef} />
                  )}
                </div>
              </>
            ) : (
              <div style={{ background: "#fff8e6", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#7c5200" }}>
                Google Sign-In not configured. Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your environment to enable contributor authentication.
              </div>
            )}
          </div>
        ) : (
          // Step 2: Contribution form
          <div className={styles.modalBody}>
            <p className={styles.modalTarget}>
              Editing: <strong>{target.name}</strong>
            </p>

            <div className={styles.fieldGrid}>
              {fields.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === field ? styles.fieldActive : ""}
                  onClick={() => setField(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label>
              New {selectedField.label}
              <input value={value} onChange={(event) => setValue(event.target.value)} />
            </label>

            <label>
              Source / Reason <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>

            <div className={styles.aiHint}>
              AI outlier scoring is active. Low-risk edits may auto-approve; high-risk edits go to admin review.
            </div>

            <div className={styles.inlineButtons}>
              <button type="button" onClick={() => setContributor(null)}>Sign Out</button>
              <button type="button" onClick={() => void submitContribution()} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Edit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
