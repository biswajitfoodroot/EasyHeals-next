import { AdminPatientsTab } from "@/app/admin/AdminPatientsTab";

export const metadata = { title: "Patients | EasyHeals Provider Management" };

export default async function PatientsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">All Patients</h1>
        <p className="text-sm text-slate-400">Platform-wide patient records and operations oversight</p>
      </div>

      <AdminPatientsTab />
    </div>
  );
}
