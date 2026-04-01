/**
 * Migration 0019 — P5 AI Learning Tables
 *
 * Creates (if not exists):
 *   ai_embeddings          — vector store for RAG
 *   ai_patient_profiles    — synthesized patient learning model
 *   ai_response_feedback   — explicit + implicit AI feedback signals
 *   ai_knowledge_base      — seeded medical knowledge + learned patterns
 *
 * Run: npx tsx drizzle/run-0019-p5-ai-learning-tables.ts
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("Running migration 0019 — P5 AI learning tables...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ai_embeddings (
      id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      source_type       TEXT NOT NULL,
      source_id         TEXT,
      content_text_enc  TEXT NOT NULL,
      embedding         TEXT NOT NULL,
      specialty_tags    TEXT DEFAULT '[]',
      language_code     TEXT NOT NULL DEFAULT 'en',
      retrieval_count   INTEGER NOT NULL DEFAULT 0,
      last_retrieved_at INTEGER,
      created_at        INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  console.log("  ✓ ai_embeddings");

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_emb_patient_idx ON ai_embeddings(patient_id)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_emb_source_idx ON ai_embeddings(source_type, source_id)
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ai_patient_profiles (
      patient_id              TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      communication_style     TEXT NOT NULL DEFAULT 'simple',
      preferred_response_format TEXT NOT NULL DEFAULT 'conversational',
      preferred_language      TEXT NOT NULL DEFAULT 'en',
      health_goals_enc        TEXT,
      known_concerns_enc      TEXT,
      active_conditions_enc   TEXT,
      current_medications_enc TEXT,
      risk_factors_enc        TEXT,
      interaction_count       INTEGER NOT NULL DEFAULT 0,
      conversation_count      INTEGER NOT NULL DEFAULT 0,
      document_count          INTEGER NOT NULL DEFAULT 0,
      profile_confidence      REAL NOT NULL DEFAULT 0.0,
      last_synthesized_at     INTEGER,
      synthesis_version       INTEGER NOT NULL DEFAULT 0,
      updated_at              INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  console.log("  ✓ ai_patient_profiles");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ai_response_feedback (
      id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      conversation_id       TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      patient_id            TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      turn_index            INTEGER NOT NULL DEFAULT 0,
      explicit_rating       TEXT,
      implicit_signal       TEXT,
      response_length_chars INTEGER,
      response_format       TEXT,
      topic_tags            TEXT DEFAULT '[]',
      led_to_action         INTEGER NOT NULL DEFAULT 0,
      created_at            INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  console.log("  ✓ ai_response_feedback");

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_feedback_patient_idx ON ai_response_feedback(patient_id, created_at)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_feedback_positive_idx ON ai_response_feedback(led_to_action)
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ai_knowledge_base (
      id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      topic                   TEXT NOT NULL,
      content_enc             TEXT NOT NULL,
      source_type             TEXT NOT NULL DEFAULT 'seeded',
      embedding               TEXT,
      usage_count             INTEGER NOT NULL DEFAULT 0,
      positive_feedback_count INTEGER NOT NULL DEFAULT 0,
      negative_feedback_count INTEGER NOT NULL DEFAULT 0,
      relevance_score         REAL NOT NULL DEFAULT 0.5,
      is_active               INTEGER NOT NULL DEFAULT 1,
      created_at              INTEGER DEFAULT (unixepoch() * 1000),
      last_updated            INTEGER DEFAULT (unixepoch() * 1000)
    )
  `);
  console.log("  ✓ ai_knowledge_base");

  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_kb_source_type_idx ON ai_knowledge_base(source_type, is_active)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS ai_kb_relevance_idx ON ai_knowledge_base(relevance_score, is_active)
  `);

  console.log("✓ Migration 0019 complete — P5 AI learning tables created");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
