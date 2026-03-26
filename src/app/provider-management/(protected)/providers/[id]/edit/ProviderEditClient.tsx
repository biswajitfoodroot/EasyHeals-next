"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  isActive: boolean;
  verified: boolean;
  packageTier: string;
  regStatus: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine1: string | null;
};

export default function ProviderEditClient({ hospital }: { hospital: Hospital }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: hospital.name,
    city: hospital.city,
    state: hospital.state ?? "",
    phone: hospital.phone ?? "",
    email: hospital.email ?? "",
    website: hospital.website ?? "",
    description: hospital.description ?? "",
    isActive: hospital.isActive,
    verified: hospital.verified,
    packageTier: hospital.packageTier,
    regStatus: hospital.regStatus,
    contactPerson: hospital.contactPerson ?? "",
    contactPhone: hospital.contactPhone ?? "",
    contactEmail: hospital.contactEmail ?? "",
    addressLine1: hospital.addressLine1 ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/provider-management/providers/${hospital.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          state: form.state || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          description: form.description || null,
          isActive: form.isActive,
          verified: form.verified,
          packageTier: form.packageTier,
          regStatus: form.regStatus,
          contactPerson: form.contactPerson || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          addressLine1: form.addressLine1 || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof typeof form, type: "text" | "email" | "url" | "textarea" = "text") {
    const value = form[key] as string;
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
        {type === "textarea" ? (
          <textarea rows={3} value={value} onChange={onChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
        ) : (
          <input type={type} value={value} onChange={onChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <a href="/provider-management/providers"
          className="text-xs text-indigo-600 hover:underline font-medium">&larr; Back to Providers</a>
        <h1 className="text-xl font-bold text-slate-800 mt-2">Edit Provider</h1>
        <p className="text-sm text-slate-400 font-mono">{hospital.id}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">

        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Name *", "name")}
            {field("City *", "city")}
            {field("State", "state")}
            {field("Address", "addressLine1")}
            {field("Phone", "phone")}
            {field("Email", "email", "email")}
            {field("Website", "website", "url")}
          </div>
          <div className="sm:col-span-2">
            {field("Description", "description", "textarea")}
          </div>
        </div>

        {/* Contact person */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Contact Person</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {field("Name", "contactPerson")}
            {field("Phone", "contactPhone")}
            {field("Email", "contactEmail", "email")}
          </div>
        </div>

        {/* Status & flags */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Status & Tier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Package Tier</label>
              <select value={form.packageTier}
                onChange={(e) => setForm((f) => ({ ...f, packageTier: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Reg Status</label>
              <select value={form.regStatus}
                onChange={(e) => setForm((f) => ({ ...f, regStatus: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.verified}
                onChange={(e) => setForm((f) => ({ ...f, verified: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
              <span className="text-sm font-medium text-slate-700">Verified</span>
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">Saved successfully.</p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <a href="/provider-management/providers"
            className="px-5 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
