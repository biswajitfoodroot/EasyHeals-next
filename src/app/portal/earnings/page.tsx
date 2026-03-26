import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { providerAgreements } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import EarningsClient from "./EarningsClient";

export const metadata = { title: "Earnings | EasyHeals Portal" };

const PROVIDER_ROLES = ["hospital_admin", "doctor"];

export default async function EarningsPage() {
  const auth = await getAuthFromCookies();
  if (!auth || !PROVIDER_ROLES.includes(auth.role)) redirect("/portal/login");
  if (!auth.entityId) redirect("/portal/login");

  const entityFilter = auth.role === "doctor"
    ? eq(providerAgreements.doctorId, auth.entityId)
    : eq(providerAgreements.hospitalId, auth.entityId);

  const [agreement] = await db.select({ id: providerAgreements.id })
    .from(providerAgreements)
    .where(and(entityFilter, eq(providerAgreements.status, "accepted")))
    .limit(1);

  if (!agreement) {
    redirect(auth.role === "doctor" ? "/portal/doctor/dashboard" : "/portal/hospital/dashboard");
  }

  return (
    <EarningsClient
      userRole={auth.role}
      entityId={auth.entityId}
    />
  );
}
