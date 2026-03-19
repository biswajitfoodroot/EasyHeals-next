import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const stmts = [
    `ALTER TABLE appointments ADD COLUMN consultation_fee REAL`,
    `ALTER TABLE appointments ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'none'`,
    `ALTER TABLE appointments ADD COLUMN meeting_url TEXT`,
  ];
  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log("OK:", sql.slice(0, 60));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column")) console.log("SKIP (already exists):", sql.slice(0, 60));
      else throw e;
    }
  }
  console.log("Migration 0010 done.");
  await client.close();
}

void main();
