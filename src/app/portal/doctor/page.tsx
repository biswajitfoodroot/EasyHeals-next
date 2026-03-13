import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { doctors } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import DoctorPortalClient from "./DoctorPortalClient";

export default async function DoctorPortalPage() {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");
  if (auth.role !== "doctor" && !["owner", "admin", "advisor"].includes(auth.role)) {
    redirect("/portal/login");
  }
  if (!auth.entityId) redirect("/portal/login");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, auth.entityId))
    .limit(1);

  if (!doctor) redirect("/portal/login");

  return <DoctorPortalClient doctor={doctor as Record<string, unknown>} />;
}
