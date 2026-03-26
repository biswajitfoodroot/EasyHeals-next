import { db } from "@/db/client";
import { referralCases, hospitals, doctors } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReferralsOpsClient from "./ReferralsOpsClient";

export const metadata = { title: "Referrals | EasyHeals Provider Management" };

export default async function ReferralsOpsPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");

  const rows = await db
    .select({
      id: referralCases.id,
      referralCode: referralCases.referralCode,
      patientName: referralCases.patientName,
      patientPhone: referralCases.patientPhone,
      urgency: referralCases.urgency,
      status: referralCases.status,
      referralType: referralCases.referralType,
      clinicalCategory: referralCases.clinicalCategory,
      sourceType: referralCases.sourceType,
      destinationMode: referralCases.destinationMode,
      destinationCity: referralCases.destinationCity,
      createdAt: referralCases.createdAt,
      closedAt: referralCases.closedAt,
      referringOrgName: hospitals.name,
    })
    .from(referralCases)
    .leftJoin(hospitals, eq(hospitals.id, referralCases.referringOrganizationId))
    .orderBy(desc(referralCases.createdAt))
    .limit(200);

  return (
    <ReferralsOpsClient
      cases={rows.map(r => ({
        ...r,
        referringOrgName: r.referringOrgName ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : null,
      }))}
    />
  );
}
