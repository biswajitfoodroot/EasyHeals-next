/**
 * drizzle/emr/apply-migration.ts
 *
 * Applies the EMR Postgres migration against NEON_DATABASE_URL.
 * Safe to re-run — all DDL uses CREATE TABLE IF NOT EXISTS.
 *
 * Run: npx tsx drizzle/emr/apply-migration.ts
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("❌  NEON_DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  console.log("\n── Applying EMR Postgres migration ──────────────────────────\n");

  const migrationPath = join(process.cwd(), "drizzle/emr/0001_p3_emr.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");

  // Split on statement boundaries and run each separately
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let ok = 0;
  let skipped = 0;

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      ok++;
    } catch (err: any) {
      if (
        err?.message?.includes("already exists") ||
        err?.message?.includes("duplicate")
      ) {
        skipped++;
      } else {
        console.error(`  ✗ ${err?.message}`);
        console.error(`    Statement: ${stmt.slice(0, 80)}...`);
      }
    }
  }

  console.log(`  ✓ ${ok} statements applied`);
  if (skipped > 0) console.log(`  - ${skipped} already existed (skipped)`);
  console.log("\n── Done ─────────────────────────────────────────────────────\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
