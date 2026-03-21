/**
 * Migration 0012
 *
 * 1. Enable appointment_booking feature flag in DB (ensures it works even if env var not set)
 * 2. Add `status` column to doctor_hospital_affiliations for two-way invite/accept flow
 *    status: 'active' | 'pending_doctor_accept' | 'declined' | 'removed'
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const stmts = [
    // 1. Enable appointment_booking feature flag
    `INSERT OR REPLACE INTO feature_flags (key, enabled, updated_at)
     VALUES ('appointment_booking', 1, unixepoch() * 1000)`,

    // 2. Also enable token_queue (needed for OPD Queue)
    `INSERT OR REPLACE INTO feature_flags (key, enabled, updated_at)
     VALUES ('token_queue', 1, unixepoch() * 1000)`,

    // 3. Add status + invited_by to doctor_hospital_affiliations
    `ALTER TABLE doctor_hospital_affiliations ADD COLUMN affiliation_status TEXT NOT NULL DEFAULT 'active'`,
    // values: active | pending_doctor_accept | declined | removed
    `ALTER TABLE doctor_hospital_affiliations ADD COLUMN invited_by TEXT REFERENCES users(id)`,
    `ALTER TABLE doctor_hospital_affiliations ADD COLUMN invitation_note TEXT`,
    `ALTER TABLE doctor_hospital_affiliations ADD COLUMN responded_at INTEGER`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log("OK:", sql.slice(0, 80).replace(/\s+/g, " "));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists") || msg.includes("UNIQUE constraint failed")) {
        console.log("SKIP:", sql.slice(0, 60).replace(/\s+/g, " "));
      } else {
        throw e;
      }
    }
  }

  console.log("Migration 0012 done.");
  await client.close();
}

void main();
