/**
 * src/lib/search/index.ts
 *
 * P3 Day 4 — Search provider factory.
 *
 * Resolution order:
 *   SEARCH_PROVIDER=typesense + TYPESENSE_HOST + TYPESENSE_API_KEY set
 *     → Try Typesense; on failure/timeout fall back to FTS5 and warn
 *   SEARCH_PROVIDER=fts5 (default)
 *     → SQLite FTS5 (always available, no external dependency)
 *
 * Usage:
 *   import { search } from "@/lib/search";
 *   const results = await search({ query: "apollo", city: "mumbai", type: "hospital" });
 */

import { search as fts5Search } from "./fts5.provider";
import { searchTypesense, isTypesenseConfigured } from "./typesense.provider";
import type { SearchOptions, SearchResult } from "./fts5.provider";

export type { SearchOptions, SearchResult, HospitalSearchResult, DoctorSearchResult } from "./fts5.provider";
export { upsertDocument, deleteDocument } from "./typesense.provider";

/**
 * Unified search function — selects provider based on SEARCH_PROVIDER env var.
 * Falls back to FTS5 automatically if Typesense is unavailable.
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const provider = process.env.SEARCH_PROVIDER ?? "fts5";

  if (provider === "typesense") {
    if (!isTypesenseConfigured()) {
      console.warn("[Search] SEARCH_PROVIDER=typesense but TYPESENSE_HOST/TYPESENSE_API_KEY not set — falling back to FTS5");
      return fts5Search(options);
    }

    try {
      return await searchTypesense(options);
    } catch (err) {
      // Typesense unreachable or error — degrade gracefully to FTS5
      console.warn("[Search] Typesense failed, falling back to FTS5:", (err as Error).message);
      return fts5Search(options);
    }
  }

  return fts5Search(options);
}
