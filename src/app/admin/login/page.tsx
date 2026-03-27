"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

type LoginMode = "password" | "google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("admin@easyheals-next.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Password login ───────────────────────────────────────────────────────────
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Login failed");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "google" || !GOOGLE_CLIENT_ID) return;

    function initGoogle() {
      const win = window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (opts: unknown) => void;
              renderButton: (el: HTMLElement, opts: unknown) => void;
            };
          };
        };
      };
      if (!win.google?.accounts) return;

      win.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
      });

      const btn = document.getElementById("google-admin-btn");
      if (btn) {
        win.google.accounts.id.renderButton(btn, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "signin_with",
        });
      }
    }

    initGoogle();
    window.addEventListener("google-gsi-loaded", initGoogle);
    return () => window.removeEventListener("google-gsi-loaded", initGoogle);
  }, [mode]);

  async function handleGoogleCredential(response: { credential: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential, adminLogin: true }),
      });
      const json = await res.json() as { data?: { role: string }; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Google sign-in failed. Make sure this Google account has admin access.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => window.dispatchEvent(new Event("google-gsi-loaded"))}
      />

      <main className="home-main">
        <section className="hero" style={{ maxWidth: 480, margin: "2rem auto" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔐</div>
            <h1 style={{ margin: 0 }}>Admin Sign In</h1>
            <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>EasyHeals CRM — Staff Access Only</p>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: "4px", padding: "4px", background: "#f1f5f9", borderRadius: "12px", marginBottom: "1.25rem" }}>
            {(["password", "google"] as LoginMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: mode === m ? "white" : "transparent",
                  color: mode === m ? "#0f766e" : "#64748b",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "password" ? "📧 Email & Password" : "🔵 Google"}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ marginBottom: "1rem", padding: "0.65rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#991b1b", fontSize: "0.88rem" }}>
              {error}
            </div>
          )}

          {/* ── PASSWORD ── */}
          {mode === "password" && (
            <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: "0.7rem" }}>
              <label>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Email</span>
                <input
                  style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Password</span>
                <input
                  style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc", fontSize: "0.9rem", boxSizing: "border-box" }}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "#0f766e",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {busy ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    Signing in...
                  </>
                ) : "Sign In"}
              </button>
            </form>
          )}

          {/* ── GOOGLE ── */}
          {mode === "google" && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <p style={{ fontSize: "0.88rem", color: "#64748b", marginBottom: "1.25rem" }}>
                Sign in with the Google account registered under your EasyHeals admin profile.
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div id="google-admin-btn" />
              </div>
              {!GOOGLE_CLIENT_ID && (
                <p style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "0.75rem" }}>
                  Google Client ID not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID).
                </p>
              )}
              {busy && (
                <p style={{ fontSize: "0.85rem", color: "#0f766e", marginTop: "0.75rem" }}>Verifying...</p>
              )}
            </div>
          )}

          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
            <p style={{ margin: 0 }}>
              Provider Portal? <a href="/portal/login" style={{ color: "#0f766e" }}>Sign in here →</a>
            </p>
            <p style={{ margin: "0.4rem 0 0" }}>
              <a href="/" style={{ color: "#94a3b8" }}>← Back to EasyHeals</a>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
