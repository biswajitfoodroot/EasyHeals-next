/**
 * PATCH /api/v1/portal/appointments/[id]
 *
 * Provider actions:  accept (+ optional fee & meetingUrl) | reject | complete
 * Patient action:    pay   (marks paymentStatus=paid; only when hospital enabled it with a fee)
 *
 * Business logic lives in src/lib/appointments/ — this file is a thin HTTP adapter.
 *
 * Pay Now is enabled by the hospital/admin by setting consultationFee > 0 on accept.
 * If fee is 0 or omitted → appointment is free (paymentStatus="waived"), no payment step.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { executeProviderAction } from "@/lib/appointments/actions";
import { confirmPatientPayment } from "@/lib/appointments/payment";

// ── Request schema ─────────────────────────────────────────────────────────────

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    consultationFee: z.number().min(0).max(100000).optional(), // 0 or omit = free consultation
    meetingUrl: z.string().url().optional(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("complete"),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("pay"),
    reason: z.string().max(500).optional(),
  }),
]);

// ── Handler ────────────────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => {
  const { id: appointmentId } = await ctx!.params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      "SYS_UNHANDLED",
      "Validation error",
      parsed.error.issues[0]?.message ?? "Invalid action",
      400,
    );
  }

  const input = parsed.data;

  // ── Patient pay action ──────────────────────────────────────────────────────
  if (input.action === "pay") {
    let patientId: string;
    try {
      const sess = await requirePatientSession(req);
      patientId = sess.patientId;
    } catch {
      throw new AppError("AUTH_SESSION_EXPIRED", "Unauthorized", "Please log in to pay.", 401);
    }

    const result = await confirmPatientPayment(appointmentId, patientId);
    return NextResponse.json({
      data: result,
      message: "Payment confirmed. Your meeting link is now active.",
    });
  }

  // ── Provider actions (accept / reject / complete) ───────────────────────────
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "admin_manager", "doctor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const result = await executeProviderAction(
    appointmentId,
    input,
    { role: auth.role, entityId: auth.entityId },
  );

  return NextResponse.json({
    data: result,
    message: `Appointment ${input.action}ed successfully.`,
  });
});
