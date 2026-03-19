/**
 * Appointment payment service.
 *
 * Pay Now flow:
 *   1. Hospital accepts audio/video appointment and sets a fee > 0
 *   2. paymentStatus becomes "pending" → patient sees "Pay Now" button
 *   3. Patient clicks Pay Now → confirmPatientPayment() is called
 *   4. For now: records payment as "paid" (stub — integrate Razorpay in future)
 *
 * To integrate Razorpay:
 *   - Add createRazorpayOrder() here that returns an order_id
 *   - Route calls createRazorpayOrder, returns order to client
 *   - Client completes Razorpay checkout, then calls verifyAndConfirmPayment()
 *   - verifyAndConfirmPayment() validates signature and marks paid
 *
 * To add other payment providers (Stripe, PhonePe, etc.):
 *   - Add a provider in src/lib/payments/ following the existing interface pattern
 *   - Wire it here
 */

import { AppError } from "@/lib/errors/app-error";
import { findAppointmentById, updateAppointment } from "./queries";
import { isRemoteType } from "./types";

export interface PaymentConfirmResult {
  appointmentId: string;
  paymentStatus: "paid";
  meetingUrl: string | null;
}

/**
 * Confirm payment for an audio/video appointment.
 * Only succeeds when:
 *   - Appointment belongs to the patient
 *   - Type is audio or video (not in-person)
 *   - Status is "confirmed"
 *   - paymentStatus is "pending" (hospital set a fee > 0)
 */
export async function confirmPatientPayment(
  appointmentId: string,
  patientId: string,
): Promise<PaymentConfirmResult> {
  const appt = await findAppointmentById(appointmentId);
  if (!appt) throw new AppError("DB_NOT_FOUND", "Not found", "Appointment not found.", 404);
  if (appt.patientId !== patientId) throw new AppError("AUTH_FORBIDDEN", "Forbidden", "Not your appointment.", 403);
  if (!isRemoteType(appt.type)) {
    throw new AppError("SYS_UNHANDLED", "Invalid", "In-person appointments do not require payment.", 400);
  }
  if (appt.status !== "confirmed") {
    throw new AppError("SYS_UNHANDLED", "Not confirmed", "Appointment must be confirmed by the hospital before payment.", 409);
  }
  if (appt.paymentStatus !== "pending") {
    const msg = appt.paymentStatus === "paid"
      ? "This appointment has already been paid."
      : "Payment is not required for this appointment.";
    throw new AppError("SYS_UNHANDLED", "Payment not required", msg, 409);
  }

  // --- Razorpay integration point ---
  // const order = await razorpay.orders.create({ amount: appt.consultationFee * 100, currency: "INR", ... })
  // return { orderId: order.id, amount: appt.consultationFee, ... }
  // ---

  await updateAppointment(appointmentId, { paymentStatus: "paid" });

  return {
    appointmentId,
    paymentStatus: "paid",
    meetingUrl: appt.meetingUrl,
  };
}
