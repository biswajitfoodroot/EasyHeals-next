import type { Metadata } from "next";

import { DirectorySearchList } from "@/components/profiles/DirectorySearchList";
import { listHospitalsDirectory } from "@/lib/profile-data";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Private Hospitals Across India",
  description: "Discover verified private hospitals with intelligent filters, map-ready profiles, and doctor affiliations.",
  path: "/hospitals",
});

export default async function HospitalsPage() {
  const rows = await listHospitalsDirectory(1000);
  const cityOptions = Array.from(new Set(rows.map((item) => item.city))).sort((a, b) => a.localeCompare(b));

  return (
    <DirectorySearchList
      kind="hospital"
      cityOptions={cityOptions}
      items={rows.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        state: row.state,
        specialties: row.specialties,
        rating: row.rating,
        verified: row.verified,
        subtitle: row.description,
        url: `/hospitals/${row.slug}`,
      }))}
    />
  );
}

