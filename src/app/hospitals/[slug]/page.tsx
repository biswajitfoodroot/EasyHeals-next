import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  return buildMetadata({
    title: `Hospital ${slug}`,
    description: "Hospital profile page with overview and contact details.",
    path: `/hospitals/${slug}`,
  });
}

export default async function HospitalDetailPage({ params }: Params) {
  const { slug } = await params;

  const rows = await db.select().from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
  if (!rows.length) {
    notFound();
  }

  const hospital = rows[0];

  return (
    <main className="home-main">
      <section className="hero">
        <p className="eyebrow">Hospital Profile</p>
        <h1>{hospital.name}</h1>
        <p>
          {hospital.city}
          {hospital.state ? `, ${hospital.state}` : ""}
        </p>
      </section>

      <section className="card-grid" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Contact</h2>
          <p>{hospital.phone ?? "Phone not added"}</p>
          <p>{hospital.email ?? "Email not added"}</p>
        </article>
        <article className="card">
          <h2>Address</h2>
          <p>{hospital.addressLine1 ?? "Address not added"}</p>
        </article>
      </section>
    </main>
  );
}
