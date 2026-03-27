"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";

type HospitalData = {
  id: string;
  name: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  phones?: string[] | null;
  email?: string | null;
  emailIds?: string[] | null;
  website?: string | null;
  addressLine1?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  workingHours?: Record<string, unknown> | null;
  feesRange?: Record<string, unknown> | null;
  specialties?: string[] | null;
  facilities?: string[] | null;
  accreditations?: string[] | null;
  whatsappBusinessNumber?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  slotDurationMinutes?: number | null;
  maxDailyAppointments?: number | null;
  queueEnabled?: boolean | null;
  [key: string]: unknown;
};

type Props = {
  hospital: Record<string, unknown>;
  welcome?: boolean;
};

type DoctorRow = {
  id: string; fullName: string; specialization?: string | null; phone?: string | null;
  email?: string | null; consultationFee?: number | null; yearsOfExperience?: number | null;
  specialties?: string[] | null; qualifications?: string[] | null; languages?: string[] | null;
  bio?: string | null; avatarUrl?: string | null; feeMin?: number | null; feeMax?: number | null;
  consultationHours?: Record<string, unknown> | null; isActive?: boolean | null;
};

type PackageRow = {
  id: string; packageName: string; procedureName?: string | null; department?: string | null;
  priceMin?: number | null; priceMax?: number | null; currency?: string | null;
  inclusions?: Record<string, unknown> | null; exclusions?: Record<string, unknown> | null;
  lengthOfStay?: string | null; isActive?: boolean | null;
};

