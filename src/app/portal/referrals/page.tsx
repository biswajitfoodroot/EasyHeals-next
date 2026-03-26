import { eq, and, or, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { providerAgreements, referralCases } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import ReferralsClient from "./ReferralsClient";

export const metadata = { title: "Referrals | EasyHeals Portal" };

const PROVIDER_ROLES = ["hospital_admin", "doctor"];

export default async function ReferralsPage() {
  const auth = await getAuthFromCookies();
  if (!auth || !PROVIDER_ROLES.includes(auth.role)) redirect("/portal/login");

  // Check active agreement
  if (!auth.entityId) redirect("/portal/login");

  const entityFilter = auth.role === "doctor"
    ? eq(providerAgreements.doctorId, auth.entityId)
    : eq(providerAgreements.hospitalId, auth.entityId);

  const [agreement] = await db.select({ id: providerAgreements.id, status: providerAgreements.status })
    .from(providerAgreements)
    .where(and(entityFilter, eq(providerAgreements.status, "accepted")))
    .limit(1);

  if (!agreement) {
    redirect(auth.role === "doctor" ? "/portal/doctor/dashboard" : "/portal/hospital/dashboard");
  }

  return (
    <ReferralsClient
      userRole={auth.role}
      entityId={auth.entityId}
      userId={auth.userId}
    />
  );
}
