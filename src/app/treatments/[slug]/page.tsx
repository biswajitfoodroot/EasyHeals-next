import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TreatmentProfileClient } from "@/components/profiles/TreatmentProfileClient";
import { getTreatmentProfileBySlug } from "@/lib/profile-data";
import { absoluteUrl, buildBreadcrumbJsonLd, buildMetadata, buildTreatmentJsonLd } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getTreatmentProfileBySlug(slug);

  if (!profile) {
    return buildMetadata({
      title: "Treatment Not Found",
      description: "The requested treatment page is unavailable.",
      path: `/treatments/${slug}`,
    });
  }

  const { treatment } = profile;

  return buildMetadata({
    title: `${treatment.title} – Hospitals & Doctors in India | EasyHeals`,
    description: treatment.description
      ? treatment.description.slice(0, 155)
      : `Find top hospitals and specialist doctors for ${treatment.title} in India. Compare costs, view profiles and book appointments on EasyHeals.`,
    path: `/treatments/${treatment.slug}`,
  });
}

export default async function TreatmentDetailPage({ params }: Params) {
  const { slug } = await params;
  const profile = await getTreatmentProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const { treatment } = profile;

  const jsonLd = [
    buildTreatmentJsonLd(treatment),
    buildBreadcrumbJsonLd([
      { name: "Home", url: absoluteUrl("/") },
      { name: "Treatments", url: absoluteUrl("/treatments") },
      { name: treatment.title, url: absoluteUrl(`/treatments/${treatment.slug}`) },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TreatmentProfileClient data={profile} />
    </>
  );
}
