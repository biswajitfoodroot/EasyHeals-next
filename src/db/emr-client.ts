/**
 * src/db/emr-client.ts
 *
 * P3 — EMR Drizzle client (Neon Postgres, separate from Turso).
 *
 * ARCHITECTURE DECISION (ARCHITECTURE.md §B.1):
 *   EMR tables live in a SEPARATE Postgres DB (Neon/Supabase) — NOT in Turso.
 *   Reason: PHI data requires column-level AES encryption + Row Level Security,
 *   which SQLite/Turso does not support natively.
 *
 *   db     → Turso (libSQL)    — all P1/P2 tables (leads, patients, appointments, etc.)
 *   emrDb  → Neon (Postgres)   — EMR tables only (visit_records, prescriptions, vitals)
 *
 * Graceful degradation:
 *   - If NEON_DATABASE_URL is not set, emrDb is null.
 *   - All EMR route handlers check emrDb before use and throw a 503 if null.
 *   - This allows the app to boot and serve non-EMR routes even without Neon configured.
 *
 * Env vars required:
 *   NEON_DATABASE_URL  — Neon connection string (postgres://...)
 *                        Get from: Neon Console → Project → Connection string
 *
 * Run: npm install @neondatabase/serverless (already done)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as emrSchema from "./emr-schema";

function createEmrClient() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    // Return null — EMR routes will check and return 503 gracefully
    return null;
  }
  const sql = neon(url);
  return drizzle(sql, { schema: emrSchema });
}

// Singleton — created once per cold start
export const emrDb = createEmrClient();

export type EmrDb = NonNullable<typeof emrDb>;
