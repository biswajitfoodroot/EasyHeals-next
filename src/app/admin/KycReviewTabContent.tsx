"use client";

import { useState, useEffect } from "react";

type KycRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  businessName: string | null;
  licenseNumber: string | null;
  licenseType: string | null;
  kycDocuments: string[];
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  approvedEntityId: string | null;
  createdAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  under_review: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  info_requested: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function KycReviewTabContent({ myRole }: { myRole: string }) {
  const canApprove = ["owner", "admin", "admin_manager"].includes(myRole);

  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [linkEntityId, setLinkEntityId] = useState<Record<string, string>>({});
  const [actioning, setActioning] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { type: "ok" | "err"; text: string }>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kyc-requests?status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json() as { data: KycRequest[] };
        setRequests(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function act(id: string, action: "approve" | "reject" | "under_review" | "info_requested") {
    setActioning(id);
    setMsg((prev) => ({ ...prev, [id]: { type: "ok", text: "" } }));
    try {
      const res = await fetch("/api/admin/kyc-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reviewNotes: reviewNotes[id] ?? "",
          linkEntityId: linkEntityId[id] ?? undefined,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setMsg((prev) => ({ ...prev, [id]: { type: "err", text: json.error ?? "Failed" } }));
      } else {
        setMsg((prev) => ({ ...prev, [id]: { type: "ok", text: `Status → ${action === "approve" ? "approved" : action}` } }));
        void load();
      }
    } catch {
      setMsg((prev) => ({ ...prev, [id]: { type: "err", text: "Network error" } }));
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">KYC & Access Requests</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Review provider KYC submissions. Approve to automatically link accounts to entities.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["pending", "under_review", "info_requested", "approved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  statusFilter === s
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No {statusFilter} requests.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((r) => (
              <div key={r.id} className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                      <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                        {r.entityType}
                      </span>
                      <span className="text-xs text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{r.businessName}</p>
                    <p className="text-sm text-slate-500">
                      {r.requesterName} · {r.requesterEmail}
                    </p>
                    {r.entityName && (
                      <p className="text-xs text-slate-500">
                        Claiming: <span className="font-medium">{r.entityName}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="text-xs text-teal-600 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 font-semibold flex-shrink-0"
                  >
                    {expanded === r.id ? "Close" : "Review"}
                  </button>
                </div>

                {/* Expanded review panel */}
                {expanded === r.id && (
                  <div className="mt-4 space-y-4">
                    {/* KYC details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl text-sm">
                      <div><p className="text-xs text-slate-400 mb-0.5">License No.</p><p className="font-medium">{r.licenseNumber ?? "—"}</p></div>
                      <div><p className="text-xs text-slate-400 mb-0.5">License Type</p><p className="font-medium">{r.licenseType ?? "—"}</p></div>
                      <div><p className="text-xs text-slate-400 mb-0.5">Phone</p><p className="font-medium">{r.contactPhone ?? "—"}</p></div>
                      <div><p className="text-xs text-slate-400 mb-0.5">Email</p><p className="font-medium">{r.contactEmail ?? "—"}</p></div>
                      {r.entityId && <div><p className="text-xs text-slate-400 mb-0.5">Entity ID</p><p className="font-mono text-xs">{r.entityId}</p></div>}
                    </div>

                    {/* KYC Documents */}
                    {r.kycDocuments && r.kycDocuments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">KYC Documents</p>
                        <div className="space-y-1">
                          {r.kycDocuments.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm text-teal-600 hover:underline truncate"
                            >
                              📄 Document {i + 1}: {url.split("/").pop()}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes from requester */}
                    {r.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Requester Notes</p>
                        <p className="text-slate-700">{r.notes}</p>
                      </div>
                    )}

                    {canApprove && (
                      <>
                        {/* Link to entity ID (for approval) */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Link to Entity ID <span className="font-normal text-slate-400">(set on approval)</span>
                          </label>
                          <input
                            value={linkEntityId[r.id] ?? r.entityId ?? ""}
                            onChange={(e) => setLinkEntityId((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                            placeholder="Hospital / Doctor UUID"
                          />
                        </div>

                        {/* Review notes */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Review Notes</label>
                          <textarea
                            rows={2}
                            value={reviewNotes[r.id] ?? ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                            placeholder="Add notes for the requester..."
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => act(r.id, "approve")}
                            disabled={actioning === r.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                          >
                            ✅ Approve & Link
                          </button>
                          <button
                            onClick={() => act(r.id, "under_review")}
                            disabled={actioning === r.id}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                          >
                            🔍 Mark Under Review
                          </button>
                          <button
                            onClick={() => act(r.id, "info_requested")}
                            disabled={actioning === r.id}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                          >
                            ❓ Request More Info
                          </button>
                          <button
                            onClick={() => act(r.id, "reject")}
                            disabled={actioning === r.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                          >
                            ❌ Reject
                          </button>
                        </div>

                        {msg[r.id] && (
                          <p className={`text-sm ${msg[r.id].type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                            {msg[r.id].text}
                          </p>
                        )}
                      </>
                    )}

                    {/* Existing review notes */}
                    {r.reviewNotes && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Review Notes</p>
                        <p className="text-slate-700">{r.reviewNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
