"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasGoogle: boolean;
  hasPassword: boolean;
  role: string;
}

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm text-slate-800";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");

  // Password fields
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [saving, setSaving]       = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [pwMsg, setPwMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) { router.push("/portal/login"); return; }
        const j = await r.json() as { data?: UserProfile };
        if (j.data) {
          setProfile(j.data);
          setFullName(j.data.fullName);
          setEmail(j.data.email);
          setPhone(j.data.phone ?? "");
        }
      })
      .catch(() => router.push("/portal/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/portal/me", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || null,
        }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        setMsg({ text: "Profile updated successfully.", ok: true });
        setProfile((prev) => prev ? { ...prev, fullName, email, phone: phone || null } : prev);
      } else {
        setMsg({ text: j.error ?? "Failed to save profile.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New passwords do not match.", ok: false }); return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: "Password must be at least 8 characters.", ok: false }); return;
    }
    setPwSaving(true); setPwMsg(null);
    try {
      const body: Record<string, string> = { newPassword: newPw };
      if (profile?.hasPassword) body.currentPassword = currentPw;
      const res = await fetch("/api/portal/me", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        setPwMsg({ text: "Password changed successfully.", ok: true });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setProfile((prev) => prev ? { ...prev, hasPassword: true } : prev);
      } else {
        setPwMsg({ text: j.error ?? "Failed to change password.", ok: false });
      }
    } catch {
      setPwMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setPwSaving(false);
      setTimeout(() => setPwMsg(null), 4000);
    }
  }

  const backHref = profile?.role === "doctor"
    ? "/portal/doctor/dashboard"
    : profile?.role && ["owner", "admin", "advisor", "viewer"].includes(profile.role)
      ? "/admin"
      : "/portal/hospital/dashboard";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Back link */}
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium">
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Account</h1>
          {profile && (
            <p className="text-sm text-slate-500 mt-0.5 capitalize">
              {profile.role.replace(/_/g, " ")} · {profile.email}
            </p>
          )}
        </div>

        {/* ── Profile Info ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-700">Profile Information</h2>

          {msg && (
            <div className={`p-3 rounded-xl text-sm border ${msg.ok ? "bg-teal-50 text-teal-800 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                required className={inputCls} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required className={inputCls} placeholder="you@example.com" />
              {profile?.hasGoogle && (
                <p className="text-xs text-slate-400 mt-1">This account is also linked to Google. Changing email here does not affect your Google login.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number <span className="font-normal text-slate-400">(optional)</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className={inputCls} placeholder="+91 98765 43210" />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : "Save Profile"}
            </button>
          </form>
        </section>

        {/* ── Change Password ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-700">
            {profile?.hasPassword ? "Change Password" : "Set a Password"}
          </h2>
          {!profile?.hasPassword && (
            <p className="text-xs text-slate-500">Your account currently uses Google sign-in only. You can set a password to also log in with email.</p>
          )}

          {pwMsg && (
            <div className={`p-3 rounded-xl text-sm border ${pwMsg.ok ? "bg-teal-50 text-teal-800 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {pwMsg.text}
            </div>
          )}

          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
            {profile?.hasPassword && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Current Password</label>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                  required className={inputCls} placeholder="••••••••" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">New Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                required minLength={8} className={inputCls} placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                required minLength={8} className={inputCls} placeholder="Repeat new password" />
            </div>
            <button type="submit" disabled={pwSaving}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {pwSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</> : "Update Password"}
            </button>
          </form>
        </section>

      </div>
    </div>
  );
}
