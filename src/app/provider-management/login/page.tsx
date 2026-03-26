"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const PM_ROLES = new Set(["owner", "admin", "admin_manager", "admin_editor", "operator", "coordinator"]);

export default function ProviderManagementLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({})) as { error?: string; data?: { role?: string } };
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Login failed. Please check your credentials.");
      return;
    }

    const role = body.data?.role ?? "";
    if (!PM_ROLES.has(role)) {
      setError(`Your account (role: ${role || "unknown"}) does not have access to Provider Management. Contact your administrator.`);
      return;
    }

    router.push("/provider-management");
    router.refresh();
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%)",
      fontFamily: "var(--font-dmsans, system-ui, sans-serif)",
      padding: "2rem",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
        padding: "3rem 2.5rem",
        maxWidth: 440,
        width: "100%",
      }}>
        {/* Brand */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.5rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111827" }}>EasyHeals</span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", margin: "0 0 0.35rem" }}>
            Provider Management
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
            Sign in to manage providers, agreements, referrals and commissions.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: "0.4rem" }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@easyheals.in"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "0.7rem 0.9rem",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#4f46e5"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: "#374151", marginBottom: "0.4rem" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "0.7rem 0.9rem",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#4f46e5"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
            />
          </div>

          {error && (
            <div style={{
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "0.875rem",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "none",
              background: loading ? "#a5b4fc" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "#9ca3af", textAlign: "center" }}>
          Access is restricted to authorised EasyHeals operators.
          <br />Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
