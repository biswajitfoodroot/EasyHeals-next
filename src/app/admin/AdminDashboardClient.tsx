"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { fullName: string; email: string; role: string };
type Hospital = { id: string; name: string; city: string; slug: string; isActive: boolean };
type TaxonomyNode = { id: string; title: string; type: string; slug: string; isActive: boolean };

type Props = {
  me: Me;
  hospitals: Hospital[];
  nodes: TaxonomyNode[];
};

export default function AdminDashboardClient({ me, hospitals, nodes }: Props) {
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [nodeType, setNodeType] = useState("specialty");
  const [nodeTitle, setNodeTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreateHospital(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/hospitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: hospitalName,
        city: hospitalCity,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create hospital");
      return;
    }

    setHospitalName("");
    setHospitalCity("");
    router.refresh();
  }

  async function onCreateTaxonomy(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/taxonomy/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: nodeType, title: nodeTitle }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create taxonomy node");
      return;
    }

    setNodeTitle("");
    router.refresh();
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Admin Dashboard</p>
        <h1>CRM Operations (Greenfield)</h1>
        <p>
          Signed in as {me.fullName} ({me.role})
        </p>
        <button
          onClick={onLogout}
          style={{ marginTop: "0.8rem", border: "1px solid #d7e0ea", borderRadius: 8, padding: "0.5rem 0.8rem" }}
        >
          Logout
        </button>
      </section>

      {error ? <p style={{ color: "#a13030" }}>{error}</p> : null}

      <section className="card-grid" id="providers" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Create Hospital</h2>
          <form onSubmit={onCreateHospital} style={{ display: "grid", gap: "0.5rem", marginTop: "0.7rem" }}>
            <input
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="Hospital name"
              required
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #d7e0ea" }}
            />
            <input
              value={hospitalCity}
              onChange={(e) => setHospitalCity(e.target.value)}
              placeholder="City"
              required
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #d7e0ea" }}
            />
            <button type="submit" style={{ padding: "0.6rem", background: "#006a6a", color: "#fff", borderRadius: 8, border: "none" }}>
              Add Hospital
            </button>
          </form>
          <ul style={{ marginTop: "0.8rem", paddingLeft: "1rem" }}>
            {hospitals.slice(0, 8).map((item) => (
              <li key={item.id}>
                {item.name} ({item.city})
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Create Taxonomy Node</h2>
          <form onSubmit={onCreateTaxonomy} style={{ display: "grid", gap: "0.5rem", marginTop: "0.7rem" }}>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #d7e0ea" }}
            >
              <option value="specialty">Specialty</option>
              <option value="treatment">Treatment</option>
              <option value="symptom">Symptom</option>
            </select>
            <input
              value={nodeTitle}
              onChange={(e) => setNodeTitle(e.target.value)}
              placeholder="Node title"
              required
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #d7e0ea" }}
            />
            <button type="submit" style={{ padding: "0.6rem", background: "#006a6a", color: "#fff", borderRadius: 8, border: "none" }}>
              Add Node
            </button>
          </form>
          <ul style={{ marginTop: "0.8rem", paddingLeft: "1rem" }}>
            {nodes.slice(0, 8).map((item) => (
              <li key={item.id}>
                {item.title} ({item.type})
              </li>
            ))}
          </ul>
        </article>

        <article className="card" id="operations">
          <h2>Current Scope</h2>
          <p>Session auth, role checks, hospital CRUD, taxonomy CRUD, lead API, and seed pipeline are active.</p>
          <p style={{ marginTop: "0.6rem" }}>Next: appointments, payments, and package controls.</p>
        </article>
      </section>
    </main>
  );
}
