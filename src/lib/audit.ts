import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

type AuditInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  changes?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    ipAddress: input.ipAddress,
    changes: input.changes as Record<string, unknown> | undefined,
  });
}
