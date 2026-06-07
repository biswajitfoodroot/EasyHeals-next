import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import AdminDashboardClient from "@/app/admin/AdminDashboardClient";
import { db } from "@/db/client";
import { hospitals, taxonomyNodes } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";

const ADMIN_ROLES = ["owner", "admin", "admin_manager", "admin_editor", "advisor"];

export default async function AdminDashboardPage() {
  const auth = await getAuthFromCookies();
  if (!auth) redirect("/admin/login");
  if (!ADMIN_ROLES.includes(auth.role)) redirect("/");

  const [hospitalRows, nodeRows] = await Promise.all([
    db.select().from(hospitals).orderBy(desc(hospitals.createdAt)).limit(500),
    db.select().from(taxonomyNodes).orderBy(desc(taxonomyNodes.createdAt)).limit(100),
  ]);

  return (
    <Suspense>
      <AdminDashboardClient
        me={{ fullName: auth.fullName, email: auth.email, role: auth.role }}
        hospitals={hospitalRows}
        nodes={nodeRows}
      />
    </Suspense>
  );
}
