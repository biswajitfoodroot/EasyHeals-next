import type { Metadata } from "next";

import { DirectorySearchList } from "@/components/profiles/DirectorySearchList";
import { listHospitalsDirectory } from "@/lib/profile-data";
import { buildMetadata, buildItemListJsonLd, absoluteUrl } from "@/lib/seo";
import { normalizeCityName } from "@/lib/strings";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Find Verified Hospitals in India | Book Appointments | EasyHeals",
  description: "Discover verified private hospitals with intelligent filters, map-ready profiles, and doctor affiliations.",
  path: "/hospitals",
});

export default async function HospitalsPage() {
  const rows = await listHospitalsDirectory(1000);
  const cityOptions = Array.from(new Set(rows.map((item) => normalizeCityName(item.city)))).sort((a, b) => a.localeCompare(b));

  const jsonLd = buildItemListJsonLd(
    rows.map((row) => ({
      name: row.name,
      url: `/hospitals/${row.slug}`,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DirectorySearchList
        kind="hospital"
        cityOptions={cityOptions}
        items={rows.map((row) => ({
          id: row.id,
          name: row.name,
          city: normalizeCityName(row.city),
          state: row.state,
          specialties: row.specialties,
          rating: row.rating,
          reviewCount: row.reviewCount,
          verified: row.verified,
          // Card truncates to 70 chars; trim server-side to keep the SSR payload small.
          subtitle: row.description && row.description.length > 90 ? row.description.slice(0, 90) : row.description,
          url: `/hospitals/${row.slug}`,
          networkTierCode: row.networkTierCode,
        }))}
      />
    </>
  );
}

