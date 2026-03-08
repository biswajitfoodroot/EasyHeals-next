import Link from "next/link";

export default function Home() {
  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Phase 1 Foundation</p>
        <h1>Independent platform for discovery, CRM operations, and patient workflows.</h1>
        <p>
          This codebase is greenfield, mobile-first, and SEO-ready. It runs independently from
          the current crm.easyheals.com stack.
        </p>
      </section>

      <section className="card-grid" aria-label="Discovery highlights" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Discovery and SEO</h2>
          <p>Taxonomy-led pages, metadata, sitemap, robots, and canonical URLs built in.</p>
          <Link href="/hospitals" style={{ color: "#006a6a", fontWeight: 600 }}>
            Browse Hospitals
          </Link>
        </article>
        <article className="card">
          <h2>Lead and CRM Backbone</h2>
          <p>Lead APIs, role-aware access, audit trails, and event outbox are enabled in Phase 1.</p>
          <Link href="/admin" style={{ color: "#006a6a", fontWeight: 600 }}>
            Open Admin
          </Link>
        </article>
        <article className="card">
          <h2>Scalable Data Layer</h2>
          <p>Turso + Drizzle schema covers identity, providers, taxonomy, leads, and packages.</p>
          <Link href="/treatments" style={{ color: "#006a6a", fontWeight: 600 }}>
            View Treatments
          </Link>
        </article>
      </section>
    </main>
  );
}
