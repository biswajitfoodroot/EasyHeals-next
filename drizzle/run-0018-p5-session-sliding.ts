/**
 * Migration 0018 — P5 Session Sliding Window
 *
 * Alters:
 *   patient_sessions — adds last_active_at, max_ttl_hours, extended_count
 *
 * Run: npx tsx drizzle/run-0018-p5-session-sliding.ts
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("Running migration 0018 — P5 session sliding window...");

  // Add last_active_at (nullable — NULL for old sessions, fine)
  await client.execute(`
    ALTER TABLE patient_sessions
    ADD COLUMN last_active_at INTEGER
  `).catch((e: unknown) => {
    if (String(e).includes("duplicate column")) {
      console.log("  last_active_at already exists, skipping");
    } else throw e;
  });

  // Add max_ttl_hours with default 168 (7 days)
  await client.execute(`
    ALTER TABLE patient_sessions
    ADD COLUMN max_ttl_hours INTEGER NOT NULL DEFAULT 168
  `).catch((e: unknown) => {
    if (String(e).includes("duplicate column")) {
      console.log("  max_ttl_hours already exists, skipping");
    } else throw e;
  });

  // Add extended_count with default 0
  await client.execute(`
    ALTER TABLE patient_sessions
    ADD COLUMN extended_count INTEGER NOT NULL DEFAULT 0
  `).catch((e: unknown) => {
    if (String(e).includes("duplicate column")) {
      console.log("  extended_count already exists, skipping");
    } else throw e;
  });

  console.log("✓ Migration 0018 complete — patient_sessions sliding window columns added");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
