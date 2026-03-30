/**
 * Migration 0017 — Research Batch Jobs
 *
 * Creates:
 *   research_batch_jobs — tracks multi-entity AI research runs (batch mode in admin UI)
 *
 * Alters:
 *   ingestion_jobs — adds batch_id column (FK → research_batch_jobs.id)
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // 1. research_batch_jobs
  await client.execute(`
    CREATE TABLE IF NOT EXISTS research_batch_jobs (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      created_by_user_id TEXT REFERENCES users(id),
      status        TEXT NOT NULL DEFAULT 'pending',
      total_count   INTEGER NOT NULL DEFAULT 0,
      done_count    INTEGER NOT NULL DEFAULT 0,
      failed_count  INTEGER NOT NULL DEFAULT 0,
      city          TEXT,
      entity_type   TEXT NOT NULL DEFAULT 'hospital',
      items         TEXT NOT NULL DEFAULT '[]',
      created_at    INTEGER DEFAULT (unixepoch() * 1000),
      updated_at    INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS research_batch_jobs_user_idx
    ON research_batch_jobs (created_by_user_id)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS research_batch_jobs_status_idx
    ON research_batch_jobs (status)
  `);

  // 2. ingestion_jobs — add batch_id column (idempotent)
  try {
    await client.execute(`
      ALTER TABLE ingestion_jobs ADD COLUMN batch_id TEXT REFERENCES research_batch_jobs(id)
    `);
  } catch {
    // column already exists — safe to ignore
  }

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ingestion_jobs_batch_idx
    ON ingestion_jobs (batch_id)
  `);

  console.log("Migration 0017 complete — research_batch_jobs created, batch_id added to ingestion_jobs");
  await client.close();
}

void main();
