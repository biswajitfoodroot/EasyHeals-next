"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Initialise Google Sign-In button once the GSI script loads
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

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    initGoogle();
    window.addEventListener("google-gsi-loaded", initGoogle);
    return () => window.removeEventListener("google-gsi-loaded", initGoogle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setError(json.error ?? "Sign-in failed. Make sure this Google account has admin access.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Sign-in failed. Please try again.");
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

      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "1rem" }}>
        <div style={{ width: "100%", maxWidth: 400, background: "white", borderRadius: 20, border: "1px solid #e2e8f0", padding: "2rem", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Logo + heading */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ width: 56, height: 56, background: "#0f766e", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>
              🔐
            </div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>Admin Sign In</h1>
            <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              EasyHeals CRM — Staff Access Only
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#991b1b", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}

          {/* Google button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            {GOOGLE_CLIENT_ID ? (
              <div id="google-admin-btn" style={{ minHeight: 44 }} />
            ) : (
              <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 12, color: "#92400e", fontSize: "0.85rem", textAlign: "center" }}>
                Google Sign-In not configured.<br />Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.
              </div>
            )}
            {busy && (
              <p style={{ fontSize: "0.875rem", color: "#0f766e", margin: 0 }}>Verifying…</p>
            )}
          </div>

          {/* Footer links */}
          <div style={{ marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid #f1f5f9", textAlign: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
            <p style={{ margin: 0 }}>
              Provider Portal?{" "}
              <a href="/portal/login" style={{ color: "#0f766e" }}>Sign in here →</a>
            </p>
            <p style={{ margin: "0.4rem 0 0" }}>
              <a href="/" style={{ color: "#94a3b8" }}>← Back to EasyHeals</a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
