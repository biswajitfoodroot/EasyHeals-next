import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { hospitals, providerAgreements } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import HospitalDashboardClient from "./HospitalDashboardClient";

export const metadata = { title: "Hospital Dashboard | EasyHeals Portal" };

export default async function HospitalDashboardPage() {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");

  if (auth.role !== "hospital_admin") redirect("/portal/login");

  let hospitalName: string | undefined;
  let hasActiveAgreement = false;
  let pendingAgreement: { id: string; agreementType: string; status: string; publishedAt: string | null } | null = null;

  if (auth.entityId) {
    const [hospResult, agreementRows] = await Promise.all([
      db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, auth.entityId)).limit(1),
      db.select({
        id: providerAgreements.id,
        agreementType: providerAgreements.agreementType,
        status: providerAgreements.status,
        publishedAt: providerAgreements.publishedAt,
      }).from(providerAgreements)
        .where(eq(providerAgreements.hospitalId, auth.entityId))
        .limit(5),
    ]);

    hospitalName = hospResult[0]?.name;
    hasActiveAgreement = agreementRows.some(a => a.status === "accepted");
    const raw = agreementRows.find(a => a.status === "published") ?? null;
    pendingAgreement = raw ? { ...raw, publishedAt: raw.publishedAt ? new Date(raw.publishedAt).toISOString() : null } : null;
  }

  return (
    <HospitalDashboardClient
      userFullName={auth.fullName}
      userRole={auth.role}
      hospitalId={auth.entityId ?? undefined}
      hospitalName={hospitalName}
      hasActiveAgreement={hasActiveAgreement}
      pendingAgreement={pendingAgreement}
    />
  );
}
