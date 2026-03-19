/**
 * Provider-side appointment actions service.
 * All business logic for accept / reject / complete lives here.
 * Route handlers just call these functions and return the result.
 *
 * To add a new action (e.g. "reschedule"):
 *   1. Add to ProviderActionInput union
 *   2. Add handler function + wire in executeProviderAction()
 */

import { AppError } from "@/lib/errors/app-error";
import { findAppointmentById, updateAppointment } from "./queries";
import type { ProviderAction } from "./types";
import { isRemoteType } from "./types";

export interface AcceptInput {
  action: "accept";
  consultationFee?: number; // Set by hospital — enables Pay Now for patient
  meetingUrl?: string;       // Google Meet / Jitsi / Zoom link
}

export interface RejectInput {
  action: "reject";
  reason?: string;
}

export interface CompleteInput {
  action: "complete";
}

export type ProviderActionInput = AcceptInput | RejectInput | CompleteInput;

export interface ProviderActionResult {
  appointmentId: string;
  newStatus: string;
  paymentStatus?: string;
  meetingUrl?: string | null;
}

/**
 * Execute a provider action on an appointment.
 * Validates ownership + state transition before writing to DB.
 */
export async function executeProviderAction(
  appointmentId: string,
  input: ProviderActionInput,
  actor: { role: string; entityId?: string | null },
): Promise<ProviderActionResult> {
  const appt = await findAppointmentById(appointmentId);
  if (!appt) throw new AppError("DB_NOT_FOUND", "Not found", "Appointment not found.", 404);

  // Ownership checks
  if (actor.role === "hospital_admin" && actor.entityId && appt.hospitalId !== actor.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage appointments for your hospital.", 403);
  }
  if (actor.role === "doctor" && actor.entityId && appt.doctorId !== actor.entityId) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "You can only manage your own appointments.", 403);
  }

  const now = new Date();

  if (input.action === "accept") {
    if (appt.status !== "requested") {
      throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot accept appointment with status: ${appt.status}`, 409);
    }
    const remote = isRemoteType(appt.type);
    const fee = input.consultationFee;
    // paymentStatus:
    //   - non-remote → "none" (no payment needed)
    //   - remote, fee not set or 0 → "waived" (free)
    //   - remote, fee > 0 → "pending" (Pay Now enabled for patient)
    const paymentStatus = !remote
      ? "none"
      : (fee !== undefined && fee > 0 ? "pending" : "waived");

    await updateAppointment(appointmentId, {
      status: "confirmed",
      confirmedAt: now,
      ...(remote && fee !== undefined ? { consultationFee: fee } : {}),
      paymentStatus,
      ...(input.meetingUrl ? { meetingUrl: input.meetingUrl } : {}),
    });

    return {
      appointmentId,
      newStatus: "confirmed",
      paymentStatus,
      meetingUrl: input.meetingUrl ?? null,
    };
  }

  if (input.action === "reject") {
    if (!["requested", "confirmed"].includes(appt.status)) {
      throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot reject appointment with status: ${appt.status}`, 409);
    }
    await updateAppointment(appointmentId, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: input.reason ?? "Rejected by provider",
    });
    return { appointmentId, newStatus: "cancelled" };
  }

  if (input.action === "complete") {
    if (appt.status !== "confirmed") {
      throw new AppError("SYS_UNHANDLED", "Invalid transition", `Cannot complete appointment with status: ${appt.status}`, 409);
    }
    await updateAppointment(appointmentId, { status: "completed", completedAt: now });
    return { appointmentId, newStatus: "completed" };
  }

  throw new AppError("SYS_UNHANDLED", "Invalid action", "Unknown action.", 400);
}
