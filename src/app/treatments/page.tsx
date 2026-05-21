import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";
import { TreatmentsClient } from "./TreatmentsClient";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Medical Treatments, Specialties & Procedures | EasyHeals India",
  description: "Browse 100+ medical treatments, specialties and procedures — Cardiology, Neurology, Orthopaedics, IVF, Knee Replacement, Dialysis, Cancer Care and more. Find verified hospitals and specialist doctors across India.",
  path: "/treatments",
});

export default async function TreatmentsPage() {
  const { and, inArray } = await import("drizzle-orm");
  const VALID_TYPES = ["specialty", "treatment", "pathology", "radiology", "procedure", "condition", "department"];
  // Select only the columns the client uses — skip the heavy JSON `metadata` column.
  const rows = await db
    .select({
      id: taxonomyNodes.id,
      slug: taxonomyNodes.slug,
      title: taxonomyNodes.title,
      description: taxonomyNodes.description,
      type: taxonomyNodes.type,
    })
    .from(taxonomyNodes)
    .where(and(
      eq(taxonomyNodes.isActive, true),
      inArray(taxonomyNodes.type, VALID_TYPES),
    ))
    .orderBy(asc(taxonomyNodes.type), asc(taxonomyNodes.title));

  // Truncate descriptions to keep the SSR payload small (client shows first ~100 chars only).
  const trimmed = rows.map((r) => ({
    ...r,
    description: r.description && r.description.length > 140 ? r.description.slice(0, 140) : r.description,
  }));

  const grouped: Record<string, typeof trimmed> = {};
  for (const row of trimmed) {
    (grouped[row.type] ??= []).push(row);
  }
  const types = Object.keys(grouped).sort();

  return (
    <TreatmentsClient
      grouped={grouped}
      types={types}
      totalCount={trimmed.length}
    />
  );
}
