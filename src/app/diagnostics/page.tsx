import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";

import { db } from "@/db/client";
import { taxonomyNodes } from "@/db/schema";
import { buildMetadata } from "@/lib/seo";
import { DiagnosticsClient } from "./DiagnosticsClient";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Pathology Tests & Radiology Imaging | Diagnostics | EasyHeals India",
  description:
    "Book pathology lab tests and radiology imaging near you — blood tests, urine tests, MRI, CT scan, X-ray, ultrasound, PET scan, biopsy and more. Find verified diagnostic centres across 50+ cities in India.",
  path: "/diagnostics",
});

export default async function DiagnosticsPage() {
  const rows = await db
    .select()
    .from(taxonomyNodes)
    .where(
      inArray(taxonomyNodes.type, ["pathology", "radiology"]),
    )
    .orderBy(asc(taxonomyNodes.type), asc(taxonomyNodes.title));

  const pathology = rows.filter(r => r.type === "pathology");
  const radiology = rows.filter(r => r.type === "radiology");

  return (
    <DiagnosticsClient
      pathology={pathology}
      radiology={radiology}
      totalCount={rows.length}
    />
  );
}
