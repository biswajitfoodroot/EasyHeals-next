"use client";

import { useState } from "react";

type Plan = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  isActive: boolean;
  features: string[];
};

const FEATURE_SUGGESTIONS = [
  "basic_listing",
  "appointment_booking",
  "opd_queue",
  "patient_records",
  "whatsapp_reminders",
  "smart_queue_eta",
  "ai_daily_summary",
  "digital_rx",
  "referral_earnings_dashboard",
  "auto_followup",
  "broadcast_messaging",
  "multi_doctor_management",
  "advanced_analytics",
  "custom_integrations",
  "dedicated_support",
  "sla_guarantee",
];

function formatFeatureLabel(key: string) {
  return key.replace(/_/g, " ");
}

function PlanCard({
  plan,
  onUpdate,
  onDelete,
  canDelete,
}: {
  plan: Plan;
  onUpdate: (id: string, updates: Partial<Plan> & { features?: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: plan.name,
    monthlyPrice: (plan.monthlyPrice).toFixed(0),
    features: [...plan.features],
    isActive: plan.isActive,
  });
  const [newFeature, setNewFeature] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    await onUpdate(plan.id, {
      name: form.name,
      monthlyPrice: parseFloat(form.monthlyPrice) || 0,
      features: form.features,
      isActive: form.isActive,
    });
    setSaving(false);
    setEditing(false);
  }

  function addFeature(key: string) {
    const k = key.toLowerCase().replace(/\s+/g, "_").trim();
    if (k && !form.features.includes(k)) {
      setForm((f) => ({ ...f, features: [...f.features, k] }));
    }
    setNewFeature("");
  }

  function removeFeature(key: string) {
    setForm((f) => ({ ...f, features: f.features.filter((x) => x !== key) }));
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${plan.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 ${!plan.isActive ? "bg-slate-50" : ""}`}>
        <div className="min-w-0">
          {editing ? (
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="text-base font-bold text-slate-800 border-b border-indigo-400 outline-none bg-transparent w-full" />
          ) : (
            <h3 className="text-base font-bold text-slate-800">{plan.name}</h3>
          )}
          <p className="text-xs text-slate-400 font-mono mt-0.5">{plan.code}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!plan.isActive && (
            <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
          )}
          <button onClick={() => setEditing(!editing)}
            className="text-xs font-semibold text-indigo-600 hover:underline">
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="px-5 pt-4 pb-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-400">₹</span>
            <input type="number" min="0" step="1"
              value={form.monthlyPrice}
              onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
              className="text-2xl font-bold text-indigo-700 w-28 border-b border-indigo-400 outline-none bg-transparent" />
            <span className="text-sm text-slate-500">/mo</span>
          </div>
        ) : (
          <p className="text-2xl font-bold text-indigo-700">
            {plan.monthlyPrice === 0 ? (
              <span className="text-green-600">Free</span>
            ) : (
              <>₹{plan.monthlyPrice.toLocaleString("en-IN")}<span className="text-sm font-normal text-slate-500">/mo</span></>
            )}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="px-5 pb-4 space-y-1.5">
        {form.features.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="text-green-500 text-sm">✓</span>
            <span className="text-sm text-slate-600">{formatFeatureLabel(f)}</span>
            {editing && (
              <button onClick={() => removeFeature(f)}
                className="ml-auto text-xs text-red-400 hover:text-red-600">✕</button>
            )}
          </div>
        ))}

        {editing && (
          <div className="pt-2 space-y-2">
            <div className="flex gap-2">
              <input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(newFeature); } }}
                placeholder="feature_key or label…"
                list="feature-suggestions"
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <datalist id="feature-suggestions">
                {FEATURE_SUGGESTIONS.filter((s) => !form.features.includes(s)).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button type="button" onClick={() => addFeature(newFeature)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200">
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {FEATURE_SUGGESTIONS.filter((s) => !form.features.includes(s)).slice(0, 6).map((s) => (
                <button key={s} onClick={() => addFeature(s)}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition">
                  + {formatFeatureLabel(s)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit actions */}
      {editing && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
            <span className="text-sm text-slate-700 font-medium">Plan is active (visible to providers)</span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => void save()} disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {canDelete && (
              <button
                onClick={async () => {
                  if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
                  setDeleting(true);
                  await onDelete(plan.id);
                  setDeleting(false);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition disabled:opacity-50">
                {deleting ? "…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PackagesClient({ plans: initialPlans, canDelete }: { plans: Plan[]; canDelete: boolean }) {
  const [plans, setPlans] = useState(initialPlans);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newPlan, setNewPlan] = useState({
    code: "",
    name: "",
    monthlyPrice: "0",
    features: [] as string[],
    newFeature: "",
  });

  async function updatePlan(id: string, updates: Partial<Plan> & { features?: string[] }) {
    const res = await fetch(`/api/provider-management/packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.monthlyPrice !== undefined && { monthlyPrice: updates.monthlyPrice }),
                ...(updates.isActive !== undefined && { isActive: updates.isActive }),
                ...(updates.features !== undefined && { features: updates.features }),
              }
            : p,
        ),
      );
    }
  }

  async function deletePlan(id: string) {
    const res = await fetch(`/api/provider-management/packages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function createPlan() {
    setCreateError("");
    if (!newPlan.code || !newPlan.name) {
      setCreateError("Code and name are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/provider-management/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newPlan.code,
          name: newPlan.name,
          monthlyPrice: parseFloat(newPlan.monthlyPrice) || 0,
          features: newPlan.features,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      // Reload to get the new plan with ID
      window.location.reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create new plan */}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
          {showCreate ? "Cancel" : "+ New Plan"}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700">Create New Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Plan Code *</label>
              <input placeholder="e.g. premium" value={newPlan.code}
                onChange={(e) => setNewPlan((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
              <p className="text-xs text-slate-400 mt-0.5">Lowercase, no spaces</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Display Name *</label>
              <input placeholder="e.g. Premium" value={newPlan.name}
                onChange={(e) => setNewPlan((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Monthly Price (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                <input type="number" min="0" step="1" placeholder="0"
                  value={newPlan.monthlyPrice}
                  onChange={(e) => setNewPlan((f) => ({ ...f, monthlyPrice: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Features</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {newPlan.features.map((f) => (
                <span key={f} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-lg border border-indigo-200">
                  {formatFeatureLabel(f)}
                  <button onClick={() => setNewPlan((p) => ({ ...p, features: p.features.filter((x) => x !== f) }))}
                    className="text-indigo-400 hover:text-indigo-700">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newPlan.newFeature}
                onChange={(e) => setNewPlan((f) => ({ ...f, newFeature: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const k = newPlan.newFeature.toLowerCase().replace(/\s+/g, "_").trim();
                    if (k && !newPlan.features.includes(k)) setNewPlan((f) => ({ ...f, features: [...f.features, k], newFeature: "" }));
                  }
                }}
                placeholder="feature_key…"
                list="new-feature-suggestions"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <datalist id="new-feature-suggestions">
                {FEATURE_SUGGESTIONS.filter((s) => !newPlan.features.includes(s)).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button onClick={() => {
                const k = newPlan.newFeature.toLowerCase().replace(/\s+/g, "_").trim();
                if (k && !newPlan.features.includes(k)) setNewPlan((f) => ({ ...f, features: [...f.features, k], newFeature: "" }));
              }}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition">
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {FEATURE_SUGGESTIONS.filter((s) => !newPlan.features.includes(s)).map((s) => (
                <button key={s} onClick={() => setNewPlan((f) => ({ ...f, features: [...f.features, s] }))}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition">
                  + {formatFeatureLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {createError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createError}</p>
          )}

          <button onClick={() => void createPlan()} disabled={creating}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
            {creating ? "Creating…" : "Create Plan"}
          </button>
        </div>
      )}

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No plans yet. Click "+ New Plan" to create your first subscription plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onUpdate={updatePlan}
              onDelete={deletePlan}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
