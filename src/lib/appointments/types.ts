/**
 * Shared appointment types used across service, API routes, and UI.
 * Extend this file when adding new appointment features.
 */

export type AppointmentType = "in_person" | "audio_consultation" | "video_consultation";
export type AppointmentStatus = "requested" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "none" | "pending" | "paid" | "waived";
export type ProviderAction = "accept" | "reject" | "complete";
export type PatientAction = "pay";

export function isRemoteType(type: string): boolean {
  return type === "audio_consultation" || type === "video_consultation" || type === "online_consultation";
}

export function typeLabel(type: string): string {
  if (type === "audio_consultation") return "Audio Call";
  if (type === "video_consultation" || type === "online_consultation") return "Video Call";
  return "In-Person";
}

export function typeIcon(type: string): string {
  if (type === "audio_consultation") return "📞";
  if (type === "video_consultation" || type === "online_consultation") return "🎥";
  return "🏥";
}
