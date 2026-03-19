import type { Metadata } from "next";

import { DirectorySearchList } from "@/components/profiles/DirectorySearchList";
import { listDoctorsDirectory } from "@/lib/profile-data";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Doctors & Specialists",
  description: "Browse doctor profiles with hospital affiliations, specialties, and consultation details.",
  path: "/doctors",
});

export default async function DoctorsPage() {
  const rows = await listDoctorsDirectory(500);
  const cityOptions = Array.from(new Set(rows.map((item) => item.city).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <DirectorySearchList
      kind="doctor"
      cityOptions={cityOptions}
      items={rows.map((row) => ({
        id: row.id,
        name: row.fullName,
        city: row.city ?? "India",
        state: row.state,
        specialties: row.specialties.length ? row.specialties : row.specialization ? [row.specialization] : [],
        rating: row.rating,
        verified: row.verified,
        subtitle: row.yearsOfExperience ? `${row.yearsOfExperience}+ years experience` : row.specialization,
        url: `/doctors/${row.slug}`,
      }))}
    />
  );
}
