-- 0011: Patient Profile Data — move localStorage to DB
-- Enables full mobile API compatibility.
-- Tables: patient_health_profiles, patient_addresses, patient_vitals, patient_medications

CREATE TABLE IF NOT EXISTS patient_health_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  height TEXT,
  weight TEXT,
  blood_group TEXT,
  conditions TEXT,
  allergies TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS hp_patient_idx ON patient_health_profiles (patient_id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_addresses (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  street TEXT,
  state TEXT,
  pincode TEXT,
  alt_phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS addr_patient_idx ON patient_addresses (patient_id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_vitals (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_date TEXT NOT NULL,            -- YYYY-MM-DD (patient-reported date)
  weight TEXT,                            -- kg, stored as string to preserve precision
  bp TEXT,                                -- e.g. "120/80"
  glucose TEXT,                           -- mg/dL
  pulse TEXT,                             -- bpm
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS vitals_patient_date_idx ON patient_vitals (patient_id, recorded_date);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_medications (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  times TEXT NOT NULL DEFAULT '[]',       -- JSON array of time strings e.g. ["08:00","20:00"]
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS meds_patient_idx ON patient_medications (patient_id);
CREATE INDEX IF NOT EXISTS meds_active_idx  ON patient_medications (patient_id, is_active);
