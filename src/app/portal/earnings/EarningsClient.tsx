"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type EarningsSummary = {
  totalPaise: number;
  pendingPaise: number;
  confirmedPaise: number;
  lockedPaise: number;
  paidPaise: number;
  disputedPaise: number;
  entryCount: number;
  pendingCount: number;
  lockedCount: number;
};

type CommissionEntry = {
  id: string;
  status: string;
  amountPaise: number;
  notes?: string | null;
  referralCaseId?: string | null;
  createdAt: string | null;
  lockedAt?: string | null;
  providerAcceptedAt?: string | null;
};

type PayoutProfile = {
  beneficiaryName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  status: string;
} | null;

type Props = {
  userRole: string;
  entityId: string;
};

function formatINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-slate-100 text-slate-500",
  confirmed: "bg-blue-50 text-blue-600",
  locked:    "bg-amber-50 text-amber-700",
  paid:      "bg-emerald-100 text-emerald-800",
  disputed:  "bg-red-50 text-red-600",
  reversed:  "bg-slate-100 text-slate-400",
};

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? "text-white" : "bg-white border border-slate-200"}`}
      style={accent ? { background: "#1B8A4A" } : {}}>
      <p className={`text-xs font-medium ${accent ? "text-emerald-100" : "text-slate-400"}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-white" : "text-slate-800"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${accent ? "text-emerald-200" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-14 animate-pulse bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}

export default function EarningsClient({ userRole, entityId }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile>(null);
  const [loading, setLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, payoutRes] = await Promise.all([
        fetch("/api/v1/commissions/summary", { credentials: "include" }),
        fetch("/api/v1/payouts/me", { credentials: "include" }),
      ]);

      if (summaryRes.ok) {
        const { data } = await summaryRes.json() as { data: EarningsSummary };
        setSummary(data);
      }
      if (payoutRes.ok) {
        const { data } = await payoutRes.json() as { data: { entries: CommissionEntry[]; payoutProfile: PayoutProfile } };
        setEntries(data.entries ?? []);
        setPayoutProfile(data.payoutProfile);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function raiseDispute(entryId: string) {
    const reason = prompt("Please describe the reason for your dispute:");
    if (!reason?.trim()) return;
    const res = await fetch("/api/v1/commissions/disputes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, reason }),
    });
    if (res.ok) void load();
  }

  async function acceptEntry(entryId: string) {
    await fetch(`/api/v1/commissions/entries/${entryId}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "provider_accept" }),
    });
    void load();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Earnings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Commission ledger from EasyHeals referrals</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPayoutForm(true)}
          className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition"
        >
          {payoutProfile ? "Update Payout Details" : "Set Payout Details"}
        </button>
      </div>

      {/* Payout profile status */}
      {payoutProfile && (
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
          payoutProfile.status === "active"
            ? "bg-emerald-50 border-emerald-200"
            : payoutProfile.status === "pending"
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-200"
        }`}>
          <span className="text-xl">
            {payoutProfile.status === "active" ? "✅" : payoutProfile.status === "pending" ? "⏳" : "⚠️"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700">Payout Profile</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {payoutProfile.status === "active"
                ? `Verified · ${payoutProfile.upiId ?? payoutProfile.bankAccountNumber ?? "—"}`
                : payoutProfile.status === "pending"
                ? "Under verification by EasyHeals team"
                : "Suspended — contact support"}
            </p>
          </div>
        </div>
      )}

      {!payoutProfile && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">💳</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800">Set up payout details to receive commissions</p>
            <p className="text-xs text-amber-600 mt-0.5">Add your bank account or UPI ID to get paid.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPayoutForm(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ background: "#1B8A4A" }}
          >
            Set up
          </button>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Total Earned"
            value={formatINR(summary.totalPaise)}
            sub={`${summary.entryCount} entries`}
            accent
          />
          <SummaryCard
            label="Pending Payout"
            value={formatINR(summary.lockedPaise)}
            sub={`${summary.lockedCount} locked`}
          />
          <SummaryCard
            label="Awaiting Confirmation"
            value={formatINR(summary.pendingPaise + summary.confirmedPaise)}
            sub={`${summary.pendingCount} pending`}
          />
          <SummaryCard
            label="Paid Out"
            value={formatINR(summary.paidPaise)}
          />
        </div>
      )}

      {/* Entry table */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Commission Entries</h2>
        {loading ? (
          <Skeleton />
        ) : entries.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">💸</p>
            <p className="text-sm font-semibold text-slate-600">No commission entries yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Commission entries are created by EasyHeals operators after case completion.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">
                      {formatINR(entry.amountPaise)}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[entry.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {entry.status}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.notes}</p>
                  )}
                  <p className="text-[10px] text-slate-300 mt-1">
                    {entry.createdAt
                      ? new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {entry.status === "locked" && !entry.providerAcceptedAt && (
                    <button
                      type="button"
                      onClick={() => void acceptEntry(entry.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
                      style={{ background: "#1B8A4A" }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {["confirmed", "locked"].includes(entry.status) && (
                    <button
                      type="button"
                      onClick={() => void raiseDispute(entry.id)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      Dispute
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPayoutForm && (
        <PayoutProfileForm
          existing={payoutProfile}
          onClose={() => setShowPayoutForm(false)}
          onSaved={() => { setShowPayoutForm(false); void load(); }}
        />
      )}
    </div>
  );
}

// ── Payout Profile Form ────────────────────────────────────────────────────────

function PayoutProfileForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: PayoutProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    beneficiaryName: existing?.beneficiaryName ?? "",
    bankAccountNumber: "",
    ifscCode: existing?.ifscCode ?? "",
    upiId: existing?.upiId ?? "",
    panNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/payouts/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-base font-bold text-slate-800">Payout Details</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
        </div>

        {[
          { key: "beneficiaryName", label: "Beneficiary Name", type: "text", placeholder: "Name on bank account" },
          { key: "bankAccountNumber", label: "Bank Account Number", type: "text", placeholder: "Leave blank to keep existing" },
          { key: "ifscCode", label: "IFSC Code", type: "text", placeholder: "e.g. SBIN0001234" },
          { key: "upiId", label: "UPI ID", type: "text", placeholder: "e.g. name@bank" },
          { key: "panNumber", label: "PAN Number", type: "text", placeholder: "Leave blank to keep existing" },
        ].map(({ key, label, type, placeholder }) => (
          <label key={key} className="block">
            <span className="text-xs font-medium text-slate-600">{label}</span>
            <input
              type={type}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </label>
        ))}

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-700">
            Your payout details will be verified by the EasyHeals team before enabling payouts.
            Account numbers and PAN are encrypted.
          </p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition disabled:opacity-40"
            style={{ background: "#1B8A4A" }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
