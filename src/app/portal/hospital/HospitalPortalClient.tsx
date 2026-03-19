"use client";

import { useState, FormEvent } from "react";

type HospitalData = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  description?: string | null;
  workingHours?: Record<string, unknown> | null;
  specialties?: string[] | null;
  facilities?: string[] | null;
  [key: string]: unknown;
};

type Props = {
  hospital: Record<string, unknown>;
  welcome?: boolean;
};

export default function HospitalPortalClient({ hospital: initialHospital, welcome = false }: Props) {
  const hospital = initialHospital as HospitalData;
  const [showWelcome, setShowWelcome] = useState(welcome);

  const [phone, setPhone] = useState(hospital.phone ?? "");
  const [email, setEmail] = useState(hospital.email ?? "");
  const [website, setWebsite] = useState(hospital.website ?? "");
  const [addressLine1, setAddressLine1] = useState(hospital.addressLine1 ?? "");
  const [description, setDescription] = useState(hospital.description ?? "");
  const [workingHoursText, setWorkingHoursText] = useState(
    hospital.workingHours ? JSON.stringify(hospital.workingHours, null, 2) : ""
  );
  const [specialtiesText, setSpecialtiesText] = useState(
    (hospital.specialties ?? []).join(", ")
  );
  const [facilitiesText, setFacilitiesText] = useState(
    (hospital.facilities ?? []).join(", ")
  );

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    let workingHours: Record<string, unknown> | null = null;
    if (workingHoursText.trim()) {
      try {
        workingHours = JSON.parse(workingHoursText) as Record<string, unknown>;
      } catch {
        setMsg({ type: "error", text: "Working hours must be valid JSON." });
        setBusy(false);
        return;
      }
    }

    const specialties = specialtiesText.split(",").map((s) => s.trim()).filter(Boolean);
    const facilities = facilitiesText.split(",").map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/portal/hospital", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          email: email || null,
          website: website || null,
          addressLine1: addressLine1 || null,
          description: description || null,
          workingHours,
          specialties,
          facilities,
        }),
      });

      const json = await res.json() as { error?: string };

      if (!res.ok) {
        setMsg({ type: "error", text: json.error ?? "Update failed" });
      } else {
        setMsg({ type: "success", text: "Profile updated successfully!" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        {showWelcome && (
          <div className="mb-5 flex items-start gap-3 px-5 py-4 rounded-2xl bg-teal-50 border border-teal-200 shadow-sm">
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <p className="font-bold text-teal-800 text-sm">Welcome! Your hospital has been registered.</p>
              <p className="text-teal-700 text-sm mt-0.5">Complete your profile below so patients can find accurate information about your hospital.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="text-teal-400 hover:text-teal-600 text-lg leading-none mt-0.5"
            >
              ×
            </button>
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Hospital Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your hospital profile</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-lg font-bold text-slate-800">{hospital.name as string}</h2>
            <p className="text-xs text-slate-400 mt-0.5">ID: {hospital.id as string}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="contact@hospital.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="https://hospital.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="123 Hospital Road"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm resize-none"
                placeholder="About your hospital..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Working Hours <span className="font-normal text-slate-400">(JSON)</span>
              </label>
              <textarea
                value={workingHoursText}
                onChange={(e) => setWorkingHoursText(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-mono resize-none"
                placeholder={'{"Monday": "8am-8pm", "Sunday": "Closed"}'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Specialties <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={specialtiesText}
                onChange={(e) => setSpecialtiesText(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="Cardiology, Neurology, Orthopedics"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Facilities <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={facilitiesText}
                onChange={(e) => setFacilitiesText(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="ICU, Lab, Pharmacy, Parking"
              />
            </div>

            {msg && (
              <div
                className={`p-3 rounded-xl text-sm border ${
                  msg.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {msg.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 text-sm"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
