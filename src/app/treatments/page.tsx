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
  const { and, notInArray } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(taxonomyNodes)
    .where(and(
      eq(taxonomyNodes.isActive, true),
      notInArray(taxonomyNodes.type, ["service", "symptom"]),
    ))
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
