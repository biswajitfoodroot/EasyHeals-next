import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users, coordinatorPermissions } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import CoordinatorsClient from "./CoordinatorsClient";

export const metadata = { title: "Care Coordinators | EasyHeals Provider Management" };

export default async function CoordinatorsPage() {
  const auth = await getAuthFromCookies();
  if (!auth || !["owner", "admin"].includes(auth.role)) redirect("/provider-management");

  // Get all coordinator role users
  const coordinatorUsers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isActive, true));

  const allPerms = await db.select().from(coordinatorPermissions);
  const permsMap = new Map(allPerms.map(p => [p.userId, p]));

  // Only show users who have coordinator_permissions or are coordinator role
  const coordinators = coordinatorUsers
    .filter(u => permsMap.has(u.id))
    .map(u => ({
      ...u,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      permissions: permsMap.get(u.id)!,
    }));

  // All active users (for assigning permissions to)
  const allUsers = coordinatorUsers.map(u => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Care Coordinators</h1>
        <p className="text-sm text-slate-400">Configure per-person access permissions for coordinator users</p>
      </div>
      <CoordinatorsClient coordinators={coordinators} allUsers={allUsers} />
    </div>
  );
}
