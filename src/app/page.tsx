import Link from "next/link";

import { easyHealsPublicData } from "@/data/easyhealsPublicData";

export default function Home() {
  return (
    <main className="home-main">
      <section className="hero hero-split">
        <div>
          <p className="eyebrow">EasyHeals Next</p>
          <h1>Healthcare discovery with faster decisions, cleaner workflows, and better mobile UX.</h1>
          <p>
            Greenfield platform with independent data model, SEO-first routing, and CRM-ready operations.
          </p>
          <div className="cta-row">
            <Link href="/hospitals" className="cta-primary">
              Browse Hospitals
            </Link>
            <Link href="/admin" className="cta-secondary">
              Open Admin
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <p className="panel-title">Public Data Imported</p>
          <p>
            Source: {easyHealsPublicData.source} ({easyHealsPublicData.scrapedOn})
          </p>
          <ul>
            {easyHealsPublicData.services.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="chip-section">
        <h2>Specialties</h2>
        <div className="chip-grid">
          {easyHealsPublicData.specialties.map((item) => (
            <span className="chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="card-grid" aria-label="Discovery highlights" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Treatments</h2>
          <p>Structured treatment pages with crawlable URLs and metadata-ready detail views.</p>
          <Link href="/treatments" style={{ color: "#006a6a", fontWeight: 600 }}>
            View Treatments
          </Link>
        </article>
        <article className="card">
          <h2>Symptoms</h2>
          <p>Symptom taxonomy is preloaded from public EasyHeals metadata for faster launch content.</p>
          <Link href="/admin" style={{ color: "#006a6a", fontWeight: 600 }}>
            Manage Taxonomy
          </Link>
        </article>
        <article className="card">
          <h2>Contact Defaults</h2>
          <p>
            {easyHealsPublicData.contact.phone} | {easyHealsPublicData.contact.email}
          </p>
          <p>{easyHealsPublicData.contact.address}</p>
        </article>
      </section>
    </main>
  );
}
