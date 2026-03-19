import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  ingestionFieldConfidences,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/lib/audit";

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => {
  const { id } = await ctx!.params;

  const auth = await getAuthContext(req);
  if (!auth) {
    throw new AppError("AUTH_FORBIDDEN", "Not authenticated", "You must be logged in to perform moderation actions.", 401);
  }

  if (auth.role !== "admin" && auth.role !== "advisor" && auth.role !== "owner") {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You do not have permission to reject moderation items.", 403);
  }

  const payload = await req.json().catch(() => ({}));
  const parsed = rejectSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", "Validation error", 400);
  }

  // Find candidate by ID
  const confidences = await db
    .select()
    .from(ingestionFieldConfidences)
    .where(eq(ingestionFieldConfidences.id, id))
    .limit(1);

  if (!confidences.length) {
    throw new AppError("DB_NOT_FOUND", "Moderation candidate not found", "Item not found", 404);
  }

  const record = confidences[0];

  // Update Moderation queue
  const now = new Date();
  await db
    .update(ingestionFieldConfidences)
    .set({
      reviewStatus: "rejected",
      reviewedByUserId: auth.userId,
      reviewedAt: now,
    })
    .where(eq(ingestionFieldConfidences.id, id));

  // Audit Log
  await writeAuditLog({
    actorUserId: auth.userId,
    action: "reject_ingestion_field",
    entityType: "ingestionFieldConfidences",
    entityId: id,
    changes: {
      fromStatus: record.reviewStatus,
      toStatus: "rejected",
      reason: parsed.data.reason
    }
  });

  return NextResponse.json({
    entityId: record.entityId,
    status: "rejected"
  });
});
