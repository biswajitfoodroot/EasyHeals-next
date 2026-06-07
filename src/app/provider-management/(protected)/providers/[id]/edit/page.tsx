import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ProviderEditClient from "./ProviderEditClient";

export const metadata = { title: "Edit Provider | EasyHeals Provider Management" };

export default async function ProviderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await getAuthFromCookies();
  // Layout already enforces auth; this is a belt-and-suspenders guard
  if (!auth) notFound();

  const [hospital] = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      slug: hospitals.slug,
      type: hospitals.type,
      description: hospitals.description,
      // Contact
      phone: hospitals.phone,
      phones: hospitals.phones,
      email: hospitals.email,
      emailIds: hospitals.emailIds,
      website: hospitals.website,
      whatsappBusinessNumber: hospitals.whatsappBusinessNumber,
      // Contact person
      contactPerson: hospitals.contactPerson,
      contactPhone: hospitals.contactPhone,
      contactEmail: hospitals.contactEmail,
      // Location
      addressLine1: hospitals.addressLine1,
      city: hospitals.city,
      state: hospitals.state,
      country: hospitals.country,
      latitude: hospitals.latitude,
      longitude: hospitals.longitude,
      // Medical profile
      specialties: hospitals.specialties,
      facilities: hospitals.facilities,
      accreditations: hospitals.accreditations,
      workingHours: hospitals.workingHours,
      feesRange: hospitals.feesRange,
      // Operational
      slotDurationMinutes: hospitals.slotDurationMinutes,
      maxDailyAppointments: hospitals.maxDailyAppointments,
      queueEnabled: hospitals.queueEnabled,
      // Status
      isActive: hospitals.isActive,
      isPrivate: hospitals.isPrivate,
      verified: hospitals.verified,
      packageTier: hospitals.packageTier,
      regStatus: hospitals.regStatus,
      // Metadata
      createdAt: hospitals.createdAt,
      updatedAt: hospitals.updatedAt,
    })
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!hospital) notFound();

  return (
    <ProviderEditClient
      hospital={hospital}
      userRole={auth.role}
    />
  );
}
