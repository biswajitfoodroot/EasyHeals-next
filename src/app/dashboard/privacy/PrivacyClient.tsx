"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConsentRecord {
  id: string;
  purpose: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  version: string | null;
}

// ── Consent purpose catalog ───────────────────────────────────────────────────

const CONSENT_PURPOSES: {
  purpose: string;
  label: string;
  description: string;
  required: boolean;
  icon: string;
}[] = [
  {
    purpose: "care_navigation",
    label: "Appointment & Care Navigation",
    description: "Required to book appointments, match you with doctors and hospitals, and coordinate your care journey.",
    required: true,
    icon: "📅",
  },
  {
    purpose: "health_document_processing",
    label: "AI Document Processing",
    description: "Allows EasyHeals to process and extract health data from documents you upload (lab reports, prescriptions, discharge summaries) using AI.",
    required: false,
    icon: "📄",
  },
  {
    purpose: "ai_health_coach",
    label: "AI Health Coach",
    description: "Enables the AI Health Coach to access your health history, extracted lab values, diagnoses, and medications to provide personalised health guidance.",
    required: false,
    icon: "🤖",
  },
  {
    purpose: "provider_health_share",
    label: "Share Records with Doctors",
    description: "Allows you to selectively share your health documents with doctors and hospitals you choose. Required for the document sharing feature.",
    required: false,
    icon: "🔗",
  },
  {
    purpose: "abha_link",
    label: "ABHA Health ID Linking",
    description: "Enables linking your Ayushman Bharat Digital Mission (ABDM) Health ID to import government health records.",
    required: false,
    icon: "🏥",
  },
  {
    purpose: "marketing_communications",
    label: "Health Tips & Offers",
    description: "Receive personalised health tips, appointment reminders, and promotional offers from EasyHeals.",
    required: false,
    icon: "📬",
  },
];

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrivacyClient() {
  const router = useRouter();
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [abhaId, setAbhaId] = useState("");
  const [abhaLinking, setAbhaLinking] = useState(false);
  const [abhaMsg, setAbhaMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { void loadConsents(); }, []);

  async function loadConsents() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/patients/consent", { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      if (res.ok) {
        const j = await res.json() as { data: ConsentRecord[] };
        setRecords(j.data);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  function getConsentStatus(purpose: string): ConsentRecord | null {
    return records.find((r) => r.purpose === purpose) ?? null;
  }

  function isGranted(purpose: string): boolean {
    const r = getConsentStatus(purpose);
    return !!(r && r.granted && !r.revokedAt);
  }

  async function toggleConsent(purpose: string, currentlyGranted: boolean) {
    setUpdating(purpose);
    setMsg(null);
    try {
      if (currentlyGranted) {
        // Revoke
        const res = await fetch("/api/v1/consent/revoke", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
          const errText = typeof j.error === "string" ? j.error : (j.error?.message ?? "Failed to revoke consent.");
          setMsg({ type: "error", text: errText });
          return;
        }
        setMsg({ type: "success", text: "Consent withdrawn. Your data will not be used for this purpose." });
      } else {
        // Grant
        const res = await fetch("/api/v1/patients/consent", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purposes: [purpose] }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
          const errText = typeof j.error === "string" ? j.error : (j.error?.message ?? "Failed to grant consent.");
          setMsg({ type: "error", text: errText });
          return;
        }
        setMsg({ type: "success", text: "Consent granted." });
      }
      await loadConsents();
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUpdating(null);
    }
  }

  async function handleAbhaLink() {
    if (!abhaId.trim()) return;
    setAbhaLinking(true);
    setAbhaMsg(null);
    try {
      const res = await fetch("/api/v1/patients/abha/link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abhaId: abhaId.trim() }),
      });
      const j = await res.json().catch(() => ({})) as { error?: { message?: string } | string; data?: { message?: string } };
      if (res.status === 503) {
        setAbhaMsg({ type: "error", text: "ABHA integration coming soon." });
        return;
      }
      if (res.status === 403) {
        setAbhaMsg({ type: "error", text: "Please grant ABHA consent below first." });
        return;
      }
      if (!res.ok) {
        const errText = typeof j.error === "string" ? j.error : (j.error?.message ?? "ABHA linking failed.");
        setAbhaMsg({ type: "error", text: errText });
        return;
      }
      setAbhaMsg({ type: "success", text: j.data?.message ?? "ABHA Health ID linked successfully." });
      setAbhaId("");
    } catch {
      setAbhaMsg({ type: "error", text: "Network error." });
    } finally {
      setAbhaLinking(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/patients/me", { method: "DELETE", credentials: "include" });
      if (res.ok) {
        router.push("/login?deleted=1");
      } else {
        setMsg({ type: "error", text: "Failed to delete account. Please contact support." });
        setDeleteConfirm(false);
      }
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Privacy & Consent</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Privacy & Consent</h1>
          <p className="text-sm text-slate-400 mt-1">
            You are in control of your health data. Manage your consents under the Digital Personal Data Protection (DPDP) Act 2023.
          </p>
        </div>

        {/* Alert message */}
        {msg && (
          <div className={`p-3 rounded-xl text-sm border ${msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {msg.text}
          </div>
        )}

        {/* Consent toggles */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {CONSENT_PURPOSES.map(({ purpose, label, description, required, icon }) => {
              const granted = isGranted(purpose);
              const record = getConsentStatus(purpose);
              const isUpdating = updating === purpose;

              return (
                <div key={purpose} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{icon}</span>
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        {required && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Required</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                      {record && (
                        <p className="text-xs text-slate-400 mt-1">
                          {granted ? `Granted ${formatDate(record.grantedAt)}` : `Withdrawn ${formatDate(record.revokedAt)}`}
                        </p>
                      )}
                    </div>
                    {required ? (
                      <div className="shrink-0">
                        <span className="text-xs text-slate-400 italic">Always on</span>
                      </div>
                    ) : (
                      <button
                        disabled={isUpdating}
                        onClick={() => void toggleConsent(purpose, granted)}
                        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${granted ? "bg-green-500" : "bg-slate-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${granted ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Data export */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Data Portability</h2>
          <p className="text-xs text-slate-500 mb-3">Download a complete copy of your health data as a JSON file. This includes all extracted health events from your uploaded documents.</p>
          <a
            href="/api/v1/patients/health-export"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
            style={{ background: "#1B8A4A" }}
          >
            ⬇ Export My Health Data
          </a>
        </div>

        {/* ABHA Health ID linking — only shown when abha_link consent is granted */}
        {(() => {
          const abhaConsent = records.find((r) => r.purpose === "abha_link");
          const abhaGranted = abhaConsent?.granted === true;
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏥</span>
                <h2 className="text-sm font-semibold text-slate-800">ABHA Health ID Linking</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Link your Ayushman Bharat Digital Mission (ABDM) Health ID to import your government health records directly into your Health Timeline.
              </p>

              {!abhaGranted ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Enable <span className="font-semibold">ABHA Health ID Linking</span> consent in the toggles above to unlock this feature.
                </div>
              ) : (
                <>
                  {abhaMsg && (
                    <div className={`p-3 rounded-xl text-sm border mb-3 ${abhaMsg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {abhaMsg.text}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={abhaId}
                      onChange={(e) => setAbhaId(e.target.value)}
                      placeholder="e.g. 12-3456-7890-1234 or username@abdm"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    />
                    <button
                      onClick={() => void handleAbhaLink()}
                      disabled={abhaLinking || !abhaId.trim()}
                      className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                      style={{ background: "#1B8A4A" }}
                    >
                      {abhaLinking ? "Linking..." : "Link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Account deletion */}
        <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
          <h2 className="text-sm font-semibold text-red-800 mb-1">Delete My Account</h2>
          <p className="text-xs text-red-600 mb-3">
            Permanently deletes your account, all health documents, extracted health events, appointments, and consent records. This action cannot be undone.
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-xl hover:bg-red-100 transition"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-700">Are you sure? This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Yes, Delete Everything"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DPDP info */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Your rights under DPDP Act 2023:</span>{" "}
            You have the right to access, correct, and erase your personal data. You can withdraw consent at any time.
            For grievances, contact{" "}
            <a href="mailto:admin@easyheals.com" className="underline font-semibold">admin@easyheals.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
