/**
 * Migration 0021 — Add cancellation_window_hours to hospitals
 *
 * Adds the per-hospital late-cancellation window column (default 2h).
 * Safe to re-run — uses ALTER TABLE IF NOT EXISTS pattern via a
 * try/catch since libSQL doesn't support IF NOT EXISTS on ALTER COLUMN.
 *
 * Run: npx tsx drizzle/run-0021-cancellation-window.ts
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("Running migration 0021 — add cancellation_window_hours to hospitals...");

  try {
    await client.execute(`
      ALTER TABLE hospitals
      ADD COLUMN cancellation_window_hours INTEGER NOT NULL DEFAULT 2
    `);
    console.log("  ✓ cancellation_window_hours column added");
  } catch (e: any) {
    if (e?.message?.includes("duplicate column")) {
      console.log("  ℹ cancellation_window_hours already exists — skipping");
    } else {
      throw e;
    }
  }

  console.log("✓ Migration 0021 complete");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
