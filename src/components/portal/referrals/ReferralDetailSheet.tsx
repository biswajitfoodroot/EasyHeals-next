"use client";

import { useEffect, useState } from "react";
import ReferralStatusBadge from "./ReferralStatusBadge";
import ReferralTimeline from "./ReferralTimeline";

type TimelineEvent = {
  id: string;
  eventType: string;
  note?: string | null;
  createdByActorType?: string | null;
  createdAt: string | null;
};

type ReferralDetail = {
  id: string;
  referralCode?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  clinicalCategory?: string | null;
  suspectedCondition?: string | null;
  urgency: string;
  status: string;
  referralType: string;
  clinicalNotes?: string | null;
  destinationCity?: string | null;
  outstationRequired?: boolean | null;
  accommodationRequired?: boolean | null;
  createdAt: string | null;
  events?: TimelineEvent[];
};

type Props = {
  referralId: string;
  userRole: string;
  entityId: string;
  onClose: () => void;
  onUpdate?: () => void;
};

export default function ReferralDetailSheet({ referralId, userRole, entityId, onClose, onUpdate }: Props) {
  const [referral, setReferral] = useState<ReferralDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/referrals/${referralId}`, { credentials: "include" })
      .then(r => r.json())
      .then(({ data }: { data: ReferralDetail }) => setReferral(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [referralId]);

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    await fetch(`/api/v1/referrals/${referralId}/events`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText }),
    });
    setNoteText("");
    setAddingNote(false);
    // Re-fetch
    const res = await fetch(`/api/v1/referrals/${referralId}`, { credentials: "include" });
    const { data } = await res.json() as { data: ReferralDetail };
    setReferral(data);
    onUpdate?.();
  }

  async function markComplete() {
    setCompleting(true);
    await fetch(`/api/v1/referrals/${referralId}/complete`, {
      method: "POST",
      credentials: "include",
    });
    setCompleting(false);
    const res = await fetch(`/api/v1/referrals/${referralId}`, { credentials: "include" });
    const { data } = await res.json() as { data: ReferralDetail };
    setReferral(data);
    onUpdate?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-4 w-40 animate-pulse bg-slate-200 rounded" />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-800">
                    {referral?.patientName ?? "Referral"}
                  </h2>
                  {referral && <ReferralStatusBadge status={referral.status} />}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{referral?.referralCode}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-slate-100 rounded-xl" />)}
            </div>
          ) : referral ? (
            <>
              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Category", value: referral.clinicalCategory ?? "—" },
                  { label: "Urgency", value: referral.urgency.replace(/_/g, " ") },
                  { label: "Type", value: referral.referralType.replace(/_/g, " ") },
                  { label: "Destination", value: referral.destinationCity ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">{label}</p>
                    <p className="text-xs text-slate-700 mt-0.5 capitalize">{value}</p>
                  </div>
                ))}
              </div>

              {referral.suspectedCondition && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Suspected Condition</p>
                  <p className="text-xs text-slate-700 mt-0.5">{referral.suspectedCondition}</p>
                </div>
              )}

              {referral.clinicalNotes && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Clinical Notes</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{referral.clinicalNotes}</p>
                </div>
              )}

              {/* Mark complete */}
              {!["completed", "cancelled", "rejected", "expired"].includes(referral.status) && (
                <button
                  type="button"
                  onClick={() => void markComplete()}
                  disabled={completing}
                  className="w-full text-sm font-semibold py-2.5 rounded-xl border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-40"
                >
                  {completing ? "Marking complete..." : "Mark as Completed"}
                </button>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Timeline</h3>
                <ReferralTimeline events={referral.events ?? []} />
              </div>

              {/* Add note */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add Note</p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Add an update or note..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={addingNote || !noteText.trim()}
                  className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition disabled:opacity-40"
                  style={{ background: "#1B8A4A" }}
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Referral not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
