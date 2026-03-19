/**
 * fix-missing-columns.ts
 *
 * Adds all columns that exist in schema.ts but are missing from the local DB.
 * Safe to re-run — each ALTER TABLE is wrapped in a try/catch; duplicate column errors are ignored.
 *
 * Run: npx tsx drizzle/fix-missing-columns.ts
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function exec(sql: string, label: string) {
  try {
    await client.execute(sql);
    console.log(`  ✓ ${label}`);
  } catch (err: any) {
    if (err?.message?.includes("duplicate column") || err?.message?.includes("already exists")) {
      console.log(`  - ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}: ${err?.message}`);
    }
  }
}

async function main() {
  console.log("\n── CRM mirror fields on doctors ─────────────────────────────");
  await exec(`ALTER TABLE doctors ADD COLUMN name TEXT`, "doctors.name");
  await exec(`ALTER TABLE doctors ADD COLUMN qualification TEXT`, "doctors.qualification");
  await exec(`ALTER TABLE doctors ADD COLUMN contact_phone TEXT`, "doctors.contact_phone");
  await exec(`ALTER TABLE doctors ADD COLUMN contact_email TEXT`, "doctors.contact_email");

  console.log("\n── CRM mirror fields on hospitals ───────────────────────────");
  await exec(`ALTER TABLE hospitals ADD COLUMN contact_person TEXT`, "hospitals.contact_person");
  await exec(`ALTER TABLE hospitals ADD COLUMN contact_phone TEXT`, "hospitals.contact_phone");
  await exec(`ALTER TABLE hospitals ADD COLUMN contact_email TEXT`, "hospitals.contact_email");
  await exec(`ALTER TABLE hospitals ADD COLUMN email_ids TEXT DEFAULT '[]'`, "hospitals.email_ids");
  await exec(`ALTER TABLE hospitals ADD COLUMN accreditation TEXT`, "hospitals.accreditation");

  console.log("\n── CRM bridge fields on leads ────────────────────────────────");
  await exec(`ALTER TABLE leads ADD COLUMN ref_id TEXT`, "leads.ref_id");
  await exec(`ALTER TABLE leads ADD COLUMN source_platform TEXT DEFAULT 'web'`, "leads.source_platform");
  await exec(`ALTER TABLE leads ADD COLUMN phone_hash TEXT`, "leads.phone_hash");

  console.log("\n── P2 Day 1: TOTP on users ───────────────────────────────────");
  await exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`, "users.totp_secret");
  await exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`, "users.totp_enabled");
  await exec(`ALTER TABLE users ADD COLUMN totp_recovery_codes TEXT DEFAULT '[]'`, "users.totp_recovery_codes");

  console.log("\n── P2 Day 1: TOTP on sessions ────────────────────────────────");
  await exec(`ALTER TABLE sessions ADD COLUMN totp_verified_at INTEGER`, "sessions.totp_verified_at");

  console.log("\n── P2 Day 1: appointments extension ──────────────────────────");
  await exec(`ALTER TABLE appointments ADD COLUMN patient_notes TEXT`, "appointments.patient_notes");
  await exec(`ALTER TABLE appointments ADD COLUMN consent_record_id TEXT`, "appointments.consent_record_id");
  await exec(`ALTER TABLE appointments ADD COLUMN source_platform TEXT DEFAULT 'web'`, "appointments.source_platform");
  await exec(`ALTER TABLE appointments ADD COLUMN slot_id TEXT`, "appointments.slot_id");

  console.log("\n── P3 Day 1: patient stubs (dob, gender, blood_group) ────────");
  await exec(`ALTER TABLE patients ADD COLUMN date_of_birth INTEGER`, "patients.date_of_birth");
  await exec(`ALTER TABLE patients ADD COLUMN gender TEXT`, "patients.gender");
  await exec(`ALTER TABLE patients ADD COLUMN blood_group TEXT`, "patients.blood_group");

  console.log("\n── P5: patient subscription / trial columns ──────────────────");
  await exec(`ALTER TABLE patients ADD COLUMN trial_started_at INTEGER`, "patients.trial_started_at");
  await exec(`ALTER TABLE patients ADD COLUMN subscription_tier TEXT DEFAULT 'free'`, "patients.subscription_tier");
  await exec(`ALTER TABLE patients ADD COLUMN subscription_expires_at INTEGER`, "patients.subscription_expires_at");

  console.log("\n── P5: patient Google Sign-In columns ────────────────────────");
  await exec(`ALTER TABLE patients ADD COLUMN google_id TEXT`, "patients.google_id");
  await exec(`ALTER TABLE patients ADD COLUMN google_email TEXT`, "patients.google_email");
  await exec(`ALTER TABLE patients ADD COLUMN google_name TEXT`, "patients.google_name");
  await exec(`ALTER TABLE patients ADD COLUMN google_avatar TEXT`, "patients.google_avatar");
  await exec(`CREATE INDEX IF NOT EXISTS patients_google_id_idx ON patients(google_id)`, "idx: patients_google_id_idx");

  console.log("\n── Done ──────────────────────────────────────────────────────\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
