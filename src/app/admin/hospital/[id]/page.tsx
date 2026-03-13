import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";

import { HospitalAdminClient } from "@/app/admin/hospital/[id]/HospitalAdminClient";
import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";

type Props = { params: Promise<{ id: string }> };

export default async function HospitalAdminPage({ params }: Props) {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");

  const allowedRoles = ["owner", "admin", "advisor"];
  if (!allowedRoles.includes(auth.role)) redirect("/admin");

  const { id } = await params;
  const rows = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (!rows.length) notFound();

  const hospital = rows[0];

  return (
    <HospitalAdminClient
      hospital={hospital as Record<string, unknown>}
      me={{ role: auth.role, userId: auth.userId }}
    />
  );
}
