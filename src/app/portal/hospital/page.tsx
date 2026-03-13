import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import HospitalPortalClient from "./HospitalPortalClient";

type Props = { searchParams: Promise<Record<string, string>> };

export default async function HospitalPortalPage({ searchParams }: Props) {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");
  if (auth.role !== "hospital_admin" && !["owner", "admin", "advisor"].includes(auth.role)) {
    redirect("/portal/login");
  }
  if (!auth.entityId) redirect("/portal/login");

  const [hospital] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, auth.entityId))
    .limit(1);

  if (!hospital) redirect("/portal/login");

  const params = await searchParams;
  const welcome = params.welcome === "1";

  return <HospitalPortalClient hospital={hospital as Record<string, unknown>} welcome={welcome} />;
}
