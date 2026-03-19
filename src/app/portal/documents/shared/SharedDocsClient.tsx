"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedDoc {
  shareId: string;
  documentId: string;
  patientId: string;
  providerType: "doctor" | "hospital";
  expiresAt: string | null;
  createdAt: string | null;
  title: string | null;
  docType: string | null;
  fileType: string;
  sourceName: string | null;
  docDate: string | null;
  aiStatus: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_report: "Lab Report",
  prescription: "Prescription",
  discharge: "Discharge Summary",
  imaging: "Imaging / Scan",
  other: "Other",
};

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SharedDocsClient() {
  const router = useRouter();
  const [docs, setDocs] = useState<SharedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/documents/shared", { credentials: "include" });
        if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
        if (res.ok) {
          const j = await res.json() as { data: SharedDoc[] };
          setDocs(j.data);
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    void load();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/portal/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Portal</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Shared Patient Records</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Shared Patient Records</h1>
          <p className="text-sm text-slate-400">Documents patients have shared with you. Access expires per patient consent settings.</p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-2xl h-20" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && docs.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-sm font-semibold text-slate-600">No shared records</p>
            <p className="text-xs text-slate-400 mt-1">Patients can share their health documents with you from their dashboard.</p>
          </div>
        )}

        {/* Document list */}
        {!loading && docs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {docs.length} shared record{docs.length !== 1 ? "s" : ""}
            </h2>
            {docs.map((doc) => (
              <div key={doc.shareId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5">
                  {doc.fileType === "pdf" ? "📄" : "🖼️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {doc.title ?? DOC_TYPE_LABELS[doc.docType ?? ""] ?? "Document"}
                    </p>
                    {isExpiringSoon(doc.expiresAt) && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-700 border-yellow-200">
                        Expires soon
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {doc.docType && <span className="text-xs text-slate-400">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</span>}
                    {doc.sourceName && <span className="text-xs text-slate-400">· {doc.sourceName}</span>}
                    {doc.docDate && <span className="text-xs text-slate-400">· {formatDate(doc.docDate)}</span>}
                    <span className="text-xs text-slate-300">· Access expires {formatDate(doc.expiresAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {doc.aiStatus === "done" && (
                    <Link
                      href={`/portal/patients/${doc.patientId}/timeline?shareId=${doc.shareId}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      View Events
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audit notice */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Access is audited.</span>{" "}
            All document access is logged and visible to the patient under their Privacy settings. Access expires as set by the patient.
          </p>
        </div>
      </div>
    </div>
  );
}
