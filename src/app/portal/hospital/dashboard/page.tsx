import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { hospitals } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import HospitalDashboardClient from "./HospitalDashboardClient";

export const metadata = { title: "Hospital Dashboard | EasyHeals Portal" };

export default async function HospitalDashboardPage() {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");

  const allowed = ["hospital_admin", "owner", "admin", "advisor"];
  if (!allowed.includes(auth.role)) redirect("/portal/login");

  let hospitalName: string | undefined;
  if (auth.entityId) {
    const [hosp] = await db
      .select({ name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.id, auth.entityId))
      .limit(1);
    hospitalName = hosp?.name;
  }

  return (
    <HospitalDashboardClient
      userFullName={auth.fullName}
      userRole={auth.role}
      hospitalId={auth.entityId ?? undefined}
      hospitalName={hospitalName}
    />
  );
}
