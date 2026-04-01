"use client";

import { useState, FormEvent } from "react";

type Profile = {
  id: string;
  beneficiaryName: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  upiId: string | null;
  panNumber: string | null;
  status: string;
  verifiedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
} | null;

type Props = {
  entityId: string;
  entityType: string;
  profile: Profile;
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  verified:  "bg-blue-50 text-blue-700 border-blue-200",
  active:    "bg-green-50 text-green-700 border-green-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

export default function PayoutProfileClient({ entityId, entityType, profile: initial }: Props) {
  const [profile, setProfile] = useState<Profile>(initial);
  const [editing, setEditing] = useState(!initial);
  const [form, setForm] = useState({
    beneficiaryName: initial?.beneficiaryName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    ifscCode: initial?.ifscCode ?? "",
    upiId: initial?.upiId ?? "",
    panNumber: initial?.panNumber ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/v1/payouts/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, entityId, entityType }),
      });
      const j = await res.json() as { error?: string; data?: Profile };
      if (!res.ok) { setMsg({ type: "err", text: j.error ?? "Failed to save" }); return; }
      setMsg({ type: "ok", text: "Payout profile saved. EasyHeals team will verify your details." });
      if (j.data) setProfile(j.data);
      setEditing(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {/* Status card */}
      {profile && !editing && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[profile.status] ?? STATUS_COLOR.pending}`}>
              {profile.status === "active" ? "Verified & Active" : profile.status === "verified" ? "Verification Complete" : profile.status === "pending" ? "Pending Verification" : profile.status}
            </span>
            <button type="button" onClick={() => setEditing(true)}
              className="text-sm font-semibold text-indigo-600 hover:underline">Edit</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: "Beneficiary Name", value: profile.beneficiaryName },
              { label: "Bank Account", value: profile.bankAccountNumber ? `****${profile.bankAccountNumber.slice(-4)}` : null },
              { label: "IFSC Code", value: profile.ifscCode },
              { label: "UPI ID", value: profile.upiId },
              { label: "PAN", value: profile.panNumber ? `${profile.panNumber.slice(0,3)}***${profile.panNumber.slice(-2)}` : null },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-slate-400 font-medium">{f.label}</p>
                <p className="text-slate-800 font-medium mt-0.5">{f.value ?? <span className="text-slate-300">—</span>}</p>
              </div>
            ))}
          </div>

          {profile.status === "pending" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Your payout details are under review. EasyHeals team will verify and activate within 2–3 business days.
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-700">
            {initial ? "Update Payout Details" : "Set Up Payout Details"}
          </h3>
          <p className="text-xs text-slate-400">
            Your details are used only for commission payouts. Bank account and PAN are stored securely.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "beneficiaryName", label: "Beneficiary Name *", placeholder: "As on bank account" },
              { key: "bankAccountNumber", label: "Bank Account Number", placeholder: "Account number" },
              { key: "ifscCode", label: "IFSC Code", placeholder: "e.g. SBIN0001234" },
              { key: "upiId", label: "UPI ID", placeholder: "name@upi" },
              { key: "panNumber", label: "PAN Number", placeholder: "ABCDE1234F" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
                <input
                  value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  required={f.key === "beneficiaryName"}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            ))}
          </div>

          {msg && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${msg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {msg.text}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition"
              style={{ background: "#1B8A4A" }}>
              {saving ? "Saving..." : "Save Payout Details"}
            </button>
            {initial && (
              <button type="button" onClick={() => { setEditing(false); setMsg(null); }}
                className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-xl hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Info box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">How payouts work</p>
        <p>Commission entries are posted by EasyHeals after a referral case closes per your agreement terms.</p>
        <p>Once confirmed and locked (15-day cooldown), the amount is included in the next payout batch.</p>
        <p>You will be notified via WhatsApp/SMS when a payout is processed.</p>
      </div>
    </div>
  );
}
