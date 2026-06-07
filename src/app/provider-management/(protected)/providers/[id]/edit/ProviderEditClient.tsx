"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type DaySchedule = { open: string; close: string; closed: boolean; open24h: boolean };

type WorkingHours = Record<DayKey, DaySchedule>;

type Hospital = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  phone: string | null;
  phones: string[] | null;
  email: string | null;
  emailIds: string[] | null;
  website: string | null;
  whatsappBusinessNumber: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine1: string | null;
  city: string;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  specialties: string[] | null;
  facilities: string[] | null;
  accreditations: string[] | null;
  workingHours: Record<string, unknown> | null;
  feesRange: Record<string, unknown> | null;
  slotDurationMinutes: number | null;
  maxDailyAppointments: number | null;
  queueEnabled: boolean | null;
  isActive: boolean;
  isPrivate: boolean;
  verified: boolean;
  packageTier: string;
  regStatus: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const DAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

const MANAGER_ROLES = ["owner", "admin", "admin_manager"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function parseWorkingHours(raw: Record<string, unknown> | null): WorkingHours {
  const defaults: WorkingHours = Object.fromEntries(
    DAYS.map((d) => [d, { open: "09:00", close: "21:00", closed: false, open24h: false }]),
  ) as WorkingHours;

  if (!raw || typeof raw !== "object") return defaults;

  const result = { ...defaults };
  for (const day of DAYS) {
    const val = raw[day];
    if (val === undefined || val === null) continue;
    if (typeof val === "string") {
      const norm = val.toLowerCase();
      if (norm === "open24h" || norm === "24h" || norm === "24/7") {
        result[day] = { open: "00:00", close: "00:00", closed: false, open24h: true };
      } else {
        result[day] = { open: "09:00", close: "21:00", closed: norm === "closed", open24h: false };
      }
    } else if (typeof val === "object" && !Array.isArray(val)) {
      const v = val as { open?: string; close?: string; closed?: boolean; open24h?: boolean };
      const is24h = v.open24h === true || (v.open === "00:00" && v.close === "00:00");
      result[day] = {
        open: is24h ? "00:00" : (v.open ?? "09:00"),
        close: is24h ? "00:00" : (v.close ?? "21:00"),
        closed: v.closed ?? false,
        open24h: is24h,
      };
    }
  }
  return result;
}

function serializeWorkingHours(wh: WorkingHours): Record<string, unknown> {
  return Object.fromEntries(
    DAYS.map((day) => {
      const s = wh[day];
      if (s.closed) return [day, "closed"];
      if (s.open24h) return [day, "open24h"];
      return [day, { open: s.open, close: s.close }];
    }),
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-bold text-slate-700 tracking-wide uppercase">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white transition-colors disabled:bg-slate-50 disabled:text-slate-400";
const textareaCls = `${inputCls} resize-none`;

function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter",
  disabled = false,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const trimmed = input.trim().replace(/,$/, "").trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div
      className={`flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl bg-white min-h-[44px] transition-colors ${disabled ? "bg-slate-50" : "focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-400"}`}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-800"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="text-indigo-400 hover:text-indigo-700 leading-none ml-0.5 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={tags.length === 0 ? placeholder : "Add more…"}
          className="flex-1 min-w-[160px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  colorOn = "bg-indigo-500",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  colorOn?: string;
}) {
  return (
    <div className="relative inline-block">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`w-9 h-5 bg-slate-200 peer-checked:${colorOn} rounded-full transition-colors peer-disabled:opacity-40`} />
      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4 peer-disabled:opacity-40" />
    </div>
  );
}

function WorkingHoursEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: WorkingHours;
  onChange: (wh: WorkingHours) => void;
  disabled?: boolean;
}) {
  function setDay(day: DayKey, patch: Partial<DaySchedule>) {
    onChange({ ...value, [day]: { ...value[day], ...patch } });
  }

  function setAll24x7() {
    const all = Object.fromEntries(
      DAYS.map((d) => [d, { open: "00:00", close: "00:00", closed: false, open24h: true }]),
    ) as WorkingHours;
    onChange(all);
  }

  function applyMonToAll() {
    const template = value.monday;
    const all = Object.fromEntries(DAYS.map((d) => [d, { ...template }])) as WorkingHours;
    onChange(all);
  }

  function clearAll24h() {
    const updated = Object.fromEntries(
      DAYS.map((d) => [d, { ...value[d], open24h: false, open: "09:00", close: "21:00" }]),
    ) as WorkingHours;
    onChange(updated);
  }

  const is247 = DAYS.every((d) => value[d].open24h);

  return (
    <div className="space-y-3">

      {/* Quick presets */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Presets:</span>
          <button
            type="button"
            onClick={setAll24x7}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
              is247
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {is247 ? "✓ 24/7 Active" : "Set all 24/7"}
          </button>
          {is247 && (
            <button
              type="button"
              onClick={clearAll24h}
              className="px-3 py-1 text-xs font-semibold rounded-lg border bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
            >
              Clear 24/7
            </button>
          )}
          {!is247 && (
            <button
              type="button"
              onClick={applyMonToAll}
              className="px-3 py-1 text-xs font-semibold rounded-lg border bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
            >
              Copy Mon to all days
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold w-28">Day</th>
              <th className="text-left px-3 py-2.5 font-semibold w-24">Open</th>
              <th className="text-left px-3 py-2.5 font-semibold w-24">
                <span title="Open 24 hours — no closing time">24 hrs</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold">Opens at</th>
              <th className="text-left px-3 py-2.5 font-semibold">Closes at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DAYS.map((day) => {
              const s = value[day];
              const timesDisabled = disabled || s.closed || s.open24h;
              return (
                <tr key={day} className={s.closed ? "bg-slate-50/60" : s.open24h ? "bg-emerald-50/40" : ""}>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 w-28">{DAY_LABELS[day]}</td>

                  {/* Open/Closed toggle */}
                  <td className="px-3 py-2.5 w-24">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Toggle
                        checked={!s.closed}
                        disabled={disabled}
                        onChange={(v) => setDay(day, { closed: !v, open24h: !v ? false : s.open24h })}
                      />
                      <span className={`text-xs font-medium ${s.closed ? "text-slate-400" : "text-indigo-600"}`}>
                        {s.closed ? "Closed" : "Open"}
                      </span>
                    </label>
                  </td>

                  {/* 24h toggle */}
                  <td className="px-3 py-2.5 w-24">
                    <label className={`flex items-center gap-2 cursor-pointer select-none ${s.closed ? "opacity-40 pointer-events-none" : ""}`}>
                      <Toggle
                        checked={s.open24h}
                        disabled={disabled || s.closed}
                        colorOn="bg-emerald-500"
                        onChange={(v) => setDay(day, { open24h: v })}
                      />
                      {s.open24h && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">24h</span>
                      )}
                    </label>
                  </td>

                  {/* Time inputs */}
                  <td className="px-3 py-2.5">
                    {s.open24h && !s.closed ? (
                      <span className="text-xs text-emerald-600 font-medium">Open 24 hours</span>
                    ) : (
                      <input
                        type="time"
                        value={s.open}
                        disabled={timesDisabled}
                        onChange={(e) => setDay(day, { open: e.target.value })}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-300 w-28"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {!s.open24h && !s.closed && (
                      <input
                        type="time"
                        value={s.close}
                        disabled={timesDisabled}
                        onChange={(e) => setDay(day, { close: e.target.value })}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-300 w-28"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  type: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  whatsappBusinessNumber: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  specialties: string[];
  facilities: string[];
  accreditations: string[];
  workingHours: WorkingHours;
  slotDurationMinutes: string;
  maxDailyAppointments: string;
  queueEnabled: boolean;
  isActive: boolean;
  isPrivate: boolean;
  verified: boolean;
  packageTier: string;
  regStatus: string;
};

function buildInitialForm(h: Hospital): FormState {
  return {
    name: h.name,
    type: h.type ?? "hospital",
    description: h.description ?? "",
    phone: h.phone ?? "",
    email: h.email ?? "",
    website: h.website ?? "",
    whatsappBusinessNumber: h.whatsappBusinessNumber ?? "",
    contactPerson: h.contactPerson ?? "",
    contactPhone: h.contactPhone ?? "",
    contactEmail: h.contactEmail ?? "",
    addressLine1: h.addressLine1 ?? "",
    city: h.city,
    state: h.state ?? "",
    country: h.country ?? "India",
    latitude: h.latitude != null ? String(h.latitude) : "",
    longitude: h.longitude != null ? String(h.longitude) : "",
    specialties: safeArray(h.specialties),
    facilities: safeArray(h.facilities),
    accreditations: safeArray(h.accreditations),
    workingHours: parseWorkingHours(h.workingHours),
    slotDurationMinutes: h.slotDurationMinutes != null ? String(h.slotDurationMinutes) : "15",
    maxDailyAppointments: h.maxDailyAppointments != null ? String(h.maxDailyAppointments) : "",
    queueEnabled: h.queueEnabled ?? false,
    isActive: h.isActive,
    isPrivate: h.isPrivate,
    verified: h.verified,
    packageTier: h.packageTier ?? "free",
    regStatus: h.regStatus ?? "pending",
  };
}

export default function ProviderEditClient({
  hospital,
  userRole,
}: {
  hospital: Hospital;
  userRole: string;
}) {
  const isManager = MANAGER_ROLES.includes(userRole);
  const initialFormRef = useRef<FormState>(buildInitialForm(hospital));
  const [form, setForm] = useState<FormState>(initialFormRef.current);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Track dirty state
  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialFormRef.current));
  }, [form]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  function resetForm() {
    setForm(initialFormRef.current);
    setSaveResult(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveResult(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      description: form.description || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      whatsappBusinessNumber: form.whatsappBusinessNumber || null,
      contactPerson: form.contactPerson || null,
      contactPhone: form.contactPhone || null,
      contactEmail: form.contactEmail || null,
      addressLine1: form.addressLine1 || null,
      city: form.city,
      state: form.state || null,
      country: form.country || "India",
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      specialties: form.specialties,
      facilities: form.facilities,
      accreditations: form.accreditations,
      workingHours: serializeWorkingHours(form.workingHours),
      slotDurationMinutes: form.slotDurationMinutes ? parseInt(form.slotDurationMinutes, 10) : null,
      maxDailyAppointments: form.maxDailyAppointments ? parseInt(form.maxDailyAppointments, 10) : null,
      queueEnabled: form.queueEnabled,
    };

    if (isManager) {
      payload.isActive = form.isActive;
      payload.isPrivate = form.isPrivate;
      payload.verified = form.verified;
      payload.packageTier = form.packageTier;
      payload.regStatus = form.regStatus;
    }

    try {
      const res = await fetch(`/api/provider-management/providers/${hospital.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string; details?: unknown };
      if (!res.ok) {
        setSaveResult({ ok: false, msg: data.error ?? "Failed to save changes." });
      } else {
        // Update baseline so dirty state resets
        initialFormRef.current = { ...form };
        setIsDirty(false);
        setSaveResult({ ok: true, msg: "Changes saved successfully." });
        setTimeout(() => setSaveResult(null), 4000);
      }
    } catch {
      setSaveResult({ ok: false, msg: "Network error — please try again." });
    } finally {
      setSaving(false);
    }
  }

  const updatedAt = hospital.updatedAt
    ? new Date(hospital.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-32 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <a
            href="/provider-management/providers"
            className="text-xs text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
          >
            ← Back to Providers
          </a>
          <h1 className="text-xl font-bold text-slate-800 mt-1">{hospital.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-mono flex-wrap">
            <span>{hospital.id}</span>
            <span>·</span>
            <span>{hospital.slug}</span>
            {updatedAt && <><span>·</span><span>Last saved {updatedAt}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/hospitals/${hospital.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all bg-white"
          >
            View profile ↗
          </a>
          {isDirty && (
            <span className="px-2.5 py-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-medium animate-pulse">
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">

        {/* ── 1. Overview ── */}
        <SectionCard title="Overview" icon="🏥">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Hospital Name *">
              <input
                required
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Full hospital / clinic name"
              />
            </Field>
            <Field label="Facility Type">
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="nursing_home">Nursing Home</option>
                <option value="diagnostic_centre">Diagnostic Centre</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description / About" hint="Public-facing overview shown on the profile page.">
                <textarea
                  rows={4}
                  className={textareaCls}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Brief overview of the hospital, its history, key strengths…"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ── 2. Contact Details ── */}
        <SectionCard title="Contact Details" icon="📞">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary Phone">
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 XXXXX XXXXX"
              />
            </Field>
            <Field label="Primary Email">
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="info@hospital.com"
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                className={inputCls}
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://www.hospital.com"
              />
            </Field>
            <Field label="WhatsApp Business Number">
              <input
                className={inputCls}
                value={form.whatsappBusinessNumber}
                onChange={(e) => set("whatsappBusinessNumber", e.target.value)}
                placeholder="+91 XXXXX XXXXX"
              />
            </Field>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact Person</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={form.contactPerson}
                  onChange={(e) => set("contactPerson", e.target.value)}
                  placeholder="Contact name"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputCls}
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  placeholder="contact@hospital.com"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ── 3. Location ── */}
        <SectionCard title="Location" icon="📍">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Address Line 1">
                <input
                  className={inputCls}
                  value={form.addressLine1}
                  onChange={(e) => set("addressLine1", e.target.value)}
                  placeholder="Street address, building, landmark…"
                />
              </Field>
            </div>
            <Field label="City *">
              <input
                required
                className={inputCls}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="City"
              />
            </Field>
            <Field label="State">
              <input
                className={inputCls}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="State"
              />
            </Field>
            <Field label="Country">
              <input
                className={inputCls}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="India"
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">GPS Coordinates</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" hint="e.g. 19.0760">
                  <input
                    type="number"
                    step="0.000001"
                    min="-90"
                    max="90"
                    className={inputCls}
                    value={form.latitude}
                    onChange={(e) => set("latitude", e.target.value)}
                    placeholder="19.0760"
                  />
                </Field>
                <Field label="Longitude" hint="e.g. 72.8777">
                  <input
                    type="number"
                    step="0.000001"
                    min="-180"
                    max="180"
                    className={inputCls}
                    value={form.longitude}
                    onChange={(e) => set("longitude", e.target.value)}
                    placeholder="72.8777"
                  />
                </Field>
              </div>
              {form.latitude && form.longitude && (
                <a
                  href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  Verify on Google Maps ↗
                </a>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── 4. Medical Profile ── */}
        <SectionCard title="Medical Profile" icon="🩺">
          <div className="space-y-5">
            <Field
              label="Specialties"
              hint="Type a specialty and press Enter. E.g. Cardiology, Orthopaedics, Neurology…"
            >
              <TagInput
                tags={form.specialties}
                onChange={(v) => set("specialties", v)}
                placeholder="Add specialty and press Enter"
              />
            </Field>
            <Field
              label="Facilities & Amenities"
              hint="E.g. ICU, Blood Bank, Pharmacy, Radiology, Physiotherapy…"
            >
              <TagInput
                tags={form.facilities}
                onChange={(v) => set("facilities", v)}
                placeholder="Add facility and press Enter"
              />
            </Field>
            <Field
              label="Accreditations & Certifications"
              hint="E.g. NABH, JCI, ISO 9001, NABL…"
            >
              <TagInput
                tags={form.accreditations}
                onChange={(v) => set("accreditations", v)}
                placeholder="Add accreditation and press Enter"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── 5. Operating Hours ── */}
        <SectionCard title="Operating Hours" icon="🕐">
          <WorkingHoursEditor
            value={form.workingHours}
            onChange={(wh) => set("workingHours", wh)}
          />
        </SectionCard>

        {/* ── 6. Operational Settings ── */}
        <SectionCard title="Operational Settings" icon="⚙️">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Slot Duration (minutes)" hint="Appointment slot length">
              <input
                type="number"
                min="1"
                max="480"
                step="5"
                className={inputCls}
                value={form.slotDurationMinutes}
                onChange={(e) => set("slotDurationMinutes", e.target.value)}
                placeholder="15"
              />
            </Field>
            <Field label="Max Daily Appointments" hint="Leave blank for no limit">
              <input
                type="number"
                min="1"
                className={inputCls}
                value={form.maxDailyAppointments}
                onChange={(e) => set("maxDailyAppointments", e.target.value)}
                placeholder="Unlimited"
              />
            </Field>
            <Field label="Queue System">
              <label className="flex items-center gap-3 h-[38px] cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={form.queueEnabled}
                    onChange={(e) => set("queueEnabled", e.target.checked)}
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-checked:bg-indigo-500 rounded-full transition-colors" />
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {form.queueEnabled ? "Enabled" : "Disabled"}
                </span>
              </label>
            </Field>
          </div>
        </SectionCard>

        {/* ── 7. Status & Visibility (manager only) ── */}
        <SectionCard title="Status & Visibility" icon="🔒">
          {!isManager ? (
            <p className="text-sm text-slate-400 italic">
              Status, visibility, and tier changes require the <strong>admin_manager</strong> role or above.
              Contact an administrator to update these fields.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(
                  [
                    { key: "isActive" as const, label: "Active", desc: "Listing is live on the platform" },
                    { key: "isPrivate" as const, label: "Listed", desc: "Appears in public directory" },
                    { key: "verified" as const, label: "Verified", desc: "Shows the verified badge" },
                    { key: "queueEnabled" as const, label: "Queue", desc: "Appointment queue active" },
                  ] as const
                ).map(({ key, label, desc }) => (
                  <label key={key} className="flex flex-col gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors bg-slate-50/50">
                    <div className="relative self-start">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={form[key]}
                        onChange={(e) => set(key, e.target.checked)}
                      />
                      <div className="w-10 h-6 bg-slate-200 peer-checked:bg-indigo-500 rounded-full transition-colors" />
                      <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Field label="Package Tier">
                  <select
                    className={inputCls}
                    value={form.packageTier}
                    onChange={(e) => set("packageTier", e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </Field>
                <Field label="Registration Status">
                  <select
                    className={inputCls}
                    value={form.regStatus}
                    onChange={(e) => set("regStatus", e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Save result inline ── */}
        {saveResult && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              saveResult.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span>{saveResult.ok ? "✓" : "✕"}</span>
            {saveResult.msg}
          </div>
        )}
      </form>

      {/* ── Sticky Save Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                You have unsaved changes
              </span>
            ) : (
              <span className="text-slate-400">All changes saved</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={!isDirty || saving}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="submit"
              form=""
              onClick={(e) => { e.preventDefault(); void handleSave(e as unknown as React.FormEvent); }}
              disabled={saving || !isDirty}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
