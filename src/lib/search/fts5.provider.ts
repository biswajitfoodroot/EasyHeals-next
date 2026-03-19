/**
 * FTS5 Search Provider
 *
 * Wraps SQLite FTS5 virtual tables (hospitals_fts, doctors_fts) behind a
 * SearchProvider interface. The SEARCH_PROVIDER env var controls which
 * implementation is active (fts5 | typesense). Typesense is P3.
 *
 * FTS5 virtual tables are created by the migration in:
 *   drizzle/0007_stale_wrecking_crew.sql
 *
 * Sync triggers keep the FTS indexes up-to-date on INSERT/UPDATE/DELETE.
 */

import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchResultType = "hospital" | "doctor";

export type HospitalSearchResult = {
  type: "hospital";
  id: string;
  name: string;
  slug: string;
  city: string;
  locality: string | null;
  specialties: string | null;
  rank: number;
};

export type DoctorSearchResult = {
  type: "doctor";
  id: string;
  name: string;
  slug: string;
  specialization: string | null;
  hospitalId: string | null;
  rank: number;
};

export type SearchResult = HospitalSearchResult | DoctorSearchResult;

export type SearchOptions = {
  query: string;
  city?: string;
  type?: SearchResultType;
  limit?: number;
  offset?: number;
};

// ─── FTS5 Provider ────────────────────────────────────────────────────────────

/**
 * Search hospitals using FTS5 full-text index.
 */
async function searchHospitals(
  query: string,
  city: string | undefined,
  limit: number,
  offset: number,
): Promise<HospitalSearchResult[]> {
  const ftsQuery = query.trim().replace(/['"*]/g, " ").trim();
  if (!ftsQuery) return [];

  // FTS5 MATCH with optional city filter
  const rows = await db.all<{
    id: string;
    name: string;
    slug: string;
    city: string;
    locality: string | null;
    specialties: string | null;
    rank: number;
  }>(
    city
      ? sql`
          SELECT h.id, h.name, h.slug, h.city, h.locality, h.specialties,
                 bm25(hospitals_fts) AS rank
          FROM hospitals_fts
          JOIN hospitals h ON h.id = hospitals_fts.rowid
          WHERE hospitals_fts MATCH ${ftsQuery}
            AND h.city LIKE ${"%" + city + "%"}
            AND h.is_active = 1
          ORDER BY rank
          LIMIT ${limit} OFFSET ${offset}
        `
      : sql`
          SELECT h.id, h.name, h.slug, h.city, h.locality, h.specialties,
                 bm25(hospitals_fts) AS rank
          FROM hospitals_fts
          JOIN hospitals h ON h.id = hospitals_fts.rowid
          WHERE hospitals_fts MATCH ${ftsQuery}
            AND h.is_active = 1
          ORDER BY rank
          LIMIT ${limit} OFFSET ${offset}
        `,
  );

  return rows.map((r) => ({ type: "hospital" as const, ...r }));
}

/**
 * Search doctors using FTS5 full-text index.
 */
async function searchDoctors(
  query: string,
  limit: number,
  offset: number,
): Promise<DoctorSearchResult[]> {
  const ftsQuery = query.trim().replace(/['"*]/g, " ").trim();
  if (!ftsQuery) return [];

  const rows = await db.all<{
    id: string;
    name: string;
    slug: string;
    specialization: string | null;
    hospitalId: string | null;
    rank: number;
  }>(
    sql`
      SELECT d.id, d.name, d.slug, d.specialization, d.hospital_id AS hospitalId,
             bm25(doctors_fts) AS rank
      FROM doctors_fts
      JOIN doctors d ON d.id = doctors_fts.rowid
      WHERE doctors_fts MATCH ${ftsQuery}
        AND d.is_active = 1
      ORDER BY rank
      LIMIT ${limit} OFFSET ${offset}
    `,
  );

  return rows.map((r) => ({ type: "doctor" as const, ...r }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search hospitals and/or doctors using the active search provider.
 *
 * SEARCH_PROVIDER=fts5 (default) → SQLite FTS5
 * SEARCH_PROVIDER=typesense → Typesense (P3, not yet implemented)
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const { query, city, type, limit = 10, offset = 0 } = options;

  if (env.SEARCH_PROVIDER === "typesense") {
    // Typesense is P3 — fall back to FTS5 for now
    console.warn("Typesense provider not yet implemented — falling back to FTS5");
  }

  if (type === "hospital") {
    return searchHospitals(query, city, limit, offset);
  }
  if (type === "doctor") {
    return searchDoctors(query, limit, offset);
  }

  // Mixed search — run in parallel, interleave by rank
  const [hospitals, doctors] = await Promise.all([
    searchHospitals(query, city, Math.ceil(limit / 2), offset),
    searchDoctors(query, Math.floor(limit / 2), offset),
  ]);

  return [...hospitals, ...doctors].sort((a, b) => a.rank - b.rank);
}
