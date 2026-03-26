import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import AccessTabContent from "@/app/admin/AccessTabContent";

export const metadata = { title: "Access & Users | EasyHeals Provider Management" };

const CAN_MANAGE_ACCESS = ["owner", "admin", "operator"];

export default async function AccessPage() {
  const auth = await getAuthFromCookies();

  if (!auth || !CAN_MANAGE_ACCESS.includes(auth.role)) {
    redirect("/provider-management");
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Access & Users</h1>
        <p className="text-sm text-slate-400">Manage operators, coordinators, and portal users</p>
      </div>

      <AccessTabContent me={{ role: auth.role }} />
    </div>
  );
}
