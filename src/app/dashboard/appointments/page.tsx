import type { Metadata } from "next";
import AppointmentsClient from "./AppointmentsClient";

export const metadata: Metadata = {
  title: "My Appointments | EasyHeals",
  description: "View and manage your healthcare appointments.",
};

export default function AppointmentsPage() {
  return <AppointmentsClient />;
}
