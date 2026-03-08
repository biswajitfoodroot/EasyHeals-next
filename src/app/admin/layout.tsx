import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "EasyHeals Next admin operations and CRM controls.",
  path: "/admin",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
