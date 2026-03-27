"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";

type DoctorData = {
  id: string;
  fullName: string;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  specialization?: string | null;
  qualifications?: string[] | null;
  languages?: string[] | null;
  consultationFee?: number | null;
  feeMin?: number | null;
  feeMax?: number | null;
  yearsOfExperience?: number | null;
  avatarUrl?: string | null;
  [key: string]: unknown;
};

type Affiliation = {
  affiliationId: string;
  role: string;
  isPrimary: boolean;
  isActive: boolean;
  affiliationStatus: string;
  feeMin: number | null;
  feeMax: number | null;
  source: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string | null;
  hospitalState: string | null;
  hospitalSlug: string;
  hospitalPhone: string | null;
  hospitalWebsite: string | null;
};

type Props = {
  doctor: Record<string, unknown>;
};

export default function DoctorPortalClient({ doctor: initialDoctor }: Props) {
  const doctor = initialDoctor as DoctorData;

  const [bio, setBio] = useState(doctor.bio ?? "");
  const [phone, setPhone] = useState(doctor.phone ?? "");
  const [email, setEmail] = useState(doctor.email ?? "");
  const [specialization, setSpecialization] = useState(doctor.specialization ?? "");
  const [qualificationsText, setQualificationsText] = useState(
    (doctor.qualifications ?? []).join(", ")
  );
  const [languagesText, setLanguagesText] = useState(
    (doctor.languages ?? []).join(", ")
  );
  const [consultationFee, setConsultationFee] = useState(
    doctor.consultationFee != null ? String(doctor.consultationFee) : ""
  );
  const [feeMin, setFeeMin] = useState(
    doctor.feeMin != null ? String(doctor.feeMin) : ""
  );
  const [feeMax, setFeeMax] = useState(
    doctor.feeMax != null ? String(doctor.feeMax) : ""
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(
    doctor.yearsOfExperience != null ? String(doctor.yearsOfExperience) : ""
  );
  const [avatarUrl, setAvatarUrl] = useState(doctor.avatarUrl ?? "");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Affiliations — loaded from doctorHospitalAffiliations table (ID-based only)
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [affiliationsLoading, setAffiliationsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/doctor/affiliations")
      .then((r) => r.json())
      .then((j: { data?: Affiliation[] }) => setAffiliations(j.data ?? []))
      .catch(() => {/* silently ignore */})
      .finally(() => setAffiliationsLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const qualifications = qualificationsText.split(",").map((s) => s.trim()).filter(Boolean);
    const languages = languagesText.split(",").map((s) => s.trim()).filter(Boolean);

    const payload: Record<string, unknown> = {
      bio: bio || null,
      phone: phone || null,
      email: email || null,
      specialization: specialization || null,
      qualifications,
      languages,
      avatarUrl: avatarUrl || null,
    };

    if (consultationFee) payload.consultationFee = Number(consultationFee);
    if (feeMin) payload.feeMin = Number(feeMin);
    if (feeMax) payload.feeMax = Number(feeMax);
    if (yearsOfExperience) payload.yearsOfExperience = parseInt(yearsOfExperience, 10);

    try {
      const res = await fetch("/api/portal/doctor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Doctor Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your professional profile</p>
        </div>

        {/* ── My Hospital Affiliations ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-4">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">🏥 My Hospital Affiliations</h2>
              <p className="text-xs text-slate-400 mt-0.5">Hospitals where you are registered as a doctor</p>
            </div>
            {affiliationsLoading && (
              <span className="text-xs text-slate-400">Loading…</span>
            )}
          </div>

          <div className="p-4">
            {(() => {
              const current = affiliations.filter((a) => a.isActive && a.affiliationStatus === "active");
              const past = affiliations.filter((a) => !a.isActive || a.affiliationStatus === "removed" || a.affiliationStatus === "declined");
              const pending = affiliations.filter((a) => a.affiliationStatus === "pending_doctor_accept");

              if (!affiliationsLoading && affiliations.length === 0) {
                return (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No hospital affiliations found. Contact your hospital administrator to link your profile.
                  </p>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Pending invitations */}
                  {pending.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-yellow-700 mb-2">⏳ Pending Invitations</p>
                      <div className="space-y-2">
                        {pending.map((aff) => (
                          <div key={aff.affiliationId} className="flex items-start gap-3 p-3 rounded-xl border border-yellow-200 bg-yellow-50">
                            <div className="min-w-0 flex-1">
                              <Link href={`/hospitals/${aff.hospitalSlug}`} className="font-semibold text-sm text-teal-700 hover:underline">{aff.hospitalName}</Link>
                              <div className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-2">
                                <span>📍 {aff.hospitalCity ?? "—"}{aff.hospitalState ? `, ${aff.hospitalState}` : ""}</span>
                                <span>🏷 {aff.role}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current affiliations */}
                  {current.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Current Hospitals</p>
                      <div className="space-y-2">
                        {current.map((aff) => (
                          <div key={aff.affiliationId} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link href={`/hospitals/${aff.hospitalSlug}`} className="font-semibold text-sm text-teal-700 hover:underline">{aff.hospitalName}</Link>
                                {aff.isPrimary && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full uppercase">★ Primary</span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-2">
                                <span>📍 {aff.hospitalCity ?? "—"}{aff.hospitalState ? `, ${aff.hospitalState}` : ""}</span>
                                <span>🏷 {aff.role}</span>
                                {(aff.feeMin || aff.feeMax) && <span>₹{aff.feeMin ?? "—"}–{aff.feeMax ?? "—"}</span>}
                              </div>
                            </div>
                            {aff.hospitalPhone && (
                              <a href={`tel:${aff.hospitalPhone}`} className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors">
                                Call
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past affiliations — info only, no actions */}
                  {past.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2">🕐 Previously Worked At</p>
                      <div className="space-y-2">
                        {past.map((aff) => (
                          <div key={aff.affiliationId} className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 opacity-70">
                            <div className="min-w-0">
                              <span className="font-semibold text-sm text-slate-500">{aff.hospitalName}</span>
                              <div className="mt-0.5 text-xs text-slate-400 flex flex-wrap gap-2">
                                <span>📍 {aff.hospitalCity ?? "—"}{aff.hospitalState ? `, ${aff.hospitalState}` : ""}</span>
                                <span>🏷 {aff.role}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="mt-3 text-xs text-slate-400">
              To add or remove hospital affiliations, contact your hospital administrator or the EasyHeals support team.
            </p>
          </div>
        </div>

        {/* ── Profile Form ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-lg font-bold text-slate-800">{doctor.fullName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">ID: {doctor.id}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm resize-none"
                placeholder="Brief professional bio..."
              />
            </div>

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
                  placeholder="doctor@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Specialization</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="e.g. Cardiologist"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Qualifications <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={qualificationsText}
                onChange={(e) => setQualificationsText(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="MBBS, MD, DM"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Languages <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="English, Hindi, Bengali"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Consultation Fee</label>
                <input
                  type="number"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fee Min</label>
                <input
                  type="number"
                  value={feeMin}
                  onChange={(e) => setFeeMin(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="300"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fee Max</label>
                <input
                  type="number"
                  value={feeMax}
                  onChange={(e) => setFeeMax(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  placeholder="1000"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Years of Experience</label>
              <input
                type="number"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                placeholder="10"
                min="0"
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
