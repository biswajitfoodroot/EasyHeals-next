import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";
import { TreatmentsClient } from "./TreatmentsClient";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Treatments, Specialties & Procedures | EasyHeals",
  description: "Browse medical treatments, specialties and procedures. Find top hospitals and specialist doctors for any healthcare need across India.",
  path: "/treatments",
});

export default async function TreatmentsPage() {
  const rows = await db
    .select()
    .from(taxonomyNodes)
    .where(eq(taxonomyNodes.isActive, true))
    .orderBy(asc(taxonomyNodes.type), asc(taxonomyNodes.title));

  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    const type = row.type ?? "other";
    (grouped[type] ??= []).push(row);
  }
  const types = Object.keys(grouped).sort();

  return (
    <TreatmentsClient
      grouped={grouped}
      types={types}
      totalCount={rows.length}
    />
  );
}
