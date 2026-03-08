import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Hospitals",
  description: "Browse top private hospitals by city and specialty focus.",
  path: "/hospitals",
});

export default async function HospitalsPage() {
  const rows = await db.select().from(hospitals) .orderBy(asc(hospitals.name)).limit(200);

  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Discovery</p>
        <h1>Hospitals</h1>
        <p>SEO-ready hospital listings with city discovery and profile-level URLs.</p>
      </section>

      <section className="card-grid" style={{ marginTop: "1rem" }}>
        {rows.map((hospital) => (
          <article key={hospital.id} className="card">
            <h2>{hospital.name}</h2>
            <p>
              {hospital.city}
              {hospital.state ? `, ${hospital.state}` : ""}
            </p>
            <Link href={`/hospitals/${hospital.slug}`} style={{ color: "#006a6a", fontWeight: 600 }}>
              View Profile
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

