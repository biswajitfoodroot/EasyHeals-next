"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

type Status = "idle" | "busy" | "success" | "error";

const LICENSE_TYPES = ["clinic", "hospital", "medical_practice"] as const;
const ENTITY_TYPES = ["hospital", "doctor", "clinic"] as const;

export default function KycRequestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<string>("hospital");
  const [entityId, setEntityId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseType, setLicenseType] = useState<string>("hospital");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [docUrls, setDocUrls] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setMsg("");

    const kycDocuments = docUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/portal/kyc-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId: entityId.trim() || undefined,
          businessName,
          licenseNumber,
          licenseType,
          kycDocuments,
          contactPhone,
          contactEmail,
          notes: notes || undefined,
        }),
      });

      const json = await res.json() as { data?: { id: string }; error?: string; details?: unknown };

      if (!res.ok) {
        setStatus("error");
        setMsg(json.error ?? "Submission failed. Please check all fields.");
        return;
      }

      setStatus("success");
      setRequestId(json.data?.id ?? null);
    } catch {
      setStatus("error");
      setMsg("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold text-slate-800">KYC Request Submitted</h1>
          <p className="text-slate-600 text-sm">
            Your access request has been received. Our team will review your documents
            and respond within 1–2 business days.
          </p>
          {requestId && (
            <p className="text-xs text-slate-400 font-mono">Reference ID: {requestId}</p>
          )}
          <Link
            href="/portal/hospital/dashboard"
            className="block w-full py-2.5 text-center bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/portal/hospital/dashboard" className="text-teal-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 mt-3">Request Entity Access</h1>
          <p className="text-slate-500 text-sm mt-1">
            Submit your KYC documents to link your account to a hospital, clinic, or doctor profile.
            An admin will review and approve your request.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Entity Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type *</label>
              <select
                required
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Existing Entity ID <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="If claiming an existing listing"
              />
            </div>
          </div>

          {/* Business / License */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Business / Clinic Name *</label>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="Apollo Hospitals Chennai"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">License Number *</label>
              <input
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="MCI/TN/2024/XXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">License Type *</label>
              <select
                required
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Phone *</label>
              <input
                required
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Email *</label>
              <input
                required
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="admin@hospital.com"
              />
            </div>
          </div>

          {/* KYC Document URLs */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              KYC Document URLs * <span className="font-normal text-slate-400">(one per line — upload to Google Drive / Blob and paste links)</span>
            </label>
            <textarea
              required
              rows={4}
              value={docUrls}
              onChange={(e) => setDocUrls(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
              placeholder={"https://drive.google.com/file/...\nhttps://..."}
            />
            <p className="text-xs text-slate-400 mt-1">
              Include: Registration certificate, license, Aadhaar/PAN, GST (if applicable).
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Additional Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
              placeholder="Any additional context for the admin review team..."
            />
          </div>

          {status === "error" && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">{msg}</div>
          )}

          <button
            type="submit"
            disabled={status === "busy"}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === "busy" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit KYC Request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
