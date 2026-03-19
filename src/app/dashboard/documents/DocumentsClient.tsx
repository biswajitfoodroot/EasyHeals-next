"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthDocument {
  id: string;
  title: string | null;
  docType: string | null;
  fileType: string;
  sourceName: string | null;
  docDate: string | null;
  aiStatus: "pending" | "processing" | "done" | "failed";
  uploadedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_report: "Lab Report",
  prescription: "Prescription",
  discharge: "Discharge Summary",
  imaging: "Imaging / Scan",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  done:       "bg-green-50 text-green-700 border-green-200",
  failed:     "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  processing: "Extracting...",
  done: "AI Extracted",
  failed: "Extraction Failed",
};

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TrialStatus {
  inTrial: boolean;
  trialDaysLeft: number;
  canUsePremium: boolean;
  tier: string;
}

export default function DocumentsClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<HealthDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDocType, setFormDocType] = useState("other");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [shareProviderId, setShareProviderId] = useState("");
  const [shareProviderType, setShareProviderType] = useState<"doctor" | "hospital">("doctor");
  const [shareExpiry, setShareExpiry] = useState(30);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);

  useEffect(() => { void load(); void loadTrial(); }, []);

  // Poll for processing documents every 5s
  useEffect(() => {
    const hasProcessing = docs.some((d) => d.aiStatus === "pending" || d.aiStatus === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [docs]);

  async function loadTrial() {
    try {
      const res = await fetch("/api/v1/patients/subscription", { credentials: "include" });
      if (res.ok) {
        const j = await res.json() as { data: TrialStatus };
        setTrial(j.data);
      }
    } catch { /* non-fatal */ }
  }

  async function load() {
    try {
      const res = await fetch("/api/v1/patients/documents", { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      if (res.ok) {
        const j = await res.json() as { data: HealthDocument[] };
        setDocs(j.data);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setShowForm(true);
    setUploadMsg(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadMsg(null);

    const form = new FormData();
    form.append("file", selectedFile);
    if (formTitle.trim()) form.append("title", formTitle.trim());
    if (formDocType) form.append("docType", formDocType);

    try {
      const res = await fetch("/api/v1/patients/documents", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const j = await res.json().catch(() => ({})) as { error?: string; data?: { message?: string } };

      if (res.status === 402) {
        router.push("/dashboard/upgrade");
        return;
      }
      if (res.status === 403 && (j as { error?: { code?: string } }).error?.code === "CONSENT_MISSING") {
        setUploadMsg({ type: "error", text: "Please grant consent to store health documents. Go to Privacy Settings." });
        return;
      }
      if (!res.ok) {
        const errMsg = typeof j.error === "object" ? (j.error as { message?: string })?.message : j.error;
        setUploadMsg({ type: "error", text: errMsg ?? "Upload failed. Please try again." });
        return;
      }
      setUploadMsg({ type: "success", text: "Document uploaded! AI extraction in progress." });
      setShowForm(false);
      setSelectedFile(null);
      setFormTitle("");
      setFormDocType("other");
      void load();
    } catch {
      setUploadMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleShare() {
    if (!shareDocId || !shareProviderId.trim()) return;
    setSharing(true);
    setShareMsg(null);
    try {
      const res = await fetch(`/api/v1/patients/documents/${shareDocId}/share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: shareProviderId.trim(),
          providerType: shareProviderType,
          expiresInDays: shareExpiry,
        }),
      });
      const j = await res.json().catch(() => ({})) as { error?: string };
      if (res.status === 403 && (j as { error?: string }).error === "CONSENT_MISSING") {
        setShareMsg({ type: "error", text: "Please grant 'Share Records with Doctors' consent in Privacy Settings first." });
        return;
      }
      if (!res.ok) {
        setShareMsg({ type: "error", text: j.error ?? "Share failed." });
        return;
      }
      setShareMsg({ type: "success", text: "Document shared successfully." });
      setShareDocId(null);
      setShareProviderId("");
    } catch {
      setShareMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and its extracted health data? This cannot be undone.")) return;
    await fetch(`/api/v1/patients/documents/${id}`, { method: "DELETE", credentials: "include" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">My Health Documents</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Trial / subscription banner */}
        {trial && trial.canUsePremium && trial.inTrial && (
          <div className={`px-4 py-3 rounded-xl text-sm flex items-center justify-between border ${
            trial.trialDaysLeft <= 3
              ? "bg-orange-50 border-orange-200 text-orange-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}>
            <span>
              {trial.trialDaysLeft <= 3
                ? `⚠️ Free trial ending in ${trial.trialDaysLeft} day${trial.trialDaysLeft !== 1 ? "s" : ""}!`
                : `✨ Free trial: ${trial.trialDaysLeft} days remaining`}
            </span>
            <Link href="/dashboard/upgrade" className="text-xs font-semibold underline ml-3">Upgrade</Link>
          </div>
        )}
        {trial && !trial.canUsePremium && (
          <div className="px-4 py-3 rounded-xl text-sm flex items-center justify-between bg-red-50 border border-red-200 text-red-800">
            <span>🔒 Your free trial has ended. Upgrade to continue uploading documents.</span>
            <Link href="/dashboard/upgrade" className="px-3 py-1 text-xs font-semibold text-white rounded-lg ml-3" style={{ background: "#1B8A4A" }}>Upgrade Now</Link>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Health Documents</h1>
            <p className="text-sm text-slate-400">Upload reports, prescriptions & discharge summaries. AI extracts key data automatically.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Take Photo — opens camera on mobile, image picker on desktop */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-3 py-2.5 text-sm font-semibold border border-slate-300 text-slate-700 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition"
            >
              📷 Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center gap-2"
              style={{ background: "#1B8A4A" }}
            >
              + Upload File
            </button>
          </div>
          {/* File picker (PDF + images) */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
          />
          {/* Camera capture — uses device camera on mobile */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
          />
        </div>

        {/* Upload message */}
        {uploadMsg && (
          <div className={`p-3 rounded-xl text-sm border ${uploadMsg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {uploadMsg.text}
          </div>
        )}

        {/* Upload form */}
        {showForm && selectedFile && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">
                {selectedFile.name.endsWith(".pdf") ? "📄" : "🖼️"}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Document Type</label>
                <select
                  value={formDocType}
                  onChange={(e) => setFormDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. CBC Report March 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setSelectedFile(null); }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2"
                style={{ background: "#1B8A4A" }}
              >
                {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading...</> : "Upload & Extract"}
              </button>
            </div>
          </div>
        )}

        {/* Drop zone (shown when no documents and no form) */}
        {!showForm && docs.length === 0 && !loading && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${dragOver ? "border-green-400 bg-green-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm font-semibold text-slate-600">Drop a file or click to upload</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, WebP — up to 10MB</p>
            <p className="text-xs text-slate-400">Lab reports, prescriptions, discharge summaries</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-20" />
            ))}
          </div>
        )}

        {/* Document list */}
        {!loading && docs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{docs.length} document{docs.length !== 1 ? "s" : ""}</h2>
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5">
                  {doc.fileType === "pdf" ? "📄" : "🖼️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {doc.title ?? DOC_TYPE_LABELS[doc.docType ?? ""] ?? "Document"}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[doc.aiStatus]}`}>
                      {STATUS_LABELS[doc.aiStatus]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {doc.docType && <span className="text-xs text-slate-400">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</span>}
                    {doc.sourceName && <span className="text-xs text-slate-400">· {doc.sourceName}</span>}
                    {doc.docDate && <span className="text-xs text-slate-400">· {formatDate(doc.docDate)}</span>}
                    <span className="text-xs text-slate-300">· Uploaded {formatDate(doc.uploadedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {doc.aiStatus === "done" && (
                    <Link
                      href={`/dashboard/health-timeline?source=${doc.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Timeline
                    </Link>
                  )}
                  {doc.aiStatus === "done" && (
                    <button
                      onClick={() => { setShareDocId(doc.id); setShareMsg(null); }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"
                    >
                      Share
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Share modal */}
        {shareDocId && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-800">Share Document</h2>

              {shareMsg && (
                <div className={`p-3 rounded-xl text-sm border ${shareMsg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                  {shareMsg.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Provider Type</label>
                <div className="flex gap-2">
                  {(["doctor", "hospital"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setShareProviderType(t)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${shareProviderType === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"}`}
                    >
                      {t === "doctor" ? "Doctor" : "Hospital"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Provider ID</label>
                <input
                  type="text"
                  value={shareProviderId}
                  onChange={(e) => setShareProviderId(e.target.value)}
                  placeholder="Enter doctor or hospital ID"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Find the provider ID on their profile page.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Access Duration</label>
                <select
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => { setShareDocId(null); setShareMsg(null); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleShare()}
                  disabled={sharing || !shareProviderId.trim()}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60"
                  style={{ background: "#1B8A4A" }}
                >
                  {sharing ? "Sharing..." : "Share"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">How it works:</span> Documents are stored securely and processed by AI to extract diagnoses, lab results, medications, and vitals into your Health Timeline. You control who sees this data.{" "}
            <Link href="/dashboard/privacy" className="underline font-semibold">Manage privacy settings →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
