"use client";

import { useEffect, useRef, useState } from "react";

import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

// ── Structured working-hours sub-component ────────────────────────────────────

type DayEntry = { open: string; close: string; closed: boolean; open24h: boolean };
type WHState = Record<string, DayEntry>;

const WH_DAYS: [string, string][] = [
  ["monday","Mon"],["tuesday","Tue"],["wednesday","Wed"],
  ["thursday","Thu"],["friday","Fri"],["saturday","Sat"],["sunday","Sun"],
];

const WH_DEFAULT: WHState = Object.fromEntries(
  WH_DAYS.map(([k]) => [k, { open: "09:00", close: "21:00", closed: false, open24h: false }]),
);

function WorkingHoursInput({ value, onChange }: { value: WHState; onChange: (v: WHState) => void }) {
  function set(day: string, patch: Partial<DayEntry>) {
    onChange({ ...value, [day]: { ...value[day]!, ...patch } });
  }

  function setAll24x7() {
    const all = Object.fromEntries(
      WH_DAYS.map(([k]) => [k, { open: "00:00", close: "00:00", closed: false, open24h: true }]),
    );
    onChange(all as WHState);
  }

  function clearAll24h() {
    const updated = Object.fromEntries(
      WH_DAYS.map(([k]) => [k, { ...value[k]!, open24h: false, open: "09:00", close: "21:00" }]),
    );
    onChange(updated as WHState);
  }

  const is247 = WH_DAYS.every(([k]) => value[k]?.open24h);

  return (
    <div>
      {/* Presets */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", alignSelf: "center" }}>Preset:</span>
        <button
          type="button"
          onClick={setAll24x7}
          style={{
            padding: "3px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "8px",
            border: `1px solid ${is247 ? "#059669" : "#a7f3d0"}`,
            background: is247 ? "#059669" : "#ecfdf5",
            color: is247 ? "#fff" : "#059669",
            cursor: "pointer",
          }}
        >
          {is247 ? "✓ 24/7 Active" : "Set all 24/7"}
        </button>
        {is247 && (
          <button
            type="button"
            onClick={clearAll24h}
            style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "8px", border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer" }}
          >
            Clear 24/7
          </button>
        )}
      </div>

      {/* Day rows */}
      <div style={{ border: "1.5px solid #D0E4D8", borderRadius: "10px", overflow: "hidden" }}>
        {WH_DAYS.map(([day, label], i) => {
          const s = value[day] ?? WH_DEFAULT[day]!;
          const timesDisabled = s.closed || s.open24h;
          return (
            <div key={day} style={{
              display: "grid", gridTemplateColumns: "36px 50px 44px 1fr 1fr",
              alignItems: "center", gap: "5px", padding: "6px 10px",
              background: s.open24h ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#f9fafb",
              borderBottom: i < WH_DAYS.length - 1 ? "1px solid #e5e7eb" : "none",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{label}</span>

              {/* Open toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!s.closed}
                  onChange={(e) => set(day, { closed: !e.target.checked, open24h: !e.target.checked ? false : s.open24h })}
                  style={{ width: "13px", height: "13px", accentColor: "#1B8A4A", cursor: "pointer" }}
                />
                <span style={{ fontSize: "10px", color: s.closed ? "#9ca3af" : "#1B8A4A", fontWeight: 600 }}>
                  {s.closed ? "Closed" : "Open"}
                </span>
              </label>

              {/* 24h toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: "3px", cursor: s.closed ? "default" : "pointer", opacity: s.closed ? 0.4 : 1 }}>
                <input
                  type="checkbox"
                  checked={s.open24h}
                  disabled={s.closed}
                  onChange={(e) => set(day, { open24h: e.target.checked })}
                  style={{ width: "13px", height: "13px", accentColor: "#059669", cursor: "pointer" }}
                />
                <span style={{ fontSize: "10px", color: s.open24h ? "#059669" : "#9ca3af", fontWeight: 600 }}>24h</span>
              </label>

              {/* Time pickers */}
              {s.open24h && !s.closed ? (
                <span style={{ gridColumn: "4 / 6", fontSize: "11px", color: "#059669", fontWeight: 600 }}>Open 24 hours</span>
              ) : (
                <>
                  <input
                    type="time"
                    value={s.open}
                    disabled={timesDisabled}
                    onChange={(e) => set(day, { open: e.target.value })}
                    style={{ ...timeInputStyle, opacity: timesDisabled ? 0.35 : 1 }}
                  />
                  <input
                    type="time"
                    value={s.close}
                    disabled={timesDisabled}
                    onChange={(e) => set(day, { close: e.target.value })}
                    style={{ ...timeInputStyle, opacity: timesDisabled ? 0.35 : 1 }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const timeInputStyle: React.CSSProperties = {
  border: "1px solid #D0E4D8", borderRadius: "6px",
  padding: "4px 6px", fontSize: "12px", outline: "none",
  fontFamily: "inherit", width: "100%", background: "#fff",
};

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

type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  inputType: "text" | "email" | "url" | "tel" | "textarea" | "workinghours";
  section: string;
};

const hospitalFields: FieldDef[] = [
  // Contact
  { key: "phone",        label: "Phone Number",             placeholder: "+91 98765 43210",               inputType: "tel",          section: "Contact" },
  { key: "email",        label: "Email",                    placeholder: "info@hospital.com",             inputType: "email",        section: "Contact" },
  { key: "website",      label: "Website URL",              placeholder: "https://hospital.com",          inputType: "url",          section: "Contact" },
  { key: "address",      label: "Address",                  placeholder: "Street, locality, city, PIN",   inputType: "textarea",     section: "Contact" },
  // Services
  { key: "specialties",  label: "Specialties / Departments", placeholder: "Cardiology, Orthopaedics, …",  inputType: "text",         section: "Services" },
  { key: "facilities",   label: "Facilities Available",     placeholder: "ICU, Blood Bank, MRI, …",       inputType: "text",         section: "Services" },
  { key: "workinghours", label: "Working Hours",            placeholder: "",                              inputType: "workinghours", section: "Services" },
];

const doctorFields: FieldDef[] = [
  { key: "specialties",       label: "Specialties",           placeholder: "Cardiology, Neurology, …",   inputType: "text",     section: "Services" },
  { key: "qualifications",    label: "Qualifications",        placeholder: "MBBS, MD, FRCS, …",          inputType: "text",     section: "Services" },
  { key: "languages",         label: "Languages Spoken",      placeholder: "English, Hindi, Tamil, …",   inputType: "text",     section: "Services" },
  { key: "consultationhours", label: "Consultation Hours",    placeholder: "Mon–Fri 10 am–2 pm",         inputType: "text",     section: "Services" },
];

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

function serializeValue(key: string, raw: string): unknown {
  if (["specialties", "qualifications", "languages", "facilities"].includes(key)) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (key === "consultationhours") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

function serializeWorkingHours(wh: WHState): Record<string, unknown> {
  return Object.fromEntries(
    WH_DAYS.map(([day]) => {
      const s = wh[day] ?? WH_DEFAULT[day]!;
      if (s.closed) return [day, "closed"];
      if (s.open24h) return [day, "open24h"];
      return [day, { open: s.open, close: s.close }];
    }),
  );
}

export function ContributeModal({ isOpen, target, onClose }: ContributeModalProps) {
  const fields = target?.type === "doctor" ? doctorFields : hospitalFields;

  const [values, setValues] = useState<Record<string, string>>({});
  const [whValues, setWhValues] = useState<WHState>({ ...WH_DEFAULT });
  const [whTouched, setWhTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contributor, setContributor] = useState<ContributorSession | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  // Reset form when target changes
  useEffect(() => {
    setValues({});
    setWhValues({ ...WH_DEFAULT });
    setWhTouched(false);
    setReason("");
    setToast(null);
  }, [target?.id]);

  // Step 1: load the Google GSI script when modal opens
  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") return;
    loadGoogleScript().then(() => setGoogleReady(true));
  }, [isOpen]);

  // Step 2: render the button only after both the script is ready AND the div is mounted
  useEffect(() => {
    if (!googleReady || !btnRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => void handleGoogleCredential(resp.credential),
    });
    window.google.accounts.id.renderButton(btnRef.current, {
      theme: "outline", size: "large", text: "signin_with", width: 300,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady]);

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

  const filledFields = fields.filter((f) => {
    if (f.inputType === "workinghours") return whTouched;
    return (values[f.key] ?? "").trim() !== "";
  });

  async function submitContribution() {
    if (!target) return;
    if (filledFields.length === 0) {
      setToast("Please fill in at least one field.");
      return;
    }
    setSubmitting(true);
    setToast(null);
    let successCount = 0;
    let lastError = "";

    for (const f of filledFields) {
      const newValue = f.inputType === "workinghours"
        ? serializeWorkingHours(whValues)
        : serializeValue(f.key, values[f.key] ?? "");
      try {
        const res = await fetch("/api/contribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: target.type,
            targetId: target.id,
            fieldChanged: f.key,
            oldValue: null,
            newValue,
            changeType: "update",
            contributorId: contributor?.userId,
            sourceReason: reason,
          }),
        });
        const data = (await res.json()) as { status?: string; reason?: string };
        if (!res.ok) {
          lastError = data.reason ?? "AI checks failed.";
        } else {
          successCount++;
        }
      } catch {
        lastError = "Network error.";
      }
    }

    setSubmitting(false);
    if (successCount === filledFields.length) {
      setToast(`✓ ${successCount} edit${successCount > 1 ? "s" : ""} submitted for review. Thank you!`);
      setValues({});
      setWhValues({ ...WH_DEFAULT });
      setWhTouched(false);
      setReason("");
      setTimeout(() => { setToast(null); onClose(); }, 2800);
    } else if (successCount > 0) {
      setToast(`✓ ${successCount} of ${filledFields.length} edits submitted. Some were rejected: ${lastError}`);
    } else {
      setToast(`Edit rejected: ${lastError}`);
    }
  }

  // Group fields by section
  const sections = Array.from(new Set(fields.map((f) => f.section)));
  const googleConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE";

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className={styles.modalHead}>
          <div>
            <h3>Suggest an Edit</h3>
            <p>{contributor ? `Signed in as ${contributor.name}` : "Sign in with Google to contribute verified edits"}</p>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        {toast && (
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
        )}

        {!contributor ? (
          /* ── Step 1: Google Sign-In ── */
          <div className={styles.modalBody}>
            <p className={styles.modalTarget}>Editing: <strong>{target.name}</strong></p>
            <div className={styles.aiHint}>
              Fill in any fields you&apos;d like to suggest updates for — contact details, specialties, hours, and more. All edits go through admin review.
            </div>
            {googleConfigured ? (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                {/* div is always mounted so btnRef.current is set before renderButton fires */}
                <div ref={btnRef} />
                {!googleReady && (
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading Google Sign-In…</p>
                )}
              </div>
            ) : (
              <div style={{ background: "#fff8e6", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#7c5200" }}>
                Google Sign-In not configured. Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your environment to enable contributor authentication.
              </div>
            )}
          </div>
        ) : (
          /* ── Step 2: Multi-field form ── */
          <div className={styles.modalBody}>
            <p className={styles.modalTarget}>Editing: <strong>{target.name}</strong></p>

            {sections.map((section) => (
              <div key={section}>
                <p style={{ margin: "12px 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8FA39A" }}>
                  {section}
                </p>
                {fields.filter((f) => f.section === section).map((f) => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#5A7367" }}>{f.label}</span>
                    {f.inputType === "workinghours" ? (
                      <WorkingHoursInput
                        value={whValues}
                        onChange={(v) => { setWhValues(v); setWhTouched(true); }}
                      />
                    ) : f.inputType === "textarea" ? (
                      <textarea
                        rows={2}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        type={f.inputType}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#5A7367" }}>
                Source / Reason <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. visited last week, official website"
                style={inputStyle}
              />
            </label>

            <div className={styles.aiHint}>
              Fill in only the fields you want to update — leave the rest blank. All edits go through review before publishing.
            </div>

            <div className={styles.inlineButtons}>
              <button type="button" onClick={() => setContributor(null)}>Sign Out</button>
              <button
                type="button"
                onClick={() => void submitContribution()}
                disabled={submitting || filledFields.length === 0}
              >
                {submitting
                  ? "Submitting…"
                  : filledFields.length > 0
                    ? `Submit ${filledFields.length} Edit${filledFields.length > 1 ? "s" : ""}`
                    : "Submit Edit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1.5px solid #D0E4D8",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "13px",
  fontFamily: "inherit",
  color: "#1A2B23",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  resize: "vertical",
};
