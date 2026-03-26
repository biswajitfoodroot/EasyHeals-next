import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ProviderEditClient from "./ProviderEditClient";

export const metadata = { title: "Edit Provider | EasyHeals Provider Management" };

export default async function ProviderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [hospital] = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      phone: hospitals.phone,
      email: hospitals.email,
      website: hospitals.website,
      description: hospitals.description,
      isActive: hospitals.isActive,
      verified: hospitals.verified,
      packageTier: hospitals.packageTier,
      regStatus: hospitals.regStatus,
      contactPerson: hospitals.contactPerson,
      contactPhone: hospitals.contactPhone,
      contactEmail: hospitals.contactEmail,
      addressLine1: hospitals.addressLine1,
    })
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!hospital) notFound();

  return <ProviderEditClient hospital={hospital} />;
}
