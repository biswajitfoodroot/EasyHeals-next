/**
 * PATCH /api/v1/provider/staff/[id] — update subRole or toggle active
 *
 * Auth: hospital_admin (own hospital), owner/admin
 * Body: { subRole?: "receptionist"|"billing", isActive?: boolean }
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { providerStaff } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const patchSchema = z.object({
  subRole: z.enum(["receptionist", "billing"]).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin"]);
  if (forbidden) return forbidden;

  const { id } = await ctx!.params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const [row] = await db.select({ providerId: providerStaff.providerId }).from(providerStaff).where(eq(providerStaff.id, id)).limit(1);
  if (!row) throw new AppError("DB_NOT_FOUND", "Not found", "Staff member not found.", 404);

  if (auth.role === "hospital_admin" && auth.entityId !== row.providerId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage your own hospital's staff.", 403);
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.subRole !== undefined) updateData.subRole = parsed.data.subRole;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  await db.update(providerStaff).set(updateData).where(eq(providerStaff.id, id));

  return NextResponse.json({ data: { id, ...updateData } });
});
