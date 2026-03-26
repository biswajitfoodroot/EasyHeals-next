import { db } from "@/db/client";
import { providerAgreements, hospitals, doctors } from "@/db/schema";
import { eq, desc, or, isNotNull } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import AgreementsClient from "./AgreementsClient";

export const metadata = { title: "Agreements | EasyHeals Provider Management" };

export default async function AgreementsPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");

  // Fetch all agreements with hospital/doctor names
  const rows = await db
    .select({
      id: providerAgreements.id,
      status: providerAgreements.status,
      agreementType: providerAgreements.agreementType,
      tierCode: providerAgreements.tierCode,
      entityType: providerAgreements.entityType,
      termsVersion: providerAgreements.termsVersion,
      publishedAt: providerAgreements.publishedAt,
      acceptedAt: providerAgreements.acceptedAt,
      rejectedAt: providerAgreements.rejectedAt,
      rejectionReason: providerAgreements.rejectionReason,
      expiresAt: providerAgreements.expiresAt,
      createdAt: providerAgreements.createdAt,
      hospitalId: providerAgreements.hospitalId,
      doctorId: providerAgreements.doctorId,
      hospitalName: hospitals.name,
      doctorName: doctors.fullName,
    })
    .from(providerAgreements)
    .leftJoin(hospitals, eq(hospitals.id, providerAgreements.hospitalId))
    .leftJoin(doctors, eq(doctors.id, providerAgreements.doctorId))
    .orderBy(desc(providerAgreements.createdAt))
    .limit(100);

  const agreements = rows.map(r => ({
    ...r,
    providerName: r.hospitalName ?? r.doctorName ?? "Unknown",
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    acceptedAt: r.acceptedAt ? new Date(r.acceptedAt).toISOString() : null,
    rejectedAt: r.rejectedAt ? new Date(r.rejectedAt).toISOString() : null,
    expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }));

  return <AgreementsClient agreements={agreements} />;
}
