"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "select" | "new" | "claim" | "duplicate";
type FacilityType = "hospital" | "clinic" | "diagnostic" | "nursing_home";
type AuthUser = { userId: string; email: string; fullName?: string; googleAvatar?: string };

type HospitalMatch = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  pincode: string | null;
  addressLine1: string | null;
  phone: string | null;
  type: string;
  verified: boolean;
  claimed: boolean;
  rating: number;
  reviewCount: number;
  slug: string;
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// ── Facility type cards ───────────────────────────────────────────────────────
const FACILITY_TYPES: { value: FacilityType; label: string; icon: string; desc: string }[] = [
  { value: "hospital", label: "Hospital", icon: "🏥", desc: "Multi-specialty or general hospital" },
  { value: "clinic", label: "Clinic", icon: "🏩", desc: "Outpatient clinic or medical centre" },
  { value: "diagnostic", label: "Diagnostic Centre", icon: "🔬", desc: "Lab, imaging, or diagnostic facility" },
  { value: "nursing_home", label: "Nursing Home", icon: "🏡", desc: "Small nursing or care home" },
];

const ASSOCIATION_TYPES = ["Owner", "Director", "General Manager", "Medical Superintendent", "Authorized Representative"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all";
const selectCls = `${inputCls} cursor-pointer`;

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}

function SubmitBtn({ busy, label, onClick }: { busy: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={busy}
      className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {busy ? <><Spinner /> Please wait...</> : label}
    </button>
  );
}

