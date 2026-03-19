import { redirect } from "next/navigation";

import { AuditLogClient } from "@/app/admin/audit-log/AuditLogClient";
import { getAuthFromCookies } from "@/lib/auth";

export default async function AuditLogPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");

  const allowedRoles = ["owner", "admin", "advisor"];
  if (!allowedRoles.includes(auth.role)) redirect("/admin");

  return (
    <AuditLogClient
      me={{ role: auth.role, userId: auth.userId }}
    />
  );
}
