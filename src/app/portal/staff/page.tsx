import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import StaffClient from "./StaffClient";

export const metadata = { title: "Staff Management | EasyHeals Portal" };

export default async function StaffPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/portal/login");
  if (!["hospital_admin", "owner", "admin"].includes(auth.role)) redirect("/portal/hospital/dashboard");

  return (
    <StaffClient
      userRole={auth.role}
      providerId={auth.entityId ?? undefined}
    />
  );
}
