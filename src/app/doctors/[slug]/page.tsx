import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DoctorProfileClient } from "@/components/profiles/DoctorProfileClient";
import { getDoctorProfileBySlug } from "@/lib/profile-data";
import { buildMetadata } from "@/lib/seo";

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

  return buildMetadata({
    title: `${doctor.fullName} - Doctor Profile`,
    description: `${doctor.fullName}${doctor.specialization ? `, ${doctor.specialization}` : ""}${doctor.city ? ` in ${doctor.city}` : ""}. View affiliated hospitals and consultation details.`,
    path: `/doctors/${doctor.slug}`,
  });
}

export default async function DoctorDetailPage({ params }: Params) {
  const { slug } = await params;
  const profile = await getDoctorProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <DoctorProfileClient data={profile} />;
}
