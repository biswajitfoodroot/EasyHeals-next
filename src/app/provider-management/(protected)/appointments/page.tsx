import { AdminAppointmentsTab } from "@/app/admin/AdminAppointmentsTab";

export const metadata = { title: "Appointments | EasyHeals Provider Management" };

export default async function AppointmentsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">All Appointments</h1>
        <p className="text-sm text-slate-400">Platform-wide appointment oversight and operations</p>
      </div>

      <AdminAppointmentsTab />
    </div>
  );
}
