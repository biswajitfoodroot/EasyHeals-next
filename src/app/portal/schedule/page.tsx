import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import ScheduleClient from "./ScheduleClient";

export const metadata = { title: "Schedule Management | EasyHeals Portal" };

export default async function SchedulePage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/portal/login");
  if (!["hospital_admin", "doctor", "owner", "admin"].includes(auth.role)) redirect("/portal/login");

  return (
    <ScheduleClient
      userRole={auth.role}
      entityId={auth.entityId ?? undefined}
      userFullName={auth.fullName}
    />
  );
}
