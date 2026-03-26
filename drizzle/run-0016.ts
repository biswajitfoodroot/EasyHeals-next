/**
 * Migration 0016 — Create chatbot_knowledge table for RAG-based symptom/report catalog
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chatbot_knowledge (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type         TEXT NOT NULL,
      key          TEXT NOT NULL,
      aliases      TEXT NOT NULL DEFAULT '[]',
      data         TEXT NOT NULL DEFAULT '{}',
      is_active    INTEGER NOT NULL DEFAULT 1,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER DEFAULT (unixepoch() * 1000),
      updated_at   INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS chatbot_knowledge_type_key_idx
    ON chatbot_knowledge (type, key)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS chatbot_knowledge_type_idx
    ON chatbot_knowledge (type)
  `);

  // chatbot_training_examples — JSONL fine-tuning pairs + few-shot lookup
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chatbot_training_examples (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      language     TEXT NOT NULL DEFAULT 'English',
      intent       TEXT,
      subtype      TEXT,
      input        TEXT NOT NULL,
      output       TEXT NOT NULL,
      cluster      TEXT,
      quality_tag  TEXT,
      created_at   INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);

  // Add new columns if table existed without them (idempotent)
  for (const col of ["intent TEXT", "subtype TEXT", "quality_tag TEXT"]) {
    try {
      await client.execute(`ALTER TABLE chatbot_training_examples ADD COLUMN ${col}`);
    } catch { /* column already exists */ }
  }

  await client.execute(`
    CREATE INDEX IF NOT EXISTS chatbot_training_lang_idx
    ON chatbot_training_examples (language)
  `);

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS chatbot_training_intent_idx ON chatbot_training_examples (intent)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS chatbot_training_subtype_idx ON chatbot_training_examples (subtype)`);
  } catch { /* indexes may already exist */ }

  console.log("Migration 0016 complete — chatbot_knowledge + chatbot_training_examples tables created");
  await client.close();
}

void main();
