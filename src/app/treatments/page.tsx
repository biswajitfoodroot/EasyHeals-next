import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Treatments",
  description: "Browse treatment categories and discover related providers.",
  path: "/treatments",
});

export default async function TreatmentsPage() {
  const rows = await db
    .select()
    .from(taxonomyNodes)
    .where(and(eq(taxonomyNodes.type, "treatment"), eq(taxonomyNodes.isActive, true)))
    .orderBy(asc(taxonomyNodes.title));

  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Discovery</p>
        <h1>Treatments</h1>
        <p>Structured treatment pages designed for navigation depth and search indexing.</p>
      </section>

      <section className="card-grid" style={{ marginTop: "1rem" }}>
        {rows.map((item) => (
          <article key={item.id} className="card">
            <h2>{item.title}</h2>
            <p>{item.description ?? "No summary yet."}</p>
            <Link href={`/treatments/${item.slug}`} style={{ color: "#006a6a", fontWeight: 600 }}>
              Explore
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
