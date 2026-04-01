/**
 * Migration 0020 — P6 Tables
 *
 * Creates (if not exists):
 *   care_nav_sessions     — care navigation provider match history
 *   funnel_events         — anonymous + authenticated conversion events
 *   patient_reminders     — smart reminder schedules
 *   referral_codes        — referral programme codes
 *   referral_conversions  — attribution tracking
 *
 * Run: npx tsx drizzle/run-0020-p6-tables.ts
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("Running migration 0020 — P6 tables...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS care_nav_sessions (
      id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      patient_id            TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      symptoms_enc          TEXT NOT NULL,
      matched_provider_ids  TEXT NOT NULL DEFAULT '[]',
      selected_provider_id  TEXT,
      outcome               TEXT,
      created_at            INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS care_nav_patient_idx ON care_nav_sessions(patient_id, created_at)
  `);
  console.log("  ✓ care_nav_sessions");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS funnel_events (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      session_id  TEXT NOT NULL,
      patient_id  TEXT,
      event_type  TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      metadata    TEXT,
      created_at  INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS funnel_session_idx ON funnel_events(session_id, created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS funnel_entity_idx ON funnel_events(entity_type, entity_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS funnel_patient_idx ON funnel_events(patient_id, created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS funnel_event_type_idx ON funnel_events(event_type, created_at)`);
  console.log("  ✓ funnel_events");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS patient_reminders (
      id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      reminder_type    TEXT NOT NULL,
      title            TEXT NOT NULL,
      body_enc         TEXT,
      schedule_cron    TEXT,
      channel          TEXT NOT NULL DEFAULT 'whatsapp',
      is_active        INTEGER NOT NULL DEFAULT 1,
      is_ai_generated  INTEGER NOT NULL DEFAULT 0,
      source_event_id  TEXT,
      last_sent_at     INTEGER,
      next_fire_at     INTEGER,
      created_at       INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS reminders_patient_idx ON patient_reminders(patient_id, is_active)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS reminders_next_fire_idx ON patient_reminders(next_fire_at, is_active)`);
  console.log("  ✓ patient_reminders");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      patient_id         TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      code               TEXT NOT NULL UNIQUE,
      total_clicks       INTEGER NOT NULL DEFAULT 0,
      total_conversions  INTEGER NOT NULL DEFAULT 0,
      points_awarded     INTEGER NOT NULL DEFAULT 0,
      created_at         INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS referral_code_idx ON referral_codes(code)`);
  console.log("  ✓ referral_codes");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS referral_conversions (
      id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      code_id              TEXT NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
      referred_patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      converted_at         INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS referral_conv_code_idx ON referral_conversions(code_id)`);
  console.log("  ✓ referral_conversions");

  console.log("✓ Migration 0020 complete — P6 tables created");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
