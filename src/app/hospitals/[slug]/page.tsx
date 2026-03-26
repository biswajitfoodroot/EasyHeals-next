import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { HospitalProfileClient } from "@/components/profiles/HospitalProfileClient";
import { getHospitalProfileBySlug } from "@/lib/profile-data";
import { absoluteUrl, buildBreadcrumbJsonLd, buildHospitalJsonLd, buildMetadata } from "@/lib/seo";
import { db } from "@/db/client";
import { providerAgreements } from "@/db/schema";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getHospitalProfileBySlug(slug);

  if (!profile) {
    return buildMetadata({
      title: "Hospital Not Found",
      description: "The requested hospital profile is unavailable.",
      path: `/hospitals/${slug}`,
    });
  }

  const hospital = profile.hospital;
  const specs = hospital.specialties.slice(0, 3).join(", ");

  return buildMetadata({
    title: `${hospital.name} – ${hospital.city}${hospital.state ? `, ${hospital.state}` : ""} | EasyHeals`,
    description: hospital.description
      ? hospital.description.slice(0, 155)
      : `${hospital.name} in ${hospital.city}${hospital.state ? `, ${hospital.state}` : ""}${specs ? `. Specialties: ${specs}` : ""}. Book appointment, view doctors and packages.`,
    path: `/hospitals/${hospital.slug}`,
  });
}

export default async function HospitalDetailPage({ params }: Params) {
  const { slug } = await params;
  const profile = await getHospitalProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const { hospital } = profile;

  // Check EasyHeals Network partnership
  let networkTierCode: string | null = null;
  if (hospital.id) {
    const [agreement] = await db
      .select({ tierCode: providerAgreements.tierCode })
      .from(providerAgreements)
      .where(and(
        eq(providerAgreements.hospitalId, hospital.id),
        eq(providerAgreements.status, "accepted"),
      ))
      .limit(1);
    networkTierCode = agreement?.tierCode ?? null;
  }

  const jsonLd = [
    buildHospitalJsonLd(hospital),
    buildBreadcrumbJsonLd([
      { name: "Home", url: absoluteUrl("/") },
      { name: "Hospitals", url: absoluteUrl("/hospitals") },
      { name: hospital.name, url: absoluteUrl(`/hospitals/${hospital.slug}`) },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HospitalProfileClient data={{ ...profile, networkTierCode }} />
    </>
  );
}