const TABS = ["Basic Info", "Contact", "Location", "Services", "Doctors", "Packages", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function HospitalPortalClient({ hospital: initialHospital, welcome = false }: Props) {
  const hospital = initialHospital as HospitalData;
  const [activeTab, setActiveTab] = useState<Tab>("Basic Info");
  const [showWelcome, setShowWelcome] = useState(welcome);

  // ── Basic Info ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(hospital.name ?? "");
  const [type, setType] = useState(hospital.type ?? "hospital");
  const [description, setDescription] = useState(hospital.description ?? "");

  // ── Contact ─────────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState(hospital.phone ?? "");
  const [phonesText, setPhonesText] = useState((hospital.phones ?? []).join(", "));
  const [email, setEmail] = useState(hospital.email ?? "");
  const [emailIdsText, setEmailIdsText] = useState((hospital.emailIds ?? []).join(", "));
  const [website, setWebsite] = useState(hospital.website ?? "");
  const [whatsapp, setWhatsapp] = useState(hospital.whatsappBusinessNumber ?? "");
  const [contactPerson, setContactPerson] = useState(hospital.contactPerson ?? "");
  const [contactPhone, setContactPhone] = useState(hospital.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(hospital.contactEmail ?? "");

  // ── Location ─────────────────────────────────────────────────────────────────
  const [city, setCity] = useState(hospital.city ?? "");
  const [state, setState] = useState(hospital.state ?? "");
  const [country, setCountry] = useState(hospital.country ?? "India");
  const [addressLine1, setAddressLine1] = useState(hospital.addressLine1 ?? "");
  const [latitude, setLatitude] = useState(hospital.latitude != null ? String(hospital.latitude) : "");
  const [longitude, setLongitude] = useState(hospital.longitude != null ? String(hospital.longitude) : "");

  // ── Services ─────────────────────────────────────────────────────────────────
  const [specialtiesText, setSpecialtiesText] = useState((hospital.specialties ?? []).join(", "));
  const [facilitiesText, setFacilitiesText] = useState((hospital.facilities ?? []).join(", "));
  const [accreditationsText, setAccreditationsText] = useState((hospital.accreditations ?? []).join(", "));
  const [workingHoursText, setWorkingHoursText] = useState(
    hospital.workingHours ? JSON.stringify(hospital.workingHours, null, 2) : ""
  );
  const [feesRangeText, setFeesRangeText] = useState(
    hospital.feesRange ? JSON.stringify(hospital.feesRange, null, 2) : ""
  );

  // ── Settings ─────────────────────────────────────────────────────────────────
  const [slotDuration, setSlotDuration] = useState(hospital.slotDurationMinutes != null ? String(hospital.slotDurationMinutes) : "15");
  const [maxDaily, setMaxDaily] = useState(hospital.maxDailyAppointments != null ? String(hospital.maxDailyAppointments) : "");
  const [queueEnabled, setQueueEnabled] = useState(hospital.queueEnabled ?? false);

  // ── Doctors ──────────────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorsLoaded, setDoctorsLoaded] = useState(false);
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorRow | null>(null);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [newDoctor, setNewDoctor] = useState<Partial<DoctorRow>>({});
  // Attach existing doctor flow
  const [attachMode, setAttachMode] = useState(false);
  const [attachQuery, setAttachQuery] = useState("");
  const [attachResults, setAttachResults] = useState<Array<{ id: string; fullName: string; city: string | null; specialization: string | null; slug: string }>>([]);
  const [attachBusy, setAttachBusy] = useState(false);

  // ── Packages ─────────────────────────────────────────────────────────────────
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [pkgBusy, setPkgBusy] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageRow | null>(null);
  const [addingPkg, setAddingPkg] = useState(false);
  const [newPkg, setNewPkg] = useState<Partial<PackageRow>>({});

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadDoctors = useCallback(async () => {
    if (doctorsLoaded) return;
    setDoctorBusy(true);
    try {
      const res = await fetch("/api/portal/hospital/doctors");
      const json = await res.json() as { data?: DoctorRow[] };
      setDoctors(json.data ?? []);
      setDoctorsLoaded(true);
    } finally { setDoctorBusy(false); }
  }, [doctorsLoaded]);

  const loadPackages = useCallback(async () => {
    if (packagesLoaded) return;
    setPkgBusy(true);
    try {
      const res = await fetch("/api/portal/hospital/packages");
      const json = await res.json() as { data?: PackageRow[] };
      setPackages(json.data ?? []);
      setPackagesLoaded(true);
    } finally { setPkgBusy(false); }
  }, [packagesLoaded]);

  useEffect(() => {
    if (activeTab === "Doctors") void loadDoctors();
    if (activeTab === "Packages") void loadPackages();
  }, [activeTab, loadDoctors, loadPackages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    let workingHours: Record<string, unknown> | null = null;
    if (workingHoursText.trim()) {
      try { workingHours = JSON.parse(workingHoursText) as Record<string, unknown>; }
      catch { setMsg({ type: "error", text: "Working Hours must be valid JSON." }); setBusy(false); return; }
    }

    let feesRange: Record<string, unknown> | null = null;
    if (feesRangeText.trim()) {
      try { feesRange = JSON.parse(feesRangeText) as Record<string, unknown>; }
      catch { setMsg({ type: "error", text: "Fees Range must be valid JSON." }); setBusy(false); return; }
    }

    try {
      const res = await fetch("/api/portal/hospital", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          type: type || null,
          description: description || null,
          phone: phone || null,
          phones: phonesText.split(",").map((s) => s.trim()).filter(Boolean),
          email: email || null,
          emailIds: emailIdsText.split(",").map((s) => s.trim()).filter(Boolean),
          website: website || null,
          whatsappBusinessNumber: whatsapp || null,
          contactPerson: contactPerson || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          city: city || null,
          state: state || null,
          country: country || "India",
          addressLine1: addressLine1 || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          specialties: specialtiesText.split(",").map((s) => s.trim()).filter(Boolean),
          facilities: facilitiesText.split(",").map((s) => s.trim()).filter(Boolean),
          accreditations: accreditationsText.split(",").map((s) => s.trim()).filter(Boolean),
          workingHours,
          feesRange,
          slotDurationMinutes: slotDuration ? parseInt(slotDuration, 10) : null,
          maxDailyAppointments: maxDaily ? parseInt(maxDaily, 10) : null,
          queueEnabled,
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

  async function saveDoctor(doc: Partial<DoctorRow>, id?: string) {
    setDoctorBusy(true);
    const url = id ? `/api/portal/hospital/doctors?id=${id}` : "/api/portal/hospital/doctors";
    const res = await fetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc) });
    const json = await res.json() as { data?: DoctorRow; error?: string };
    if (res.ok && json.data) {
      if (id) setDoctors((prev) => prev.map((d) => d.id === id ? json.data! : d));
      else setDoctors((prev) => [...prev, json.data!]);
      setEditingDoctor(null); setAddingDoctor(false); setNewDoctor({});
    } else { setMsg({ type: "error", text: json.error ?? "Failed to save doctor" }); }
    setDoctorBusy(false);
  }

  async function deactivateDoctor(id: string) {
    if (!confirm("Remove this doctor from your hospital?")) return;
    setDoctorBusy(true);
    await fetch(`/api/portal/hospital/doctors?id=${id}`, { method: "DELETE" });
    setDoctors((prev) => prev.filter((d) => d.id !== id));
    setDoctorBusy(false);
  }

  async function searchAttachDoctors(q: string) {
    setAttachQuery(q);
    if (q.trim().length < 2) { setAttachResults([]); return; }
    setAttachBusy(true);
    try {
      const cityHint = city ?? "";
      const res = await fetch(`/api/portal/hospital/doctors/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(cityHint)}`);
      const json = await res.json() as { data?: typeof attachResults };
      setAttachResults(json.data ?? []);
    } finally { setAttachBusy(false); }
  }

  async function attachExistingDoctor(doctorId: string) {
    setAttachBusy(true);
    const res = await fetch("/api/portal/hospital/doctors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ existingDoctorId: doctorId, fullName: "" }),
    });
    const json = await res.json() as { data?: DoctorRow; error?: string };
    if (res.ok && json.data) {
      if (!doctors.find((d) => d.id === json.data!.id)) setDoctors((prev) => [...prev, json.data!]);
      setAttachMode(false); setAttachQuery(""); setAttachResults([]);
      setMsg({ type: "success", text: "Doctor linked to your hospital." });
    } else {
      setMsg({ type: "error", text: json.error ?? "Failed to attach doctor" });
    }
    setAttachBusy(false);
  }

  async function savePkg(pkg: Partial<PackageRow>, id?: string) {
    setPkgBusy(true);
    const url = id ? `/api/portal/hospital/packages?id=${id}` : "/api/portal/hospital/packages";
    const res = await fetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pkg) });
    const json = await res.json() as { data?: PackageRow; error?: string };
    if (res.ok && json.data) {
      if (id) setPackages((prev) => prev.map((p) => p.id === id ? json.data! : p));
      else setPackages((prev) => [...prev, json.data!]);
      setEditingPkg(null); setAddingPkg(false); setNewPkg({});
    } else { setMsg({ type: "error", text: json.error ?? "Failed to save package" }); }
    setPkgBusy(false);
  }

  async function deletePkg(id: string) {
    if (!confirm("Delete this package permanently?")) return;
    setPkgBusy(true);
    await fetch(`/api/portal/hospital/packages?id=${id}`, { method: "DELETE" });
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setPkgBusy(false);
  }

  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <div className="max-w-3xl mx-auto">
        {showWelcome && (
          <div className="mb-5 flex items-start gap-3 px-5 py-4 rounded-2xl bg-teal-50 border border-teal-200 shadow-sm">
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <p className="font-bold text-teal-800 text-sm">Welcome! Your hospital has been registered.</p>
              <p className="text-teal-700 text-sm mt-0.5">Complete your profile below so patients can find accurate information.</p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="text-teal-400 hover:text-teal-600 text-lg leading-none mt-0.5">×</button>
          </div>
        )}

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-800">Hospital Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your hospital profile</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{hospital.name as string}</h2>
              <p className="text-xs text-slate-400 mt-0.5">ID: {hospital.id as string}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 font-semibold capitalize">
              {(hospital.type as string) ?? "hospital"}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-teal-600 text-teal-700 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
            {/* ── BASIC INFO ─────────────────────────────────────────────────── */}
            {activeTab === "Basic Info" && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Hospital / Clinic Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. City General Hospital" />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                    <option value="hospital">Hospital</option>
                    <option value="clinic">Clinic</option>
                    <option value="diagnostic">Diagnostic Centre</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="nursing_home">Nursing Home</option>
                    <option value="polyclinic">Polyclinic</option>
                    <option value="maternity">Maternity Centre</option>
                    <option value="eye_care">Eye Care Centre</option>
                    <option value="dental">Dental Clinic</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputCls} resize-none`} placeholder="About your hospital, key services, patient care philosophy..." />
                </div>
              </div>
            )}

            {/* ── CONTACT ────────────────────────────────────────────────────── */}
            {activeTab === "Contact" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Primary Phone</label>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className={labelCls}>Primary Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="contact@hospital.com" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Additional Phone Numbers <span className="font-normal text-slate-400">(comma-separated)</span></label>
                  <input type="text" value={phonesText} onChange={(e) => setPhonesText(e.target.value)} className={inputCls} placeholder="011-23456789, +91 87654 32109" />
                </div>
                <div>
                  <label className={labelCls}>Additional Email Addresses <span className="font-normal text-slate-400">(comma-separated)</span></label>
                  <input type="text" value={emailIdsText} onChange={(e) => setEmailIdsText(e.target.value)} className={inputCls} placeholder="appointments@hospital.com, admin@hospital.com" />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://hospital.com" />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp Business Number</label>
                  <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Admin / Management Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Contact Person</label>
                      <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputCls} placeholder="Dr. Ramesh Kumar" />
                    </div>
                    <div>
                      <label className={labelCls}>Contact Phone</label>
                      <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} placeholder="+91 98765 00000" />
                    </div>
                    <div>
                      <label className={labelCls}>Contact Email</label>
                      <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} placeholder="admin@hospital.com" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LOCATION ───────────────────────────────────────────────────── */}
            {activeTab === "Location" && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Street Address</label>
                  <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} placeholder="123 Hospital Road, Sector 5" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Pune" />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputCls} placeholder="Maharashtra" />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="India" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Latitude <span className="font-normal text-slate-400">(optional, for map pin)</span></label>
                    <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputCls} placeholder="18.5204" />
                  </div>
                  <div>
                    <label className={labelCls}>Longitude</label>
                    <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputCls} placeholder="73.8567" />
                  </div>
                </div>
                <p className="text-xs text-slate-400">💡 Tip: You can find your GPS coordinates on Google Maps by right-clicking your location.</p>
              </div>
            )}

            {/* ── SERVICES ───────────────────────────────────────────────────── */}
            {activeTab === "Services" && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Specialties / Departments <span className="font-normal text-slate-400">(comma-separated)</span></label>
                  <input type="text" value={specialtiesText} onChange={(e) => setSpecialtiesText(e.target.value)} className={inputCls} placeholder="Cardiology, Neurology, Orthopaedics, Gynaecology" />
                </div>
                <div>
                  <label className={labelCls}>Facilities <span className="font-normal text-slate-400">(comma-separated)</span></label>
                  <input type="text" value={facilitiesText} onChange={(e) => setFacilitiesText(e.target.value)} className={inputCls} placeholder="ICU, NICU, Blood Bank, Pharmacy, Lab, Canteen, Parking" />
                </div>
                <div>
                  <label className={labelCls}>Accreditations <span className="font-normal text-slate-400">(comma-separated)</span></label>
                  <input type="text" value={accreditationsText} onChange={(e) => setAccreditationsText(e.target.value)} className={inputCls} placeholder="NABH, JCI, ISO 9001:2015" />
                </div>
                <div>
                  <label className={labelCls}>
                    Working Hours <span className="font-normal text-slate-400">(JSON)</span>
                  </label>
                  <textarea
                    value={workingHoursText}
                    onChange={(e) => setWorkingHoursText(e.target.value)}
                    rows={5}
                    className={`${inputCls} font-mono resize-none`}
                    placeholder={'{"Monday": "8am–8pm", "Saturday": "9am–5pm", "Sunday": "Emergency only"}'}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Fees / Pricing Range <span className="font-normal text-slate-400">(JSON)</span>
                  </label>
                  <textarea
                    value={feesRangeText}
                    onChange={(e) => setFeesRangeText(e.target.value)}
                    rows={4}
                    className={`${inputCls} font-mono resize-none`}
                    placeholder={'{"OPD": "₹300–₹800", "Emergency": "₹1000+", "Surgery": "Varies"}'}
                  />
                </div>
              </div>
            )}

            {/* ── SETTINGS ───────────────────────────────────────────────────── */}
            {activeTab === "Settings" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">OPD Queue System</p>
                      <p className="text-xs text-slate-500 mt-0.5">Enable token-based walk-in queue for your OPD</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQueueEnabled((v) => !v)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${queueEnabled ? "bg-teal-600" : "bg-slate-300"}`}
                      role="switch"
                      aria-checked={queueEnabled}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${queueEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Appointment Slot Duration <span className="font-normal text-slate-400">(minutes)</span></label>
                    <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} className={inputCls}>
                      <option value="10">10 min</option>
                      <option value="15">15 min</option>
                      <option value="20">20 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Max Daily Appointments <span className="font-normal text-slate-400">(leave blank for unlimited)</span></label>
                    <input
                      type="number"
                      min="1"
                      value={maxDaily}
                      onChange={(e) => setMaxDaily(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. 50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── DOCTORS ─────────────────────────────────────────────────── */}
            {activeTab === "Doctors" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-700">{doctors.length} Doctor{doctors.length !== 1 ? "s" : ""}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setAttachMode(!attachMode); setAddingDoctor(false); setAttachQuery(""); setAttachResults([]); }} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 border border-slate-200">🔗 Attach Existing</button>
                    <button type="button" onClick={() => { setAddingDoctor(true); setAttachMode(false); setNewDoctor({}); }} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700">+ Add New</button>
                  </div>
                </div>

                {/* Attach existing doctor search */}
                {attachMode && (
                  <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40 space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Attach an Existing Doctor</p>
                    <p className="text-xs text-blue-600">Search for a doctor already in EasyHeals and link them to your hospital.</p>
                    <div className="relative">
                      <input
                        className={inputCls}
                        value={attachQuery}
                        onChange={(e) => void searchAttachDoctors(e.target.value)}
                        placeholder="Search by doctor name…"
                      />
                      {attachBusy && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />}
                    </div>
                    {attachResults.length > 0 && (
                      <div className="space-y-1.5">
                        {attachResults.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-lg border border-slate-200">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{doc.fullName}</p>
                              <p className="text-xs text-slate-500">{doc.specialization ?? "—"}{doc.city ? ` · ${doc.city}` : ""}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void attachExistingDoctor(doc.id)}
                              disabled={attachBusy || !!doctors.find((d) => d.id === doc.id)}
                              className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                            >
                              {doctors.find((d) => d.id === doc.id) ? "Linked" : "Attach"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {attachQuery.length >= 2 && !attachBusy && attachResults.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No doctors found. Try a different name or add a new one.</p>
                    )}
                    <button type="button" onClick={() => { setAttachMode(false); setAttachQuery(""); setAttachResults([]); }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                )}

                {doctorBusy && !doctors.length && <p className="text-sm text-slate-400 py-4 text-center">Loading...</p>}

                {/* Add form */}
                {addingDoctor && (
                  <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/40 space-y-3">
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">New Doctor</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className={labelCls}>Full Name *</label><input className={inputCls} value={newDoctor.fullName ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, fullName: e.target.value }))} placeholder="Dr. Anita Sharma" /></div>
                      <div><label className={labelCls}>Specialization</label><input className={inputCls} value={newDoctor.specialization ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, specialization: e.target.value }))} placeholder="Cardiology" /></div>
                      <div><label className={labelCls}>Phone</label><input className={inputCls} value={newDoctor.phone ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
                      <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={newDoctor.email ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, email: e.target.value }))} placeholder="doctor@hospital.com" /></div>
                      <div><label className={labelCls}>Consultation Fee (₹)</label><input type="number" className={inputCls} value={newDoctor.consultationFee ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, consultationFee: parseFloat(e.target.value) || null }))} placeholder="500" /></div>
                      <div><label className={labelCls}>Experience (years)</label><input type="number" className={inputCls} value={newDoctor.yearsOfExperience ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, yearsOfExperience: parseInt(e.target.value) || null }))} placeholder="10" /></div>
                    </div>
                    <div><label className={labelCls}>Qualifications <span className="font-normal text-slate-400">(comma-separated)</span></label><input className={inputCls} value={(newDoctor.qualifications ?? []).join(", ")} onChange={(e) => setNewDoctor((p) => ({ ...p, qualifications: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} placeholder="MBBS, MD, DM Cardiology" /></div>
                    <div><label className={labelCls}>Bio</label><textarea rows={2} className={`${inputCls} resize-none`} value={newDoctor.bio ?? ""} onChange={(e) => setNewDoctor((p) => ({ ...p, bio: e.target.value }))} placeholder="Brief professional background..." /></div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setAddingDoctor(false)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                      <button type="button" disabled={doctorBusy} onClick={() => void saveDoctor(newDoctor)} className="px-4 py-1.5 text-xs bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-60">
                        {doctorBusy ? "Saving..." : "Save Doctor"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Doctor list */}
                <div className="space-y-2">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                      {editingDoctor?.id === doc.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={labelCls}>Full Name</label><input className={inputCls} value={editingDoctor.fullName ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, fullName: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Specialization</label><input className={inputCls} value={editingDoctor.specialization ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, specialization: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Phone</label><input className={inputCls} value={editingDoctor.phone ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, phone: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={editingDoctor.email ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, email: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Consultation Fee (₹)</label><input type="number" className={inputCls} value={editingDoctor.consultationFee ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, consultationFee: parseFloat(e.target.value) || null }) : p)} /></div>
                            <div><label className={labelCls}>Experience (years)</label><input type="number" className={inputCls} value={editingDoctor.yearsOfExperience ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, yearsOfExperience: parseInt(e.target.value) || null }) : p)} /></div>
                          </div>
                          <div><label className={labelCls}>Qualifications</label><input className={inputCls} value={(editingDoctor.qualifications ?? []).join(", ")} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, qualifications: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }) : p)} /></div>
                          <div><label className={labelCls}>Bio</label><textarea rows={2} className={`${inputCls} resize-none`} value={editingDoctor.bio ?? ""} onChange={(e) => setEditingDoctor((p) => p ? ({ ...p, bio: e.target.value }) : p)} /></div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingDoctor(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600">Cancel</button>
                            <button type="button" disabled={doctorBusy} onClick={() => void saveDoctor(editingDoctor, doc.id)} className="px-4 py-1.5 text-xs bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-60">
                              {doctorBusy ? "Saving..." : "Update"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{doc.fullName}</p>
                            <p className="text-xs text-slate-500">{doc.specialization ?? "—"}{doc.consultationFee ? ` · ₹${doc.consultationFee}` : ""}</p>
                            {doc.phone && <p className="text-xs text-slate-400">{doc.phone}</p>}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button type="button" onClick={() => setEditingDoctor(doc)} className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Edit</button>
                            <button type="button" onClick={() => void deactivateDoctor(doc.id)} className="px-2.5 py-1 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!doctorBusy && doctorsLoaded && doctors.length === 0 && (
                    <p className="text-sm text-slate-400 py-6 text-center">No doctors yet. Click &quot;Add Doctor&quot; to add your first doctor.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── PACKAGES ────────────────────────────────────────────────────── */}
            {activeTab === "Packages" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">{packages.length} Package{packages.length !== 1 ? "s" : ""}</p>
                  <button type="button" onClick={() => { setAddingPkg(true); setNewPkg({ currency: "INR" }); }} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700">+ Add Package</button>
                </div>

                {pkgBusy && !packages.length && <p className="text-sm text-slate-400 py-4 text-center">Loading...</p>}

                {/* Add form */}
                {addingPkg && (
                  <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/40 space-y-3">
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">New Package</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2"><label className={labelCls}>Package Name *</label><input className={inputCls} value={newPkg.packageName ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, packageName: e.target.value }))} placeholder="e.g. Cardiac Bypass Surgery Package" /></div>
                      <div><label className={labelCls}>Procedure Name</label><input className={inputCls} value={newPkg.procedureName ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, procedureName: e.target.value }))} placeholder="CABG" /></div>
                      <div><label className={labelCls}>Department</label><input className={inputCls} value={newPkg.department ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, department: e.target.value }))} placeholder="Cardiology" /></div>
                      <div><label className={labelCls}>Min Price (₹)</label><input type="number" className={inputCls} value={newPkg.priceMin ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, priceMin: parseFloat(e.target.value) || null }))} placeholder="150000" /></div>
                      <div><label className={labelCls}>Max Price (₹)</label><input type="number" className={inputCls} value={newPkg.priceMax ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, priceMax: parseFloat(e.target.value) || null }))} placeholder="250000" /></div>
                      <div><label className={labelCls}>Length of Stay</label><input className={inputCls} value={newPkg.lengthOfStay ?? ""} onChange={(e) => setNewPkg((p) => ({ ...p, lengthOfStay: e.target.value }))} placeholder="5–7 days" /></div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setAddingPkg(false)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                      <button type="button" disabled={pkgBusy} onClick={() => void savePkg(newPkg)} className="px-4 py-1.5 text-xs bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-60">
                        {pkgBusy ? "Saving..." : "Save Package"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Package list */}
                <div className="space-y-2">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                      {editingPkg?.id === pkg.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className={labelCls}>Package Name</label><input className={inputCls} value={editingPkg.packageName ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, packageName: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Procedure</label><input className={inputCls} value={editingPkg.procedureName ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, procedureName: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Department</label><input className={inputCls} value={editingPkg.department ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, department: e.target.value }) : p)} /></div>
                            <div><label className={labelCls}>Min Price (₹)</label><input type="number" className={inputCls} value={editingPkg.priceMin ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, priceMin: parseFloat(e.target.value) || null }) : p)} /></div>
                            <div><label className={labelCls}>Max Price (₹)</label><input type="number" className={inputCls} value={editingPkg.priceMax ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, priceMax: parseFloat(e.target.value) || null }) : p)} /></div>
                            <div><label className={labelCls}>Length of Stay</label><input className={inputCls} value={editingPkg.lengthOfStay ?? ""} onChange={(e) => setEditingPkg((p) => p ? ({ ...p, lengthOfStay: e.target.value }) : p)} /></div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingPkg(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600">Cancel</button>
                            <button type="button" disabled={pkgBusy} onClick={() => void savePkg(editingPkg, pkg.id)} className="px-4 py-1.5 text-xs bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-60">
                              {pkgBusy ? "Saving..." : "Update"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{pkg.packageName}</p>
                            <p className="text-xs text-slate-500">
                              {pkg.department && <span>{pkg.department} · </span>}
                              {pkg.priceMin != null && pkg.priceMax != null ? `₹${pkg.priceMin.toLocaleString("en-IN")} – ₹${pkg.priceMax.toLocaleString("en-IN")}` : pkg.priceMin != null ? `from ₹${pkg.priceMin.toLocaleString("en-IN")}` : "Price on request"}
                            </p>
                            {pkg.lengthOfStay && <p className="text-xs text-slate-400">Stay: {pkg.lengthOfStay}</p>}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button type="button" onClick={() => setEditingPkg(pkg)} className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Edit</button>
                            <button type="button" onClick={() => void deletePkg(pkg.id)} className="px-2.5 py-1 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50">Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!pkgBusy && packagesLoaded && packages.length === 0 && (
                    <p className="text-sm text-slate-400 py-6 text-center">No packages yet. Click &quot;Add Package&quot; to add your first treatment package.</p>
                  )}
                </div>
              </div>
            )}

            {/* Status message */}
            {msg && (
              <div className={`mt-4 p-3 rounded-xl text-sm border ${
                msg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {msg.text}
              </div>
            )}

            {/* Only show Save button for profile tabs, not for Doctors/Packages (those have inline save) */}
            {!["Doctors", "Packages"].includes(activeTab) && (
            <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
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
                ) : "Save Changes"}
              </button>
            </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
