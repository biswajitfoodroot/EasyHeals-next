import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import HospitalDashboardClient from "./HospitalDashboardClient";

export const metadata = { title: "Hospital Dashboard | EasyHeals Portal" };

export default async function HospitalDashboardPage() {
  const auth = await getAuthFromCookies();

  if (!auth) redirect("/portal/login");

  const allowed = ["hospital_admin", "owner", "admin", "advisor"];
  if (!allowed.includes(auth.role)) redirect("/portal/login");

  return (
    <HospitalDashboardClient
      userFullName={auth.fullName}
      userRole={auth.role}
      hospitalId={auth.entityId ?? undefined}
    />
  );
}