function MatchCard({ m, selected, onSelect, action }: { m: HospitalMatch; selected?: boolean; onSelect: () => void; action?: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-xl border transition-all ${selected ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20" : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{m.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {m.city}{m.state ? `, ${m.state}` : ""}{m.pincode ? ` — ${m.pincode}` : ""}
          </p>
          {m.addressLine1 && <p className="text-xs text-slate-400 mt-0.5 truncate">{m.addressLine1}</p>}
          {m.phone && <p className="text-xs text-slate-400">📞 {m.phone}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {m.verified && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">✅ Verified</span>}
          {m.claimed && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Claimed</span>}
          <span className="text-xs text-slate-400 capitalize">{m.type?.replace("_", " ")}</span>
        </div>
      </div>
      {action && selected && (
        <div className="mt-2 text-xs font-semibold text-teal-700 flex items-center gap-1">✓ {action}</div>
      )}
    </button>
  );
}

// ── Search sub-component ──────────────────────────────────────────────────────
function FacilitySearch({
  placeholder,
  label,
  onSelect,
  selected,
  excludeId,
}: {
  placeholder?: string;
  label: string;
  onSelect: (m: HospitalMatch) => void;
  selected: HospitalMatch | null;
  excludeId?: string;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<HospitalMatch[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!name.trim()) return;
    setSearching(true);
    const res = await fetch("/api/register/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), city: city.trim() || undefined }),
    });
    const data = await res.json() as { matches?: HospitalMatch[] };
    setResults((data.matches ?? []).filter((m) => m.id !== excludeId));
    setSearching(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      {selected ? (
        <div className="space-y-2">
          <MatchCard m={selected} selected onSelect={() => {}} action="Selected" />
          <button type="button" onClick={() => { onSelect({} as HospitalMatch); setResults([]); }} className="text-xs text-slate-400 hover:text-red-500">
            ✕ Clear selection
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder ?? "Facility name..."} onKeyDown={(e) => e.key === "Enter" && void search()} />
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" onKeyDown={(e) => e.key === "Enter" && void search()} />
          </div>
          <button type="button" onClick={() => void search()} disabled={searching || !name.trim()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl border border-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2">
            {searching ? <><Spinner /> Searching...</> : "Search"}
          </button>
          {results.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((m) => (
                <MatchCard key={m.id} m={m} onSelect={() => onSelect(m)} />
              ))}
            </div>
          )}
          {results.length === 0 && name && !searching && (
            <p className="text-xs text-slate-400 italic">No results. Try a broader name or different city.</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function RegistrationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [step, setStep] = useState(1);

  // New listing state
  const [facilityType, setFacilityType] = useState<FacilityType>("hospital");
  const [newForm, setNewForm] = useState({ name: "", city: "", state: "", address: "", website: "" });
  const [dupMatches, setDupMatches] = useState<HospitalMatch[]>([]);
  const [dupChecked, setDupChecked] = useState(false);
  const [dupCheckBusy, setDupCheckBusy] = useState(false);
  const [acknowledgedDup, setAcknowledgedDup] = useState(false);

  // Contact state (shared)
  const [contact, setContact] = useState({ name: "", designation: "", phone: "", email: "" });

  // Claim state
  const [claimSelected, setClaimSelected] = useState<HospitalMatch | null>(null);
  const [claimAssociation, setClaimAssociation] = useState("Owner");
  const [claimReason, setClaimReason] = useState("");
  const [claimDocs, setClaimDocs] = useState("");
  const [claimNotes, setClaimNotes] = useState("");

  // Duplicate report state
  const [dupSelected, setDupSelected] = useState<HospitalMatch | null>(null);
  const [primarySelected, setPrimarySelected] = useState<HospitalMatch | null>(null);
  const [dupReason, setDupReason] = useState("");
  const [dupDocs, setDupDocs] = useState("");
  const [dupNotes, setDupNotes] = useState("");

  // Submit state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; dashboardUrl?: string; refId?: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() as Promise<{ data: AuthUser }> : Promise.reject())
      .then((json) => {
        setAuthUser(json.data);
        setContact((c) => ({ ...c, name: json.data.fullName ?? "", email: json.data.email ?? "" }));
      })
      .catch(() => setAuthUser(null))
      .finally(() => setAuthChecked(true));
  }, [isOpen]);

  // ── Google Sign-in ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || authUser || !authChecked || !GOOGLE_CLIENT_ID) return;

    function initGoogle() {
      const win = window as unknown as {
        google?: { accounts: { id: { initialize: (o: unknown) => void; renderButton: (el: HTMLElement, o: unknown) => void } } };
      };
      if (!win.google?.accounts) return;
      win.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCred, ux_mode: "popup" });
      const btn = document.getElementById("reg-google-btn");
      if (btn) win.google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: 300, text: "signin_with" });
    }

    initGoogle();
    window.addEventListener("google-gsi-loaded", initGoogle);
    return () => window.removeEventListener("google-gsi-loaded", initGoogle);
  }, [isOpen, authUser, authChecked]);

  async function handleGoogleCred(response: { credential: string }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: response.credential }),
    });
    const json = await res.json() as { userId?: string; email?: string; name?: string; error?: string };
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Sign-in failed"); return; }
    const user: AuthUser = { userId: json.userId ?? "", email: json.email ?? "", fullName: json.name };
    setAuthUser(user);
    setContact((c) => ({ ...c, name: json.name ?? "", email: json.email ?? "" }));
  }

  // ── Duplicate check for new listing ─────────────────────────────────────────
  async function checkDuplicates() {
    if (!newForm.name.trim()) return;
    setDupCheckBusy(true);
    const res = await fetch("/api/register/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newForm.name.trim(), city: newForm.city.trim() || undefined }),
    });
    const data = await res.json() as { matches?: HospitalMatch[] };
    setDupMatches(data.matches ?? []);
    setDupChecked(true);
    setDupCheckBusy(false);
  }

  // ── Navigaition helpers ─────────────────────────────────────────────────────
  function goNext() {
    setError(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function setModeAndReset(m: Mode) {
    setMode(m);
    setStep(1);
    setError(null);
    setDupMatches([]);
    setDupChecked(false);
    setAcknowledgedDup(false);
    setConfirmed(false);
  }

  function resetAndClose() {
    setMode("select");
    setStep(1);
    setError(null);
    setSuccess(null);
    setDupMatches([]);
    setDupChecked(false);
    setAcknowledgedDup(false);
    setClaimSelected(null);
    setDupSelected(null);
    setPrimarySelected(null);
    setConfirmed(false);
    onClose();
  }

  // ── Submit: New listing ─────────────────────────────────────────────────────
  async function submitNew() {
    if (!contact.phone.trim()) { setError("Phone number is required."); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/register/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newForm.name,
        city: newForm.city,
        state: newForm.state || undefined,
        addressLine1: newForm.address || undefined,
        website: newForm.website || undefined,
        type: facilityType,
        contactName: contact.name,
        designation: contact.designation || undefined,
        phone: contact.phone,
        acknowledgedDuplicate: acknowledgedDup,
      }),
    });
    const json = await res.json() as { success?: boolean; dashboardUrl?: string; error?: string; details?: unknown };
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Registration failed."); return; }
    setSuccess({ message: "Your facility is now live on EasyHeals!", dashboardUrl: json.dashboardUrl });
  }

  // ── Submit: Claim existing ──────────────────────────────────────────────────
  async function submitClaim() {
    if (!claimSelected) { setError("Please select a facility to claim."); return; }
    if (!contact.phone.trim()) { setError("Phone number is required."); return; }
    const docs = claimDocs.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!docs.length) { setError("At least one proof document URL is required."); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/kyc-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "hospital",
        entityId: claimSelected.id,
        businessName: claimSelected.name,
        licenseNumber: "N/A",
        licenseType: "hospital",
        kycDocuments: docs,
        contactPhone: contact.phone,
        contactEmail: contact.email || authUser?.email,
        notes: `Association: ${claimAssociation}\nReason: ${claimReason}\n${claimNotes ? `Additional notes: ${claimNotes}` : ""}`,
      }),
    });
    const json = await res.json() as { data?: { id: string }; error?: string; details?: unknown };
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Claim submission failed."); return; }
    setSuccess({ message: "Claim submitted successfully! Our team will review within 2–3 business days.", refId: json.data?.id });
  }

  // ── Submit: Report duplicate ────────────────────────────────────────────────
  async function submitDuplicate() {
    if (!dupSelected || !primarySelected) { setError("Please select both the duplicate and primary listings."); return; }
    if (!contact.phone.trim()) { setError("Phone number is required."); return; }
    const docs = dupDocs.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!docs.length) { setError("At least one proof document URL is required."); return; }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/register/report-duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duplicateEntityId: dupSelected.id,
        keepEntityId: primarySelected.id,
        reason: dupReason,
        docUrls: docs,
        phone: contact.phone,
        contactName: contact.name,
        notes: dupNotes || undefined,
      }),
    });
    const json = await res.json() as { data?: { id: string }; error?: string };
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Submission failed."); return; }
    setSuccess({ message: "Duplicate report submitted. Admin will review and action within 3–5 business days.", refId: json.data?.id });
  }

  if (!isOpen) return null;

  // ── Step totals per mode
  const totalSteps = mode === "select" ? 1 : mode === "new" ? 3 : 3;
  const modeLabels: Record<Mode, string> = {
    select: "List or Claim a Facility",
    new: "Register New Facility",
    claim: "Claim Existing Listing",
    duplicate: "Report Duplicate",
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => window.dispatchEvent(new Event("google-gsi-loaded"))}
      />

      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) resetAndClose(); }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {mode !== "select" && (
                  <button type="button" onClick={() => setModeAndReset("select")} className="text-slate-400 hover:text-slate-700 text-sm font-medium mr-1">←</button>
                )}
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{modeLabels[mode]}</span>
              </div>
              {mode !== "select" && (
                <div className="flex gap-1.5 mt-1.5">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i < step ? "bg-teal-500" : "bg-slate-200"} ${i === step - 1 ? "w-8" : "w-4"}`} />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="text-slate-400 hover:text-slate-700 text-xl leading-none mt-0.5 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm leading-snug">
                {error}
              </div>
            )}

            {/* ── Success ── */}
            {success ? (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-bold text-slate-800">{success.message}</h3>
                {success.refId && (
                  <p className="text-xs text-slate-400 font-mono">Reference ID: {success.refId}</p>
                )}
                {success.dashboardUrl ? (
                  <a
                    href={success.dashboardUrl}
                    className="block w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm text-center transition-colors"
                  >
                    Go to Your Portal Dashboard →
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Close
                  </button>
                )}
              </div>
            ) : !authChecked ? (
              /* Auth loading */
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !authUser ? (
              /* ── Google Sign-in Screen ── */
              <div className="text-center py-6 space-y-5">
                <div className="text-4xl">🔐</div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Sign in to continue</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    We use Google to verify your identity before listing or claiming a facility.
                  </p>
                </div>
                <div className="flex justify-center">
                  <div id="reg-google-btn" />
                </div>
                {!GOOGLE_CLIENT_ID && (
                  <p className="text-xs text-red-500">Google Client ID not configured.</p>
                )}
                {busy && <p className="text-sm text-teal-600">Verifying...</p>}
                <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 text-left space-y-1">
                  <p className="font-semibold text-slate-500">Why Google sign-in?</p>
                  <p>Verifying your Google account helps prevent fraudulent listings and gives us a secure identity to process your request.</p>
                </div>
              </div>
            ) : mode === "select" ? (
              /* ── Mode Selector ── */
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">
                    Signed in as <span className="font-semibold text-slate-700">{authUser.email}</span>
                  </p>
                  <h3 className="text-lg font-bold text-slate-800 mt-1">What would you like to do?</h3>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      mode: "new" as Mode,
                      icon: "🏥",
                      title: "Register New Facility",
                      desc: "Create a brand new listing — hospital, clinic, diagnostic centre, or nursing home.",
                      color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50",
                    },
                    {
                      mode: "claim" as Mode,
                      icon: "✋",
                      title: "Claim Existing Listing",
                      desc: "This facility already exists on EasyHeals but you are its authorized representative.",
                      color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
                    },
                    {
                      mode: "duplicate" as Mode,
                      icon: "🚫",
                      title: "Report Duplicate",
                      desc: "A listing on EasyHeals is a duplicate and should be removed or merged.",
                      color: "border-orange-200 hover:border-orange-400 hover:bg-orange-50",
                    },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setModeAndReset(item.mode)}
                      className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${item.color}`}
                    >
                      <span className="text-3xl shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <p className="font-bold text-slate-800">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            ) : mode === "new" ? (
              /* ════════════════════════════════════════════════════
                 MODE: NEW LISTING
                 Step 1 → Type selector
                 Step 2 → Details + Duplicate check
                 Step 3 → Contact + Submit
              ════════════════════════════════════════════════════ */
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">What type of facility are you registering?</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {FACILITY_TYPES.map((ft) => (
                        <button
                          key={ft.value}
                          type="button"
                          onClick={() => { setFacilityType(ft.value); setError(null); }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${facilityType === ft.value ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20" : "border-slate-200 hover:border-teal-300 bg-white"}`}
                        >
                          <div className="text-2xl mb-1">{ft.icon}</div>
                          <p className="font-semibold text-slate-800 text-sm">{ft.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{ft.desc}</p>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={goNext}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Facility Details</h3>
                    <Field label="Facility Name" required>
                      <input
                        className={inputCls}
                        value={newForm.name}
                        onChange={(e) => { setNewForm((f) => ({ ...f, name: e.target.value })); setDupChecked(false); setDupMatches([]); }}
                        placeholder={`${FACILITY_TYPES.find((f) => f.value === facilityType)?.label} name`}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City" required>
                        <input className={inputCls} value={newForm.city} onChange={(e) => setNewForm((f) => ({ ...f, city: e.target.value }))} placeholder="e.g. Pune" />
                      </Field>
                      <Field label="State">
                        <input className={inputCls} value={newForm.state} onChange={(e) => setNewForm((f) => ({ ...f, state: e.target.value }))} placeholder="e.g. Maharashtra" />
                      </Field>
                    </div>
                    <Field label="Website">
                      <input className={inputCls} type="url" value={newForm.website} onChange={(e) => setNewForm((f) => ({ ...f, website: e.target.value }))} placeholder="www.hospital.com" />
                    </Field>
                    <Field label="Address">
                      <input className={inputCls} value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} placeholder="Street, area" />
                    </Field>

                    {/* Duplicate check */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-500">Duplicate Check</p>
                        <button
                          type="button"
                          onClick={() => void checkDuplicates()}
                          disabled={dupCheckBusy || !newForm.name.trim()}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {dupCheckBusy ? <><Spinner /> Checking...</> : "🔍 Check for Duplicates"}
                        </button>
                      </div>

                      {dupChecked && dupMatches.length === 0 && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                          <span>✅</span> No duplicates found. You can proceed.
                        </div>
                      )}

                      {dupChecked && dupMatches.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">⚠️</span>
                            <div>
                              <p className="text-sm font-semibold text-amber-800">Similar listings found</p>
                              <p className="text-xs text-amber-700 mt-0.5">Are any of these the same facility? If so, please claim it instead of creating a new listing.</p>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {dupMatches.map((m) => (
                              <div key={m.id} className="bg-white rounded-xl border border-amber-200 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                                    <p className="text-xs text-slate-500">{m.city}{m.state ? `, ${m.state}` : ""}{m.pincode ? ` — ${m.pincode}` : ""}</p>
                                  </div>
                                  {m.verified && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full shrink-0">✅ Verified</span>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setClaimSelected(m); setModeAndReset("claim"); }}
                                  className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  → This is my facility — Claim it instead
                                </button>
                              </div>
                            ))}
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={acknowledgedDup} onChange={(e) => setAcknowledgedDup(e.target.checked)} className="mt-0.5 accent-amber-600" />
                            <span className="text-xs text-amber-800">None of these match. I confirm this is a genuinely new facility.</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newForm.name.trim() || !newForm.city.trim()) { setError("Facility name and city are required."); return; }
                          if (dupMatches.length > 0 && !acknowledgedDup) { setError("Please confirm this is not a duplicate, or claim an existing listing."); return; }
                          goNext();
                        }}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Your Contact Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Your Name" required>
                        <input className={inputCls} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" />
                      </Field>
                      <Field label="Designation">
                        <input className={inputCls} value={contact.designation} onChange={(e) => setContact((c) => ({ ...c, designation: e.target.value }))} placeholder="e.g. Director" />
                      </Field>
                    </div>
                    <Field label="Mobile Number" required hint="Required for portal access and communications. Not publicly visible.">
                      <input className={inputCls} type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Email">
                      <input className={`${inputCls} bg-slate-100 text-slate-500`} type="email" value={contact.email || authUser?.email} readOnly />
                      <p className="text-xs text-slate-400 mt-1">From your Google account — cannot be changed here.</p>
                    </Field>

                    {/* Summary */}
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs text-slate-600 border border-slate-200">
                      <p className="font-semibold text-slate-700 mb-1">Registration Summary</p>
                      <p>Type: <span className="font-medium capitalize">{facilityType.replace("_", " ")}</span></p>
                      <p>Name: <span className="font-medium">{newForm.name}</span></p>
                      <p>City: <span className="font-medium">{newForm.city}{newForm.state ? `, ${newForm.state}` : ""}</span></p>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button type="button" onClick={() => void submitNew()} disabled={busy} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                        {busy ? <><Spinner /> Creating...</> : "Create Facility →"}
                      </button>
                    </div>
                  </div>
                )}
              </>

            ) : mode === "claim" ? (
              /* ════════════════════════════════════════════════════
                 MODE: CLAIM EXISTING
                 Step 1 → Search & select facility
                 Step 2 → Claim details + proof
                 Step 3 → Contact + confirm + submit
              ════════════════════════════════════════════════════ */
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Find Your Facility</h3>
                    <p className="text-sm text-slate-500">Search for the existing listing you want to claim ownership of.</p>
                    <FacilitySearch
                      label="Search facility"
                      placeholder="Facility name..."
                      onSelect={(m) => setClaimSelected(m.id ? m : null)}
                      selected={claimSelected}
                    />
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => { if (!claimSelected) { setError("Please select a facility."); return; } goNext(); }}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm">
                      <p className="font-semibold text-teal-800">Claiming: {claimSelected?.name}</p>
                      <p className="text-xs text-teal-600">{claimSelected?.city}{claimSelected?.state ? `, ${claimSelected.state}` : ""}</p>
                    </div>

                    <Field label="Your relationship to this facility" required>
                      <select className={selectCls} value={claimAssociation} onChange={(e) => setClaimAssociation(e.target.value)}>
                        {ASSOCIATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </Field>

                    <Field label="Reason for claiming" required hint="Explain how you are connected to this facility and why you have authority to manage it.">
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={3}
                        value={claimReason}
                        onChange={(e) => setClaimReason(e.target.value)}
                        placeholder="e.g. I am the owner and managing director of this hospital since 2015..."
                      />
                    </Field>

                    <Field
                      label="Proof document URLs"
                      required
                      hint="One URL per line. Upload to Google Drive / Dropbox / any cloud storage and paste the links here. Include: Registration certificate, MCI/State medical license, GST certificate, letterhead."
                    >
                      <textarea
                        className={`${inputCls} resize-none font-mono text-xs`}
                        rows={4}
                        value={claimDocs}
                        onChange={(e) => setClaimDocs(e.target.value)}
                        placeholder={"https://drive.google.com/file/...\nhttps://..."}
                      />
                    </Field>

                    <Field label="Additional notes" >
                      <textarea className={`${inputCls} resize-none`} rows={2} value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)} placeholder="Any other information for the review team..." />
                    </Field>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!claimReason.trim()) { setError("Please describe your reason for claiming."); return; }
                          if (!claimDocs.trim()) { setError("At least one proof document URL is required."); return; }
                          goNext();
                        }}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Contact & Declaration</h3>
                    <Field label="Mobile Number" required hint="Required for admin to contact you during review.">
                      <input className={inputCls} type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Your Name" required>
                      <input className={inputCls} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" />
                    </Field>

                    <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-teal-600 shrink-0" />
                      <span className="text-xs text-slate-700 leading-relaxed">
                        I declare that I am an authorized representative of <strong>{claimSelected?.name}</strong> and that all information and documents provided are genuine and accurate. I understand that providing false information may result in permanent account suspension.
                      </span>
                    </label>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => { if (!confirmed) { setError("Please confirm the declaration to proceed."); return; } void submitClaim(); }}
                        disabled={busy}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {busy ? <><Spinner /> Submitting...</> : "Submit Claim →"}
                      </button>
                    </div>
                  </div>
                )}
              </>

            ) : mode === "duplicate" ? (
              /* ════════════════════════════════════════════════════
                 MODE: REPORT DUPLICATE
                 Step 1 → Find duplicate listing
                 Step 2 → Find primary listing + reason + proof
                 Step 3 → Contact + confirm + submit
              ════════════════════════════════════════════════════ */
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Find the Duplicate Listing</h3>
                    <p className="text-sm text-slate-500">Search for the listing that is a duplicate and should be removed.</p>
                    <FacilitySearch
                      label="The listing to be removed"
                      placeholder="Duplicate facility name..."
                      onSelect={(m) => setDupSelected(m.id ? m : null)}
                      selected={dupSelected}
                    />
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => { if (!dupSelected) { setError("Please select the duplicate listing."); return; } goNext(); }}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
                      <p className="text-xs text-slate-500 font-medium mb-0.5">Listing to be removed</p>
                      <p className="font-semibold text-slate-800">{dupSelected?.name} — {dupSelected?.city}</p>
                    </div>

                    <FacilitySearch
                      label="The primary listing to keep"
                      placeholder="Primary facility name..."
                      onSelect={(m) => setPrimarySelected(m.id ? m : null)}
                      selected={primarySelected}
                      excludeId={dupSelected?.id}
                    />

                    <Field label="Why is this a duplicate?" required hint="Explain how you know these two listings refer to the same facility.">
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={3}
                        value={dupReason}
                        onChange={(e) => setDupReason(e.target.value)}
                        placeholder="e.g. Both listings refer to Apollo Hospitals Pune, Main Road. One was created accidentally by a data import..."
                      />
                    </Field>

                    <Field
                      label="Proof document URLs"
                      required
                      hint="Upload evidence to Google Drive / Dropbox and paste links below. Include letterhead, license, or any official document showing the correct facility."
                    >
                      <textarea
                        className={`${inputCls} resize-none font-mono text-xs`}
                        rows={3}
                        value={dupDocs}
                        onChange={(e) => setDupDocs(e.target.value)}
                        placeholder={"https://drive.google.com/file/...\nhttps://..."}
                      />
                    </Field>

                    <Field label="Additional notes">
                      <textarea className={`${inputCls} resize-none`} rows={2} value={dupNotes} onChange={(e) => setDupNotes(e.target.value)} placeholder="Any other context..." />
                    </Field>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!primarySelected) { setError("Please select the primary listing to keep."); return; }
                          if (!dupReason.trim()) { setError("Please describe why this is a duplicate."); return; }
                          if (!dupDocs.trim()) { setError("At least one proof document URL is required."); return; }
                          goNext();
                        }}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 text-base">Contact & Declaration</h3>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div>
                        <p className="text-slate-400 font-medium mb-0.5">Remove</p>
                        <p className="font-semibold text-red-700">{dupSelected?.name}</p>
                        <p className="text-slate-500">{dupSelected?.city}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium mb-0.5">Keep</p>
                        <p className="font-semibold text-green-700">{primarySelected?.name}</p>
                        <p className="text-slate-500">{primarySelected?.city}</p>
                      </div>
                    </div>

                    <Field label="Mobile Number" required hint="Required for admin to contact you during review.">
                      <input className={inputCls} type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Your Name" required>
                      <input className={inputCls} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" />
                    </Field>

                    <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-orange-600 shrink-0" />
                      <span className="text-xs text-slate-700 leading-relaxed">
                        I confirm that the information above is accurate and that I am submitting this report in good faith. I understand that malicious abuse of the duplicate report system will result in account suspension.
                      </span>
                    </label>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={goBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-colors">← Back</button>
                      <button
                        type="button"
                        onClick={() => { if (!confirmed) { setError("Please confirm the declaration."); return; } void submitDuplicate(); }}
                        disabled={busy}
                        className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {busy ? <><Spinner /> Submitting...</> : "Submit Report →"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
