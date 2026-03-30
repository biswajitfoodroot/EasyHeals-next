/**
 * add-seo-keywords.ts
 *
 * Migration: Add seo_keywords column to hospitals table.
 * Run: npx tsx drizzle/add-seo-keywords.ts
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // Add column (SQLite ALTER TABLE ADD COLUMN is safe to run multiple times in Turso)
  try {
    await client.execute(`ALTER TABLE hospitals ADD COLUMN seo_keywords TEXT DEFAULT '[]'`);
    console.log("✓ Added seo_keywords column to hospitals");
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("• Column seo_keywords already exists, skipping.");
    } else {
      throw e;
    }
  }

  await client.close();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
