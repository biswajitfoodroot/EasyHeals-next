/**
 * PATCH /api/v1/emr/lab-orders/:id/result
 *
 * P3 Day 4 — Lab result upload by hospital/lab staff.
 *
 * Auth:   admin/owner/advisor (hospital staff — no "lab" role exists yet)
 * Gate:   lab_test_ordering feature flag must be ON
 *
 * Sets:   resultUrl, resultUploadedAt, resultUploadedBy, status → completed
 * The resultUrl is an S3/Blob URL uploaded by the hospital portal.
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { getFeatureFlag } from "@/lib/config/feature-flags";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

import { emrDb, labOrders } from "@/lib/emr";

const resultSchema = z.object({
  resultUrl: z.string().url(),
  notes: z.string().max(1000).optional(),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  if (!await getFeatureFlag("lab_test_ordering")) {
    throw new AppError("SYS_CONFIG_MISSING", "Lab ordering not available", "Lab test ordering is not yet enabled.", 503);
  }
  if (!emrDb) {
    throw new AppError("SYS_CONFIG_MISSING", "EMR DB not configured", "NEON_DATABASE_URL is not set.", 503);
  }

  const { id } = await ctx!.params;

  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) throw new AppError("SYS_UNHANDLED", "Invalid body", "Invalid request body", 400);

  const parsed = resultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Validation error", 400);
  }

  const { resultUrl } = parsed.data;

  // Verify order exists
  const existing = await emrDb
    .select({ id: labOrders.id, status: labOrders.status, patientId: labOrders.patientId })
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);

  if (!existing.length) {
    throw new AppError("DB_NOT_FOUND", "Lab order not found", "Lab order not found.", 404);
  }

  if (existing[0].status === "cancelled") {
    throw new AppError("SYS_UNHANDLED", "Order cancelled", "Cannot upload results for a cancelled lab order.", 409);
  }

  const now = new Date();
  await emrDb
    .update(labOrders)
    .set({
      resultUrl,
      resultUploadedAt: now,
      resultUploadedBy: auth.userId,
      status: "completed",
    })
    .where(eq(labOrders.id, id));

  return NextResponse.json({
    data: {
      orderId: id,
      patientId: existing[0].patientId,
      status: "completed",
      resultUrl,
      resultUploadedAt: now.toISOString(),
      uploadedBy: auth.userId,
    },
  });
});
