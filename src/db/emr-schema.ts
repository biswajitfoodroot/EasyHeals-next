/**
 * src/db/emr-schema.ts
 *
 * P3 — EMR Postgres schema (Neon). PHI-isolated, never co-mingled with Turso.
 *
 * PRIVACY RULES:
 *   - diagnosis, chiefComplaint, notes, medicines, instructions
 *     are stored AES-256-GCM encrypted at rest (EMR_ENCRYPTION_KEY).
 *   - patientId, doctorId, hospitalId, appointmentId are cross-DB references
 *     (UUIDs from Turso) — no FK constraints (different DB), enforced at app layer.
 *   - All tables include created_at; PHI columns have a comment in DDL.
 *
 * Import rule (ARCHITECTURE.md §A.2):
 *   src/lib/emr/* MUST NOT import from any other src/lib/* module.
 *   emr-schema.ts is in src/db/ (shared infra) so it is safe to import from emr/*.
 */

import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () =>
  uuid("id")
    .primaryKey()
    .defaultRandom();

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 1: visit_records — doctor-created visit summary per appointment
// All PHI columns (diagnosis, chiefComplaint, notes) stored encrypted.
// ─────────────────────────────────────────────────────────────────────────────

export const visitRecords = pgTable(
  "visit_records",
  {
    id: id(),
    // Cross-DB references (Turso UUIDs — no FK constraint possible across DBs)
    patientId: text("patient_id").notNull(),        // patients.id (Turso)
    doctorId: text("doctor_id"),                    // doctors.id (Turso)
    hospitalId: text("hospital_id"),                // hospitals.id (Turso)
    appointmentId: text("appointment_id"),          // appointments.id (Turso)

    // PHI — stored AES-256-GCM encrypted with EMR_ENCRYPTION_KEY
    diagnosisEncrypted: text("diagnosis_encrypted"),       // encrypted JSON array of ICD-10 codes/labels
    chiefComplaintEncrypted: text("chief_complaint_encrypted"), // encrypted free text
    notesEncrypted: text("notes_encrypted"),               // encrypted doctor notes

    // Non-PHI metadata
    followUpDate: timestamp("follow_up_date"),
    followUpNotes: text("follow_up_notes"),                // non-PHI reminder notes
    isTeleconsultation: boolean("is_teleconsultation").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("visit_records_patient_idx").on(table.patientId),
    index("visit_records_doctor_idx").on(table.doctorId),
    index("visit_records_appointment_idx").on(table.appointmentId),
    index("visit_records_created_idx").on(table.createdAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 2: prescriptions — doctor-issued prescriptions linked to a visit
// medicines array is encrypted. Feeds P5 pharmacy routing.
// ─────────────────────────────────────────────────────────────────────────────

export interface Medicine {
  name: string;
  dosage: string;        // e.g. "500mg"
  frequency: string;     // e.g. "twice daily", "BD", "TDS"
  duration: string;      // e.g. "7 days"
  instructions?: string; // e.g. "after meals"
  genericName?: string;  // for pharmacy routing
}

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: id(),
    visitId: uuid("visit_id").references(() => visitRecords.id),
    patientId: text("patient_id").notNull(),    // cross-DB ref
    doctorId: text("doctor_id"),               // cross-DB ref
    hospitalId: text("hospital_id"),           // cross-DB ref

    // PHI — encrypted with EMR_ENCRYPTION_KEY
    medicinesEncrypted: text("medicines_encrypted").notNull(), // encrypted JSON: Medicine[]
    instructionsEncrypted: text("instructions_encrypted"),     // encrypted general instructions

    // Non-PHI metadata
    validUntil: timestamp("valid_until"),
    dispensed: boolean("dispensed").notNull().default(false),
    dispensedAt: timestamp("dispensed_at"),
    dispensedBy: text("dispensed_by"),  // pharmacist/hospital staff ID
    // P5: pharmacy routing
    pharmacyId: text("pharmacy_id"),            // preferred_pharmacy or patient-selected

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("prescriptions_patient_idx").on(table.patientId),
    index("prescriptions_visit_idx").on(table.visitId),
    index("prescriptions_created_idx").on(table.createdAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 3: vitals — patient vitals per visit or self-reported
// No encryption — numerical values are non-PHI without patient linkage context.
// However, patientId links them — stored in separate PHI DB accordingly.
// ─────────────────────────────────────────────────────────────────────────────

export const vitals = pgTable(
  "vitals",
  {
    id: id(),
    patientId: text("patient_id").notNull(),      // cross-DB ref
    visitId: uuid("visit_id").references(() => visitRecords.id), // nullable for self-reported
    recordedBy: text("recorded_by").notNull().default("patient"), // "patient" | "doctor" | "nurse"
    recordedById: text("recorded_by_id"),         // actorId (patientId or doctorId)

    // Vital signs — all nullable (not every reading captures all vitals)
    bloodPressureSystolic: integer("bp_systolic"),       // mmHg
    bloodPressureDiastolic: integer("bp_diastolic"),     // mmHg
    heartRateBpm: integer("heart_rate_bpm"),             // beats per minute
    weightKg: real("weight_kg"),                         // kilograms
    heightCm: real("height_cm"),                         // centimetres (for BMI)
    bloodSugarMgDl: real("blood_sugar_mg_dl"),           // mg/dL (fasting or random)
    bloodSugarType: text("blood_sugar_type"),            // "fasting" | "post_meal" | "random"
    oxygenSaturation: real("oxygen_saturation"),         // SpO2 % (0–100)
    temperatureCelsius: real("temperature_celsius"),     // °C

    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("vitals_patient_idx").on(table.patientId),
    index("vitals_visit_idx").on(table.visitId),
    index("vitals_recorded_idx").on(table.recordedAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 4: lab_orders — patient lab test orders (P3 Day 4)
// Stub defined here so migration is complete in one go.
// ─────────────────────────────────────────────────────────────────────────────

export const labOrders = pgTable(
  "lab_orders",
  {
    id: id(),
    patientId: text("patient_id").notNull(),
    doctorId: text("doctor_id"),
    hospitalId: text("hospital_id"),
    visitId: uuid("visit_id").references(() => visitRecords.id),
    consentRecordId: text("consent_record_id"),   // emr_access consent (Turso ref)

    tests: jsonb("tests").notNull().$type<{ testName: string; testCode?: string; notes?: string }[]>(),
    labName: text("lab_name"),
    status: text("status").notNull().default("ordered"), // ordered | sample_collected | processing | completed | cancelled
    resultUrl: text("result_url"),                // S3/Blob URL after upload
    resultUploadedAt: timestamp("result_uploaded_at"),
    resultUploadedBy: text("result_uploaded_by"),

    orderedAt: timestamp("ordered_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("lab_orders_patient_idx").on(table.patientId),
    index("lab_orders_status_idx").on(table.status),
  ],
);
