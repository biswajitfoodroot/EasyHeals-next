"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@easyheals-next.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="home-main">
      <section className="hero" style={{ maxWidth: 520, margin: "1rem auto" }}>
        <p className="eyebrow">Admin Access</p>
        <h1>Sign in to EasyHeals Next CRM</h1>
        <p>Use seeded credentials for local development and replace for production.</p>

        <form onSubmit={onSubmit} style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
          <label>
            <span>Email</span>
            <input
              style={{ width: "100%", padding: "0.65rem", border: "1px solid #d7e0ea", borderRadius: 8 }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              style={{ width: "100%", padding: "0.65rem", border: "1px solid #d7e0ea", borderRadius: 8 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              borderRadius: 8,
              border: "none",
              background: "#006a6a",
              color: "white",
              fontWeight: 600,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
          {error ? <p style={{ color: "#a13030", margin: 0 }}>{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
