"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Agreement = {
  id: string;
  agreementType: string;
  status: string;
  publishedAt: string | null;
  customTerms?: string | null;
  termsVersion?: string | null;
};

type Props = {
  agreement: Agreement;
  onClose: () => void;
  onAccepted?: () => void;
};

const DEFAULT_TERMS = `
EASYHEALS NETWORK PARTNERSHIP AGREEMENT

This Agreement is entered into between EasyHeals (the "Platform") and you ("Provider").

1. REFERRAL NETWORK PARTICIPATION
   By accepting this agreement, you agree to participate in the EasyHeals referral network, enabling cross-provider patient referrals and receiving commission payments for referred cases.

2. COMMISSION STRUCTURE
   Commissions are calculated on a per-case basis as determined by EasyHeals operators and communicated in individual commission entries. All amounts are in Indian Rupees (INR).

3. PROVIDER OBLIGATIONS
   - Maintain accurate and up-to-date profile information on the platform
   - Respond to incoming referrals within 24 hours
   - Provide quality care to all referred patients
   - Report outcomes accurately through the portal

4. DATA & PRIVACY
   - Patient data shared via referrals is governed by DPDP Act 2023
   - You agree not to use patient data for purposes beyond the referred care
   - All data access is logged and auditable

5. PAYMENT TERMS
   - Commission entries are confirmed by EasyHeals operators
   - Payouts are processed monthly to your registered bank account or UPI
   - Disputed entries are reviewed within 7 working days

6. TERMINATION
   Either party may terminate this agreement with 30 days written notice. Pending commissions will be settled within 60 days of termination.

7. GOVERNING LAW
   This agreement is governed by the laws of India.
`.trim();

export default function AgreementModal({ agreement, onClose, onAccepted }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terms = agreement.customTerms || DEFAULT_TERMS;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setHasScrolled(true);
  }

  // Mark scrolled if content fits without scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setHasScrolled(true);
  }, []);

  async function handleAccept() {
    setLoading("accept");
    setError(null);
    try {
      const res = await fetch(`/api/v1/agreements/${agreement.id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to accept");
        return;
      }
      onAccepted?.();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setLoading("reject");
    setError(null);
    try {
      const res = await fetch(`/api/v1/agreements/${agreement.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to reject");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-xl shrink-0">
            🤝
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800">EasyHeals Network Agreement</h2>
            <p className="text-xs text-slate-400">
              {agreement.agreementType.replace(/_/g, " ")}
              {agreement.termsVersion ? ` · v${agreement.termsVersion}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg"
          >
            ×
          </button>
        </div>

        {/* Terms scroll area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono bg-slate-50 rounded-none"
          style={{ minHeight: 200, maxHeight: 360 }}
        >
          {terms}
        </div>

        {!hasScrolled && (
          <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 text-center">
            Scroll to the bottom to enable acceptance
          </div>
        )}

        {/* Reject reason */}
        {showReject && (
          <div className="px-5 py-3 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Reason for rejection
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder="Please explain why you are rejecting this agreement..."
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        )}

        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2">
          {!showReject ? (
            <>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={loading !== null}
                className="text-xs text-slate-400 hover:text-red-500 transition px-2 py-1.5"
              >
                Reject
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleAccept}
                disabled={!hasScrolled || loading !== null}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#1B8A4A" }}
              >
                {loading === "accept" ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                Accept Agreement
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setShowReject(false); setRejectReason(""); setError(null); }}
                disabled={loading !== null}
                className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={loading !== null}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white transition-all active:scale-95 disabled:opacity-40"
              >
                {loading === "reject" ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                Confirm Rejection
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
