import { desc, eq, and, gte, lte, like } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import PMauditLogClient from "./PMauditLogClient";

export const metadata = { title: "Audit Log | EasyHeals Provider Management" };

export default async function PMAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; from?: string; to?: string; limit?: string }>;
}) {
  await getAuthFromCookies(); // auth in layout

  const sp = await searchParams;
  const entity = sp.entity ?? "all";
  const actionFilter = sp.action ?? "";
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : null;
  const limit = Math.min(parseInt(sp.limit ?? "200", 10), 500);

  const conditions = [];
  if (entity !== "all") conditions.push(eq(auditLogs.entityType, entity));
  if (actionFilter) conditions.push(like(auditLogs.action, `%${actionFilter}%`));
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));

  const rawRows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorName: users.fullName,
      actorEmail: users.email,
      actorRole: users.role,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      ipAddress: auditLogs.ipAddress,
      changes: auditLogs.changes,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  const rows = rawRows.map(r => ({
    ...r,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }));

  // Distinct entity types for filter
  const entityTypes = await db
    .selectDistinct({ entityType: auditLogs.entityType })
    .from(auditLogs)
    .orderBy(auditLogs.entityType);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-400 mt-0.5">All provider management actions — agreements, commissions, referrals, KYC</p>
      </div>
      <PMauditLogClient
        rows={rows}
        entityTypes={entityTypes.map(e => e.entityType)}
        initialFilters={{ entity, action: actionFilter, from: sp.from ?? "", to: sp.to ?? "" }}
      />
    </div>
  );
}
