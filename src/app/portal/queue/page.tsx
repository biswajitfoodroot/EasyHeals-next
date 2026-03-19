import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import QueueClient from "./QueueClient";

export const metadata = { title: "OPD Queue | EasyHeals Portal" };

export default async function QueuePage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/portal/login");
  if (!["hospital_admin", "doctor", "receptionist", "owner", "admin"].includes(auth.role)) redirect("/portal/login");

  return (
    <QueueClient
      userRole={auth.role}
      providerId={auth.entityId ?? undefined}
      doctorId={auth.role === "doctor" ? (auth.entityId ?? undefined) : undefined}
    />
  );
}
