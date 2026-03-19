/**
 * Task 0.5 — Legacy Lead Migration (A2 fix)
 *
 * PURPOSE:
 *   Old leads store raw phone numbers. The new P1 system uses phone_hash for
 *   patient identity. This script bridges the two systems by:
 *     1. Hashing each lead's raw phone with SHA-256
 *     2. Finding or creating a patient row with that phone_hash
 *     3. Linking the lead to the patient via patient_id
 *
 * PREREQUISITES:
 *   - Task 1.1 Drizzle migrations must have run first (patients table must exist)
 *   - leads.patient_id stub column must exist (added in Task 1.1)
 *   - TURSO_DATABASE_URL + TURSO_AUTH_TOKEN must be set in env
 *
 * RUN:
 *   npx tsx drizzle/migrate-legacy-leads.ts
 *
 * IDEMPOTENT: Leads with an existing patient_id are skipped. Safe to re-run.
 *
 * LEGAL BASIS:
 *   Legacy leads were collected before DPDP Act 2023 compliance.
 *   Created patients are marked legalBasis: "legitimate_interest_pre_dpdp".
 *   No consent record is back-created — that would be retroactive and false.
 */

import { createHash, randomUUID } from "crypto";
import { createClient } from "@libsql/client";

async function hashPhone(phone: string): Promise<string> {
  return createHash("sha256").update(phone.trim().toLowerCase()).digest("hex");
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("ERROR: TURSO_DATABASE_URL is not set");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  // Verify prerequisites
  const tableCheck = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='patients'`
  );
  if (tableCheck.rows.length === 0) {
    console.error("ERROR: patients table does not exist. Run Task 1.1 migrations first.");
    process.exit(1);
  }

  const colCheck = await client.execute(`PRAGMA table_info(leads)`);
  const hasPatientId = colCheck.rows.some((r) => r[1] === "patient_id");
  if (!hasPatientId) {
    console.error("ERROR: leads.patient_id column does not exist. Run Task 1.1 migrations first.");
    process.exit(1);
  }

  // Fetch all leads with raw phone that haven't been migrated yet
  const leads = await client.execute(
    `SELECT id, phone FROM leads WHERE phone IS NOT NULL AND patient_id IS NULL`
  );

  console.log(`Found ${leads.rows.length} leads to migrate.`);

  let created = 0;
  let linked = 0;
  let skipped = 0;
  const now = Date.now();

  for (const row of leads.rows) {
    const leadId = row[0] as string;
    const rawPhone = row[1] as string;

    if (!rawPhone) {
      skipped++;
      continue;
    }

    const phoneHash = await hashPhone(rawPhone);

    // Find existing patient by phone_hash
    const existing = await client.execute({
      sql: `SELECT id FROM patients WHERE phone_hash = ? LIMIT 1`,
      args: [phoneHash],
    });

    let patientId: string;

    if (existing.rows.length > 0) {
      patientId = existing.rows[0][0] as string;
    } else {
      // Create new patient row with hashed phone only
      patientId = randomUUID();
      await client.execute({
        sql: `INSERT INTO patients (id, phone_hash, legal_basis, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [patientId, phoneHash, "legitimate_interest_pre_dpdp", now, now],
      });
      created++;
    }

    // Link lead to patient
    await client.execute({
      sql: `UPDATE leads SET patient_id = ? WHERE id = ?`,
      args: [patientId, leadId],
    });
    linked++;
  }

  console.log(`Migration complete:`);
  console.log(`  Patients created : ${created}`);
  console.log(`  Leads linked     : ${linked}`);
  console.log(`  Skipped (no phone): ${skipped}`);

  // NOTE: Raw phone numbers remain in leads.phone for now.
  // A separate decision is needed on whether to NULL them out after linking,
  // depending on CRM/admin read requirements. Do NOT delete blindly.
  console.log(`\nNOTE: leads.phone raw values were NOT cleared.`);
  console.log(`Review with the team before clearing raw phones from the leads table.`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
