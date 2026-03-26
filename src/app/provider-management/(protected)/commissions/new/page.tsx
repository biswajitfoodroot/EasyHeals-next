"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface Agreement {
  id: string;
  hospitalName: string | null;
  doctorName: string | null;
  entityType: string;
  tierCode: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
}

export default function NewCommissionPage() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    agreementId: "",
    amountPaise: "",
    notes: "",
    status: "pending",
  });

  useEffect(() => {
    fetch("/api/provider-management/agreements")
      .then((r) => r.json())
      .then((d) => setAgreements(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedAgreement = agreements.find((a) => a.id === form.agreementId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amountPaise = Math.round(parseFloat(form.amountPaise) * 100);
    if (!form.agreementId) { setError("Select an agreement"); return; }
    if (!form.amountPaise || isNaN(amountPaise) || amountPaise <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/provider-management/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amountPaise }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      router.push("/provider-management/commissions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <a href="/provider-management/commissions"
          className="text-xs text-indigo-600 hover:underline font-medium">
          &larr; Back to Commissions
        </a>
        <h1 className="text-xl font-bold text-slate-800 mt-2">Log Commission Entry</h1>
        <p className="text-sm text-slate-400">Record a new per-case commission for an agreement.</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

        {/* Agreement */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Agreement *
          </label>
          {loading ? (
            <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <select
              value={form.agreementId}
              onChange={(e) => setForm({ ...form, agreementId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">Select agreement…</option>
              {agreements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.entityType === "hospital" ? a.hospitalName : a.doctorName}
                  {a.tierCode ? ` [${a.tierCode}]` : ""}
                  {a.commissionPercent ? ` — ${a.commissionPercent}%` : ""}
                  {a.commissionFlat ? ` — ₹${(a.commissionFlat / 100).toLocaleString("en-IN")} flat` : ""}
                </option>
              ))}
            </select>
          )}
          {selectedAgreement && (
            <p className="mt-1 text-xs text-slate-400">
              {selectedAgreement.entityType === "hospital" ? "Hospital" : "Doctor"} agreement
              {selectedAgreement.commissionPercent
                ? ` · ${selectedAgreement.commissionPercent}% commission`
                : selectedAgreement.commissionFlat
                ? ` · ₹${(selectedAgreement.commissionFlat / 100).toLocaleString("en-IN")} flat per case`
                : ""}
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Amount (INR) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">₹</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amountPaise}
              onChange={(e) => setForm({ ...form, amountPaise: e.target.value })}
              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Initial Status
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            rows={3}
            placeholder="Case details, patient reference, procedure…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
            {saving ? "Saving…" : "Log Commission"}
          </button>
          <a href="/provider-management/commissions"
            className="px-5 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
