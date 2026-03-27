import { PMAppointmentsClient } from "./PMAppointmentsClient";

export const metadata = { title: "Appointments | EasyHeals Provider Management" };

export default async function AppointmentsPage() {
  return <PMAppointmentsClient />;
}
