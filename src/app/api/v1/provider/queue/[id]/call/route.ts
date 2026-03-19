/**
 * PATCH /api/v1/provider/queue/[id]/call — advance token status
 *
 * Body: { action: "call" | "done" | "skip" }
 *   call  → called
 *   done  → done
 *   skip  → skipped
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { opdTokens } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

const actionSchema = z.object({
  action: z.enum(["call", "done", "skip"]),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "hospital_admin", "doctor", "receptionist"]);
  if (forbidden) return forbidden;

  const { id } = await ctx!.params;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("SYS_UNHANDLED", "Validation error", parsed.error.issues[0]?.message ?? "Invalid action", 400);
  }

  const [token] = await db.select().from(opdTokens).where(eq(opdTokens.id, id)).limit(1);
  if (!token) throw new AppError("DB_NOT_FOUND", "Not found", "Token not found.", 404);

  if (auth.role === "hospital_admin" && auth.entityId && token.providerId !== auth.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage your own hospital's queue.", 403);
  }

  const now = new Date();
  const { action } = parsed.data;

  const statusMap = { call: "called", done: "done", skip: "skipped" } as const;
  const newStatus = statusMap[action];

  await db
    .update(opdTokens)
    .set({
      status: newStatus,
      calledAt: action === "call" ? now : token.calledAt,
      doneAt: action === "done" ? now : token.doneAt,
    })
    .where(eq(opdTokens.id, id));

  return NextResponse.json({ data: { id, status: newStatus } });
});
