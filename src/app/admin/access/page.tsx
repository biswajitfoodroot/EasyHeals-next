import { redirect } from "next/navigation";

import AccessTabContent from "@/app/admin/AccessTabContent";
import { getAuthFromCookies } from "@/lib/auth";

export default async function AccessPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");
  if (auth.role !== "owner" && auth.role !== "admin") redirect("/admin");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Access & User Management</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage roles, permissions, and user accounts across EasyHeals.
        </p>
      </div>
      <AccessTabContent me={{ role: auth.role }} />
    </div>
  );
}
