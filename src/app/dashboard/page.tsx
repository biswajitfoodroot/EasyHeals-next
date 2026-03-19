import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard | EasyHeals",
  description: "View your appointments, health records, and more.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
