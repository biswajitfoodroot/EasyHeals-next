"use client";

import { useSearchParams, useRouter } from "next/navigation";

const PLANE_LABELS: Record<string, { label: string; loginHref: string }> = {
  "provider-management": { label: "Provider Management", loginHref: "/admin/login?redirect=/provider-management" },
  admin:                 { label: "Admin Console",        loginHref: "/admin/login" },
  portal:                { label: "Provider Portal",      loginHref: "/portal/login" },
};

export default function UnauthorizedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get("from") ?? "";
  const plane = PLANE_LABELS[from] ?? { label: "this area", loginHref: "/admin/login" };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8f5f0 100%)",
      fontFamily: "var(--font-dmsans, system-ui, sans-serif)",
      padding: "2rem",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
        padding: "3rem 2.5rem",
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#fff4e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
          fontSize: 32,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#f59e0b"/>
          </svg>
        </div>

        {/* Status code */}
        <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "#9ca3af", marginBottom: "0.5rem", textTransform: "uppercase" }}>
          403 — Access Denied
        </p>

        {/* Heading */}
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem", lineHeight: 1.25 }}>
          You don&apos;t have permission to view {plane.label}
        </h1>

        {/* Body */}
        <p style={{ fontSize: "0.95rem", color: "#6b7280", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your current account doesn&apos;t have the role required to access this area.
          If you believe this is a mistake, please contact your system administrator
          or sign in with a different account.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <a
            href={plane.loginHref}
            style={{
              display: "block",
              padding: "0.8rem 1.5rem",
              borderRadius: 10,
              background: "#0f766e",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}
          >
            Sign in with a different account
          </a>
          <button
            onClick={() => router.back()}
            style={{
              padding: "0.8rem 1.5rem",
              borderRadius: 10,
              border: "1.5px solid #e5e7eb",
              background: "transparent",
              color: "#374151",
              fontWeight: 500,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
