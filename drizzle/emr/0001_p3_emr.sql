-- ============================================================================
-- P3 Day 1 — EMR Postgres Migration (Neon)
-- Run against: NEON_DATABASE_URL (separate from Turso TURSO_DATABASE_URL)
--
-- Apply: psql $NEON_DATABASE_URL -f drizzle/emr/0001_p3_emr.sql
--   OR:  npx tsx drizzle/emr/apply-migration.ts
--
-- PHI NOTICE: All tables in this file contain Protected Health Information.
-- Access must be gated by emr_access consent purpose (DPDP Act 2023).
-- Column-level encryption via EMR_ENCRYPTION_KEY (separate from ENCRYPTION_KEY).
-- ============================================================================

-- Enable UUID extension (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 1: visit_records
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cross-DB references (Turso UUIDs — no FK constraints possible)
  patient_id                  TEXT NOT NULL,
  doctor_id                   TEXT,
  hospital_id                 TEXT,
  appointment_id              TEXT,

  -- PHI columns — AES-256-GCM encrypted with EMR_ENCRYPTION_KEY
  -- Encrypted value format: "iv:authTag:ciphertext" (base64 parts)
  diagnosis_encrypted         TEXT,          -- PHI: encrypted JSON ICD-10 array
  chief_complaint_encrypted   TEXT,          -- PHI: encrypted free text
  notes_encrypted             TEXT,          -- PHI: encrypted doctor notes

  -- Non-PHI metadata
  follow_up_date              TIMESTAMPTZ,
  follow_up_notes             TEXT,
  is_teleconsultation         BOOLEAN NOT NULL DEFAULT FALSE,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visit_records_patient_idx    ON visit_records(patient_id);
CREATE INDEX IF NOT EXISTS visit_records_doctor_idx     ON visit_records(doctor_id);
CREATE INDEX IF NOT EXISTS visit_records_appointment_idx ON visit_records(appointment_id);
CREATE INDEX IF NOT EXISTS visit_records_created_idx    ON visit_records(created_at DESC);

COMMENT ON COLUMN visit_records.diagnosis_encrypted    IS 'PHI — AES-256-GCM encrypted JSON ICD-10 array';
COMMENT ON COLUMN visit_records.chief_complaint_encrypted IS 'PHI — AES-256-GCM encrypted free text';
COMMENT ON COLUMN visit_records.notes_encrypted        IS 'PHI — AES-256-GCM encrypted doctor notes';

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 2: prescriptions
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id                    UUID REFERENCES visit_records(id),
  patient_id                  TEXT NOT NULL,
  doctor_id                   TEXT,
  hospital_id                 TEXT,

  -- PHI — AES-256-GCM encrypted
  medicines_encrypted         TEXT NOT NULL, -- PHI: encrypted JSON Medicine[]
  instructions_encrypted      TEXT,          -- PHI: encrypted general instructions

  -- Non-PHI
  valid_until                 TIMESTAMPTZ,
  dispensed                   BOOLEAN NOT NULL DEFAULT FALSE,
  dispensed_at                TIMESTAMPTZ,
  dispensed_by                TEXT,
  pharmacy_id                 TEXT,          -- P5 pharmacy routing

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS prescriptions_visit_idx   ON prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS prescriptions_created_idx ON prescriptions(created_at DESC);

COMMENT ON COLUMN prescriptions.medicines_encrypted    IS 'PHI — AES-256-GCM encrypted JSON Medicine[]';
COMMENT ON COLUMN prescriptions.instructions_encrypted IS 'PHI — AES-256-GCM encrypted instructions';

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 3: vitals
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  TEXT NOT NULL,
  visit_id                    UUID REFERENCES visit_records(id),
  recorded_by                 TEXT NOT NULL DEFAULT 'patient',
  recorded_by_id              TEXT,

  -- Vital signs (all nullable)
  bp_systolic                 INTEGER,
  bp_diastolic                INTEGER,
  heart_rate_bpm              INTEGER,
  weight_kg                   REAL,
  height_cm                   REAL,
  blood_sugar_mg_dl           REAL,
  blood_sugar_type            TEXT,          -- 'fasting' | 'post_meal' | 'random'
  oxygen_saturation           REAL,
  temperature_celsius         REAL,

  recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vitals_patient_idx  ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS vitals_visit_idx    ON vitals(visit_id);
CREATE INDEX IF NOT EXISTS vitals_recorded_idx ON vitals(recorded_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 4: lab_orders (stub — fully activated in P3 Day 4)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  TEXT NOT NULL,
  doctor_id                   TEXT,
  hospital_id                 TEXT,
  visit_id                    UUID REFERENCES visit_records(id),
  consent_record_id           TEXT,

  tests                       JSONB NOT NULL DEFAULT '[]',
  lab_name                    TEXT,
  status                      TEXT NOT NULL DEFAULT 'ordered',
  result_url                  TEXT,
  result_uploaded_at          TIMESTAMPTZ,
  result_uploaded_by          TEXT,

  ordered_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lab_orders_patient_idx ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS lab_orders_status_idx  ON lab_orders(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — enable after app-level role verification
-- Uncomment when Neon RLS roles are configured.
-- ──────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE visit_records   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prescriptions   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vitals          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lab_orders      ENABLE ROW LEVEL SECURITY;
