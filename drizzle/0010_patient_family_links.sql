-- 0010: Patient Family Profiles
-- Enables a patient to link up to 5 family members as real EasyHeals accounts.
-- Each linked patient can log in independently with their own phone number.

CREATE TABLE IF NOT EXISTS patient_family_links (
  id TEXT PRIMARY KEY NOT NULL,
  primary_patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  linked_patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relation           TEXT NOT NULL DEFAULT 'Family',  -- Spouse | Child | Parent | Sibling | etc.
  display_name       TEXT,                            -- Optional override name shown to the primary user
  created_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (primary_patient_id, linked_patient_id)
);

CREATE INDEX IF NOT EXISTS family_links_primary_idx ON patient_family_links (primary_patient_id);
CREATE INDEX IF NOT EXISTS family_links_linked_idx  ON patient_family_links (linked_patient_id);
