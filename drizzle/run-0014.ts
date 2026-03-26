/**
 * Migration 0014 — Add metadata JSON column to taxonomy_nodes
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
    `ALTER TABLE taxonomy_nodes ADD COLUMN metadata TEXT`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log("OK:", sql.slice(0, 80).replace(/\s+/g, " "));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log("SKIP (already applied):", sql.slice(0, 60).replace(/\s+/g, " "));
      } else {
        throw e;
      }
    }
  }

  console.log("Migration 0014 done.");
  await client.close();
}

void main();
