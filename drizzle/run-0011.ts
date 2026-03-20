import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const stmts = [
    // patient_record_access — fine-grained access control for staff to view patient docs
    `CREATE TABLE IF NOT EXISTS patient_record_access (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id),
      granted_to_user_id TEXT NOT NULL REFERENCES users(id),
      granted_by_user_id TEXT NOT NULL REFERENCES users(id),
      hospital_id TEXT REFERENCES hospitals(id),
      access_level TEXT NOT NULL DEFAULT 'metadata',
      expires_at INTEGER,
      revoked_at INTEGER,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS pra_patient_idx ON patient_record_access(patient_id)`,
    `CREATE INDEX IF NOT EXISTS pra_grantee_idx ON patient_record_access(granted_to_user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS pra_patient_grantee_hospital_idx
       ON patient_record_access(patient_id, granted_to_user_id, hospital_id)`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log("OK:", sql.slice(0, 80).replace(/\s+/g, " "));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) console.log("SKIP (already exists):", sql.slice(0, 60));
      else throw e;
    }
  }
  console.log("Migration 0011 done.");
  await client.close();
}

void main();
