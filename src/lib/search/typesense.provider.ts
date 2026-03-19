/**
 * src/lib/search/typesense.provider.ts
 *
 * P3 Day 4 — Typesense search provider.
 *
 * Uses Typesense REST API directly (no npm package needed).
 * Activates when SEARCH_PROVIDER=typesense + TYPESENSE_HOST + TYPESENSE_API_KEY are set.
 *
 * Collection schema (create via typesense dashboard or init script):
 *
 *   hospitals:
 *     id (string), name (string*), slug (string), city (string*), locality (string),
 *     specialties (string), is_active (bool)
 *
 *   doctors:
 *     id (string), name (string*), slug (string), specialization (string*),
 *     hospital_id (string), is_active (bool)
 *
 * Graceful fallback: if Typesense is unreachable, logs a warning and returns [].
 * The caller (search/index.ts) falls back to FTS5 automatically.
 *
 * Ref: https://typesense.org/docs/latest/api/search.html
 */

import type {
  SearchOptions,
  SearchResult,
  HospitalSearchResult,
  DoctorSearchResult,
} from "./fts5.provider";

const TYPESENSE_HOST = process.env.TYPESENSE_HOST ?? "";
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY ?? "";

export function isTypesenseConfigured(): boolean {
  return !!TYPESENSE_HOST && !!TYPESENSE_API_KEY;
}

// ── REST helper ───────────────────────────────────────────────────────────────

interface TypesenseHit<T> {
  document: T;
  text_match: number;
}

interface TypesenseResponse<T> {
  hits?: TypesenseHit<T>[];
  error?: string;
}

async function tsSearch<T>(
  collection: string,
  params: Record<string, string>,
): Promise<TypesenseHit<T>[]> {
  const url = new URL(`${TYPESENSE_HOST}/collections/${collection}/documents/search`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY },
    // 3s timeout — fall back to FTS5 if Typesense is slow
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Typesense ${collection} search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as TypesenseResponse<T>;
  if (data.error) throw new Error(`Typesense error: ${data.error}`);
  return data.hits ?? [];
}

// ── Hospital search ───────────────────────────────────────────────────────────

interface TsHospital {
  id: string;
  name: string;
  slug: string;
  city: string;
  locality?: string;
  specialties?: string;
}

async function searchHospitalsByTypesense(
  query: string,
  city: string | undefined,
  limit: number,
  offset: number,
): Promise<HospitalSearchResult[]> {
  const params: Record<string, string> = {
    q: query,
    query_by: "name,specialties,locality,city",
    per_page: String(limit),
    page: String(Math.floor(offset / limit) + 1),
    filter_by: "is_active:true",
    sort_by: "_text_match:desc",
  };

  if (city) {
    params.filter_by = `is_active:true && city:=[${city}]`;
  }

  const hits = await tsSearch<TsHospital>("hospitals", params);

  return hits.map((h, i) => ({
    type: "hospital" as const,
    id: h.document.id,
    name: h.document.name,
    slug: h.document.slug,
    city: h.document.city,
    locality: h.document.locality ?? null,
    specialties: h.document.specialties ?? null,
    rank: i + 1,
  }));
}

// ── Doctor search ─────────────────────────────────────────────────────────────

interface TsDoctor {
  id: string;
  name: string;
  slug: string;
  specialization?: string;
  hospital_id?: string;
}

async function searchDoctorsByTypesense(
  query: string,
  limit: number,
  offset: number,
): Promise<DoctorSearchResult[]> {
  const hits = await tsSearch<TsDoctor>("doctors", {
    q: query,
    query_by: "name,specialization",
    per_page: String(limit),
    page: String(Math.floor(offset / limit) + 1),
    filter_by: "is_active:true",
    sort_by: "_text_match:desc",
  });

  return hits.map((h, i) => ({
    type: "doctor" as const,
    id: h.document.id,
    name: h.document.name,
    slug: h.document.slug,
    specialization: h.document.specialization ?? null,
    hospitalId: h.document.hospital_id ?? null,
    rank: i + 1,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search via Typesense.
 * Throws on error — caller (search/index.ts) handles fallback.
 */
export async function searchTypesense(options: SearchOptions): Promise<SearchResult[]> {
  const { query, city, type, limit = 10, offset = 0 } = options;

  if (type === "hospital") {
    return searchHospitalsByTypesense(query, city, limit, offset);
  }
  if (type === "doctor") {
    return searchDoctorsByTypesense(query, limit, offset);
  }

  // Mixed
  const [hospitals, doctors] = await Promise.all([
    searchHospitalsByTypesense(query, city, Math.ceil(limit / 2), offset),
    searchDoctorsByTypesense(query, Math.floor(limit / 2), offset),
  ]);

  return [...hospitals, ...doctors].sort((a, b) => a.rank - b.rank);
}

// ── Collection sync helpers (used by admin sync job) ─────────────────────────

/**
 * Upsert a single document into a Typesense collection.
 * Called from DB write hooks or a background sync job.
 */
export async function upsertDocument(
  collection: "hospitals" | "doctors",
  doc: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(
    `${TYPESENSE_HOST}/collections/${collection}/documents?action=upsert`,
    {
      method: "POST",
      headers: {
        "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doc),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Typesense upsert failed (${collection}): ${res.status} ${text}`);
  }
}

/**
 * Delete a document from a Typesense collection.
 */
export async function deleteDocument(
  collection: "hospitals" | "doctors",
  id: string,
): Promise<void> {
  await fetch(`${TYPESENSE_HOST}/collections/${collection}/documents/${id}`, {
    method: "DELETE",
    headers: { "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY },
  });
}
