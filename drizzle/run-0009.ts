import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const STATEMENTS = [
  // New roles
  `INSERT OR IGNORE INTO roles (id, code, label) VALUES ('${crypto.randomUUID()}', 'admin_manager', 'Admin Manager')`,
  `INSERT OR IGNORE INTO roles (id, code, label) VALUES ('${crypto.randomUUID()}', 'admin_editor', 'Admin Editor')`,
  // kycStatus on users
  `ALTER TABLE users ADD COLUMN kyc_status TEXT NOT NULL DEFAULT 'not_required'`,
  // user_entity_permissions table
  `CREATE TABLE IF NOT EXISTS user_entity_permissions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT 'edit',
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    UNIQUE(user_id, entity_type, entity_id)
  )`,
  `CREATE INDEX IF NOT EXISTS uep_user_idx ON user_entity_permissions(user_id)`,
  `CREATE INDEX IF NOT EXISTS uep_entity_idx ON user_entity_permissions(entity_type, entity_id)`,
  // entity_access_requests table
  `CREATE TABLE IF NOT EXISTS entity_access_requests (
    id TEXT PRIMARY KEY NOT NULL,
    requester_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    business_name TEXT,
    license_number TEXT,
    license_type TEXT,
    kyc_documents TEXT NOT NULL DEFAULT '[]',
    contact_phone TEXT,
    contact_email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    review_notes TEXT,
    approved_entity_id TEXT,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS ear_requester_idx ON entity_access_requests(requester_id)`,
  `CREATE INDEX IF NOT EXISTS ear_status_idx ON entity_access_requests(status)`,
];

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  for (const stmt of STATEMENTS) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    try {
      await client.execute(stmt);
      console.log("OK:", preview);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("already inserted")
      ) {
        console.log("SKIP:", preview);
      } else {
        console.error("ERR:", msg.slice(0, 140), "|", preview);
      }
    }
  }

  // Backfill: copy users.entity_id into user_entity_permissions
  console.log("Backfilling user_entity_permissions...");
  const rows = await client.execute(
    `SELECT id, entity_type, entity_id FROM users WHERE entity_id IS NOT NULL AND entity_type IS NOT NULL`
  );
  let backfilled = 0;
  for (const row of rows.rows) {
    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO user_entity_permissions (id, user_id, entity_type, entity_id, is_primary, permissions) VALUES (?, ?, ?, ?, 1, 'edit')`,
        args: [crypto.randomUUID(), row[0] as string, row[1] as string, row[2] as string],
      });
      backfilled++;
    } catch { /* skip */ }
  }
  console.log(`Backfilled ${backfilled} user→entity links.`);
  console.log("Migration 0009 complete.");
}

void main();
