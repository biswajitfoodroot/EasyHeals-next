import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HospitalProfileClient } from "@/components/profiles/HospitalProfileClient";
import { getHospitalProfileBySlug } from "@/lib/profile-data";
import { buildMetadata } from "@/lib/seo";

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

  return buildMetadata({
    title: `${hospital.name} - Hospital Profile`,
    description: `${hospital.name} in ${hospital.city}${hospital.state ? `, ${hospital.state}` : ""}. View affiliated doctors, location, and services.`,
    path: `/hospitals/${hospital.slug}`,
  });
}

export default async function HospitalDetailPage({ params }: Params) {
  const { slug } = await params;
  const profile = await getHospitalProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <HospitalProfileClient data={profile} />;
}

