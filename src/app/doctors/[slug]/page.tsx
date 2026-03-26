import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { DoctorProfileClient } from "@/components/profiles/DoctorProfileClient";
import { getDoctorProfileBySlug } from "@/lib/profile-data";
import { absoluteUrl, buildBreadcrumbJsonLd, buildDoctorJsonLd, buildMetadata } from "@/lib/seo";
import { db } from "@/db/client";
import { providerAgreements } from "@/db/schema";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDoctorProfileBySlug(slug);

  if (!profile) {
    return buildMetadata({
      title: "Doctor Not Found",
      description: "The requested doctor profile is unavailable.",
      path: `/doctors/${slug}`,
    });
  }

  const doctor = profile.doctor;
  const location = [doctor.city, doctor.state].filter(Boolean).join(", ");

  return buildMetadata({
    title: `Dr. ${doctor.fullName}${doctor.specialization ? ` – ${doctor.specialization}` : ""}${location ? ` in ${location}` : ""} | EasyHeals`,
    description: doctor.bio
      ? doctor.bio.slice(0, 155)
      : `${doctor.fullName}${doctor.specialization ? `, ${doctor.specialization}` : ""}${location ? ` in ${location}` : ""}. View consultation details, affiliated hospitals and book appointment.`,
    path: `/doctors/${doctor.slug}`,
  });
}

export default async function DoctorDetailPage({ params }: Params) {
  const { slug } = await params;
  const profile = await getDoctorProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const { doctor } = profile;

  // Check EasyHeals Network partnership (solo doctor agreement)
  let networkTierCode: string | null = null;
  if (doctor.id) {
    const [agreement] = await db
      .select({ tierCode: providerAgreements.tierCode })
      .from(providerAgreements)
      .where(and(
        eq(providerAgreements.doctorId, doctor.id),
        eq(providerAgreements.status, "accepted"),
      ))
      .limit(1);
    networkTierCode = agreement?.tierCode ?? null;
  }

  const jsonLd = [
    buildDoctorJsonLd(doctor),
    buildBreadcrumbJsonLd([
      { name: "Home", url: absoluteUrl("/") },
      { name: "Doctors", url: absoluteUrl("/doctors") },
      { name: doctor.fullName, url: absoluteUrl(`/doctors/${doctor.slug}`) },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DoctorProfileClient data={{ ...profile, networkTierCode }} />
    </>
  );
}
