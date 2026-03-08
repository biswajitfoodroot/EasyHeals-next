import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  return buildMetadata({
    title: `Treatment ${slug}`,
    description: "Treatment overview page with related discovery context.",
    path: `/treatments/${slug}`,
  });
}

export default async function TreatmentDetailPage({ params }: Params) {
  const { slug } = await params;

  const rows = await db.select().from(taxonomyNodes).where(eq(taxonomyNodes.slug, slug)).limit(1);
  if (!rows.length) {
    notFound();
  }

  const node = rows[0];

  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Treatment Detail</p>
        <h1>{node.title}</h1>
        <p>{node.description ?? "Detailed treatment information will be added in upcoming phases."}</p>
      </section>
    </main>
  );
}
