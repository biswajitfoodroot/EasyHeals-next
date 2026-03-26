"use client";

import { useState } from "react";
import ReferralStatusBadge from "./ReferralStatusBadge";

type ReferralCase = {
  id: string;
  referralCode?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  clinicalCategory?: string | null;
  suspectedCondition?: string | null;
  urgency: string;
  status: string;
  clinicalNotes?: string | null;
  createdAt: string | null;
};

type Props = {
  referral: ReferralCase;
  onAction?: (id: string, action: "accepted" | "rejected") => void;
};

const URGENCY_LABEL: Record<string, { label: string; cls: string }> = {
  emergency_transfer: { label: "Emergency", cls: "bg-red-50 text-red-600 border-red-200" },
  urgent:             { label: "Urgent",    cls: "bg-orange-50 text-orange-600 border-orange-200" },
  priority:           { label: "Priority",  cls: "bg-amber-50 text-amber-600 border-amber-200" },
  routine:            { label: "Routine",   cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export default function IncomingReferralCard({ referral, onAction }: Props) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urgency = URGENCY_LABEL[referral.urgency] ?? URGENCY_LABEL.routine;
  const canAct = ["submitted", "triaging", "destination_suggested"].includes(referral.status);

  async function doAction(action: "accept" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const endpoint = `/api/v1/referrals/${referral.id}/${action}`;
      const body = action === "reject" ? { reason: rejectReason } : undefined;
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Action failed");
        return;
      }
      onAction?.(referral.id, action === "accept" ? "accepted" : "rejected");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
      referral.urgency === "emergency_transfer" ? "border-red-200" : "border-slate-200"
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">
              {referral.patientName ?? "Patient"}
            </span>
            <ReferralStatusBadge status={referral.status} />
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgency.cls}`}>
              {urgency.label}
            </span>
          </div>
          {referral.clinicalCategory && (
            <p className="text-xs text-slate-400 mt-0.5">{referral.clinicalCategory}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {referral.referralCode && (
            <p className="text-[10px] font-mono text-slate-300">{referral.referralCode}</p>
          )}
          <p className="text-xs text-slate-400">
            {referral.createdAt
              ? new Date(referral.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
              : "—"}
          </p>
        </div>
      </div>

      {/* Clinical summary */}
      {(referral.suspectedCondition || referral.clinicalNotes) && (
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1">
          {referral.suspectedCondition && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Suspected: </span>
              {referral.suspectedCondition}
            </p>
          )}
          {referral.clinicalNotes && (
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
              {referral.clinicalNotes}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Reject reason input */}
      {showReject && (
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          placeholder="Reason for rejection (required)"
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="flex items-center gap-2">
          {!showReject ? (
            <>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={loading !== null}
                className="flex-1 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500 transition"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => void doAction("accept")}
                disabled={loading !== null}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white transition active:scale-95 disabled:opacity-50"
                style={{ background: "#1B8A4A" }}
              >
                {loading === "accept" && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Accept Referral
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setShowReject(false); setRejectReason(""); }}
                disabled={loading !== null}
                className="flex-1 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doAction("reject")}
                disabled={loading !== null || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-red-500 text-white transition active:scale-95 disabled:opacity-40"
              >
                {loading === "reject" && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Confirm Decline
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
