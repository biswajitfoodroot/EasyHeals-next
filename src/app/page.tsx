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

      <section id="discovery" className="card-grid" aria-label="Discovery highlights">
        <article className="card">
          <h2>Discovery and SEO</h2>
          <p>Taxonomy-led pages, metadata, sitemap, robots, and canonical URLs built in.</p>
        </article>
        <article className="card">
          <h2>Lead and CRM Backbone</h2>
          <p>Lead APIs, role-aware access, audit trails, and event outbox are enabled in Phase 1.</p>
        </article>
        <article className="card">
          <h2>Scalable Data Layer</h2>
          <p>Turso + Drizzle schema covers identity, providers, taxonomy, leads, and packages.</p>
        </article>
      </section>
    </main>
  );
}
