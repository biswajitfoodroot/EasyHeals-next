/**
 * Shared DB queries for appointments.
 * All direct Drizzle calls for appointments go here — routes just call these.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { appointments, appointmentSlots, doctors, hospitals } from "@/db/schema";
import type { AppointmentType, AppointmentStatus, PaymentStatus } from "./types";

export interface AppointmentRecord {
  id: string;
  patientId: string;
  hospitalId: string | null;
  doctorId: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  patientNotes: string | null;
  consentRecordId: string | null;
  sourcePlatform: string | null;
  slotId: string | null;
  consultationFee: number | null;
  paymentStatus: PaymentStatus;
  meetingUrl: string | null;
  createdAt: Date | null;
}

export async function findAppointmentById(id: string): Promise<AppointmentRecord | null> {
  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return rows[0] as AppointmentRecord ?? null;
}

export async function listAppointmentsForPatient(patientId: string, limit = 50) {
  return db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      confirmedAt: appointments.confirmedAt,
      completedAt: appointments.completedAt,
      cancelledAt: appointments.cancelledAt,
      cancellationReason: appointments.cancellationReason,
      patientNotes: appointments.patientNotes,
      createdAt: appointments.createdAt,
      consultationFee: appointments.consultationFee,
      paymentStatus: appointments.paymentStatus,
      meetingUrl: appointments.meetingUrl,
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      hospitalCity: hospitals.city,
      doctorId: doctors.id,
      doctorName: doctors.fullName,
    })
    .from(appointments)
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(eq(appointments.patientId, patientId))
    .orderBy(appointments.scheduledAt)
    .limit(limit);
}

export async function listAppointmentsForProvider(opts: {
  hospitalId?: string;
  doctorId?: string;
  statuses?: string[];
  limit?: number;
}) {
  const { hospitalId, doctorId, statuses, limit = 100 } = opts;
  const conditions = statuses?.length
    ? [inArray(appointments.status, statuses)]
    : [];
  if (hospitalId) conditions.push(eq(appointments.hospitalId, hospitalId));
  if (doctorId)   conditions.push(eq(appointments.doctorId, doctorId));

  return db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      confirmedAt: appointments.confirmedAt,
      completedAt: appointments.completedAt,
      cancelledAt: appointments.cancelledAt,
      patientNotes: appointments.patientNotes,
      sourcePlatform: appointments.sourcePlatform,
      createdAt: appointments.createdAt,
      consultationFee: appointments.consultationFee,
      paymentStatus: appointments.paymentStatus,
      meetingUrl: appointments.meetingUrl,
      hospitalId: hospitals.id,
      hospitalName: hospitals.name,
      slotStartsAt: appointmentSlots.startsAt,
      slotEndsAt: appointmentSlots.endsAt,
    })
    .from(appointments)
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .leftJoin(appointmentSlots, eq(appointmentSlots.id, appointments.slotId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(appointments.scheduledAt)
    .limit(limit);
}

export async function updateAppointment(
  id: string,
  values: Partial<{
    status: string;
    confirmedAt: Date;
    completedAt: Date;
    cancelledAt: Date;
    cancellationReason: string;
    consultationFee: number;
    paymentStatus: string;
    meetingUrl: string;
  }>,
) {
  await db.update(appointments).set(values).where(eq(appointments.id, id));
}
