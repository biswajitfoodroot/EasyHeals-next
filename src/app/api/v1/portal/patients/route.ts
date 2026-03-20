/**
 * GET /api/v1/portal/patients
 *
 * Patient history for hospital/doctor portal.
 *
 * Access control:
 *   doctor       → patients who have had appointments with them
 *   hospital_admin → patients with appointments at their hospital
 *   admin/owner/advisor → all patients (with ?hospitalId or ?doctorId filter)
 *
 * Response shape respects access level:
 *   metadata only: displayAlias, lastApptAt, department, doctor, testTypes
 *   full (doctor or explicit grant): + documents list (not content, just metadata)
 *
 * DPDP compliance: raw phone never returned. patientId is an internal ref.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { appointments, doctors, hospitals, patients } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin", "doctor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limitParam = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  const hospitalId =
    auth.role === "hospital_admin"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("hospitalId") ?? undefined);

  const doctorId =
    auth.role === "doctor"
      ? (auth.entityId ?? undefined)
      : (url.searchParams.get("doctorId") ?? undefined);

  if (!hospitalId && !doctorId && !["owner", "admin", "advisor"].includes(auth.role)) {
    throw new AppError("AUTH_FORBIDDEN", "Forbidden", "No entity scope.", 403);
  }

  // Build appointment conditions
  const conditions = [];
  if (doctorId)   conditions.push(eq(appointments.doctorId, doctorId));
  if (hospitalId) conditions.push(eq(appointments.hospitalId, hospitalId));

  // Get distinct patients who had appointments with this provider
  const apptRows = await db
    .select({
      patientId: appointments.patientId,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      type: appointments.type,
      doctorId: appointments.doctorId,
      doctorName: doctors.fullName,
      hospitalId: appointments.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .leftJoin(hospitals, eq(hospitals.id, appointments.hospitalId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(appointments.scheduledAt))
    .limit(limitParam * 10); // over-fetch to dedupe

  // Group by patient, keep most recent appointment per patient
  const patientMap = new Map<string, {
    patientId: string;
    lastApptAt: Date | null;
    lastApptStatus: string;
    lastDoctorName: string | null;
    lastHospitalName: string | null;
    appointmentCount: number;
    types: Set<string>;
    doctorNames: Set<string>;
  }>();

  for (const row of apptRows) {
    const existing = patientMap.get(row.patientId);
    if (!existing) {
      patientMap.set(row.patientId, {
        patientId: row.patientId,
        lastApptAt: row.scheduledAt,
        lastApptStatus: row.status,
        lastDoctorName: row.doctorName,
        lastHospitalName: row.hospitalName,
        appointmentCount: 1,
        types: new Set([row.type]),
        doctorNames: new Set(row.doctorName ? [row.doctorName] : []),
      });
    } else {
      existing.appointmentCount++;
      existing.types.add(row.type);
      if (row.doctorName) existing.doctorNames.add(row.doctorName);
    }
  }

  const uniquePatientIds = [...patientMap.keys()].slice(0, limitParam);

  if (uniquePatientIds.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Fetch patient meta (alias only — no PII)
  const patientRows = await db
    .select({
      id: patients.id,
      displayAlias: patients.displayAlias,
      city: patients.city,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(inArray(patients.id, uniquePatientIds));

  const patientMeta = new Map(patientRows.map((p) => [p.id, p]));

  const result = uniquePatientIds.map((pid) => {
    const apptInfo = patientMap.get(pid)!;
    const meta = patientMeta.get(pid);
    return {
      patientId: pid,
      displayAlias: meta?.displayAlias ?? `Patient #${pid.slice(0, 6)}`,
      city: meta?.city ?? null,
      lastApptAt: apptInfo.lastApptAt,
      lastApptStatus: apptInfo.lastApptStatus,
      lastDoctorName: apptInfo.lastDoctorName,
      lastHospitalName: apptInfo.lastHospitalName,
      appointmentCount: apptInfo.appointmentCount,
      consultationTypes: [...apptInfo.types],
      treatingDoctors: [...apptInfo.doctorNames],
    };
  });

  return NextResponse.json({
    data: result,
    total: result.length,
  });
});
