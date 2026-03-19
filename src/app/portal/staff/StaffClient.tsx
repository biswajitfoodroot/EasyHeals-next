"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  subRole: string;
  isActive: boolean;
  createdAt: string | null;
}

interface Props {
  userRole: string;
  providerId?: string;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ""}`} />;
}

export default function StaffClient({ userRole, providerId }: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subRole, setSubRole] = useState<"receptionist" | "billing">("receptionist");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerId) params.set("providerId", providerId);
      const res = await fetch(`/api/v1/provider/staff?${params}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) { router.push("/portal/login"); return; }
      if (res.ok) {
        const j = (await res.json()) as { data: StaffMember[] };
        setStaff(j.data ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = { email, fullName: name, subRole, password };
      if (providerId) body.providerId = providerId;
      const res = await fetch("/api/v1/provider/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) {
        setError(j?.error?.message ?? "Failed to add staff member.");
      } else {
        setSuccess(`${name} added successfully.`);
        setShowForm(false);
        setName(""); setEmail(""); setPassword("");
        await load();
      }
    } catch { setError("Network error."); }
    finally { setAdding(false); }
  }

  async function handleToggle(id: string, current: boolean) {
    setToggling(id);
    try {
      await fetch(`/api/v1/provider/staff/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      setStaff((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !current } : s));
    } catch { /* non-fatal */ }
    finally { setToggling(null); }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-14 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "#1B8A4A" }}>E</span>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">EasyHeals</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { href: "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard" },
            { href: "/portal/hospital", icon: "🏥", label: "Edit Profile" },
            { href: "/portal/schedule", icon: "📅", label: "Schedule" },
            { href: "/portal/queue", icon: "🎫", label: "OPD Queue" },
            { href: "/portal/staff", icon: "👥", label: "Staff", active: true },
            { href: "/portal/subscription", icon: "💳", label: "Subscription" },
          ].map((n) => (
            <Link key={n.label} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${"active" in n && n.active ? "text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
              style={"active" in n && n.active ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base">{n.icon}</span>
              <span className="hidden lg:block">{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Staff & Sub-users</h1>
              <p className="text-sm text-slate-400">Manage receptionists and billing staff</p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition"
              style={{ background: "#1B8A4A" }}
            >
              {showForm ? "Cancel" : "+ Add Staff Member"}
            </button>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

          {/* Add form */}
          {showForm && (
            <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-700">Add Staff Member</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Rekha Singh" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="staff@hospital.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                  <select value={subRole} onChange={(e) => setSubRole(e.target.value as "receptionist" | "billing")}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                    <option value="receptionist">Receptionist (Appts + Queue)</option>
                    <option value="billing">Billing Staff</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={adding}
                  className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 flex items-center gap-2"
                  style={{ background: "#1B8A4A" }}>
                  {adding ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding...</> : "Add Staff Member"}
                </button>
              </div>
            </form>
          )}

          {/* Staff list */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : staff.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-slate-400 text-sm">No staff members yet. Add receptionists or billing staff above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{s.fullName}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{s.email}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{s.subRole}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggle(s.id, s.isActive)}
                          disabled={toggling === s.id}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${s.isActive ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-700 border-green-200 hover:bg-green-50"}`}
                        >
                          {toggling === s.id ? "..." : s.isActive ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
