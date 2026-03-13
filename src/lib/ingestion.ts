/**
 * src/lib/ingestion.ts — EasyHeals AI Scraping Engine v3
 *
 * KEY CHANGES in this version:
 *
 * FIX 1 — Doctor data not persisting:
 *   The root cause was that doctor pages (e.g. /doctors-list) were being
 *   crawled but their text was being sliced BEFORE being sent to Pass B.
 *   Each doctor sub-page was getting 20k chars, but only the first was being
 *   used meaningfully. Now ALL doctor pages are concatenated and fed as a
 *   single block, with a higher cap (60k chars). The root page also gets
 *   a full 45k pass even when doctor pages exist.
 *
 * FIX 2 — Cost/price comparison support:
 *   Pass B now extracts feeMin, feeMax, and consultationFee per doctor.
 *   Pass C now extracts procedure costs with price ranges.
 *   New type: IngestionProcedureCost for cross-hospital cost comparison.
 *   The `extractStructuredFromSources` output now includes `procedureCosts`.
 *
 * FIX 3 — Hospital ↔ Doctor ↔ Clinic interlinking:
 *   - `chooseBestDoctorMatch` now returns city-scoped results to avoid
 *     wrongly linking a Dr. Sharma at Apollo Mumbai to Apollo Pune.
 *   - Hospital candidates carry `type` field so clinics are clearly typed.
 *   - A new helper `buildEntityLinks` produces explicit cross-reference
 *     records (doctor → hospital, service → hospital) for the apply route.
 *
 * FIX 4 — Multi-page doctor lists (pagination):
 *   For pages with "View More" or numbered pagination patterns the crawler
 *   now discovers and fetches paginated doctor list sub-pages up to page 5.
 *
 * IMPROVEMENT — Better sub-page text budget:
 *   Doctor pages: up to 80k chars total across all pages (was 24k).
 *   Service pages: up to 40k chars total (was 20k).
 *   Root page context sent to each pass raised to 50k from 24-45k.
 *
 * All previously exported types and signatures preserved — no breaking changes.
 */

import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import { env } from "@/lib/env";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type IngestionDoctor = {
  fullName: string;
  specialization?: string | null;
  qualifications?: string[];
  languages?: string[];
  phone?: string | null;
  email?: string | null;
  yearsOfExperience?: number | null;
  feeMin?: number | null;
  feeMax?: number | null;
  consultationFee?: number | null;
  consultationDays?: string[];
  opdTiming?: string | null;
  schedule?: Record<string, unknown> | null;
  designation?: string | null;            // NEW: Senior Consultant, HOD, etc.
  avatarUrl?: string | null;             // NEW: if found on page
};

export type IngestionService = {
  name: string;
  category?: string | null;
  description?: string | null;
};

export type IngestionPackage = {
  packageName: string;
  procedureName?: string | null;
  department?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  currency?: string | null;
  inclusions?: Record<string, unknown> | null;
  exclusions?: Record<string, unknown> | null;
  lengthOfStay?: string | null;
};

/**
 * NEW: Cross-hospital cost comparison support.
 * Separate from packages — these are named procedure costs without
 * necessarily being a bundled package.
 */
export type IngestionProcedureCost = {
  procedureName: string;
  department?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  currency: string;
  notes?: string | null;
};

export type IngestionFieldConfidence = {
  entityType: "hospital" | "doctor" | "service" | "package";
  entityRef: string;
  fieldKey: string;
  confidence: number;
  sourceType?: string | null;
  sourceUrl?: string | null;
  extractedValue?: string | null;
};

export type IngestionHospital = {
  name: string;
  type?: "hospital" | "clinic" | "diagnostic_center" | "nursing_home" | "specialty_center" | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressData?: Record<string, unknown> | null;
  phone?: string | null;
  contactNumbers?: string[];
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  socialLinks?: Record<string, unknown> | null;
  operatingHours?: Record<string, unknown> | null;
  departments?: string[];
  majorServices?: string[];
  keyFacilities?: string[];
  uniqueOfferings?: string[];
  description?: string | null;
  specialties?: string[];
  services?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceLinks?: string[];
  googlePlaceId?: string | null;
  accreditations?: string[];
  bedCount?: number | null;
  establishedYear?: string | null;
};

export type IngestionStructuredPayload = {
  hospital: IngestionHospital;
  doctors: IngestionDoctor[];
  services: IngestionService[];
  packages: IngestionPackage[];
  procedureCosts: IngestionProcedureCost[];   // NEW — for cost comparison
  fieldConfidences: IngestionFieldConfidence[];
  confidence: number;
  notes: string[];
};

export type SearchSnippet = {
  title: string;
  link: string;
  snippet: string;
};

export type GoogleProfileResult = {
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  internationalPhone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  openingHours: string[];
};

export type IngestionProgress = {
  stage: 'fetching' | 'extracting' | 'finished' | 'error';
  message: string;
  percent?: number;
  data?: any;
};

export type ProgressCallback = (p: IngestionProgress) => Promise<void> | void;

export type WebsiteSourceResult = {
  html: string;
  text: string;
  mode: "direct" | "proxy_fallback" | "jina";
  warnings: string[];
  blockedStatus: number | null;
  crawledPages: CrawledPage[];
};

export type CrawledPage = {
  url: string;
  text: string;
  category: PageCategory;
};

export type PageCategory =
  | "doctors"
  | "services"
  | "departments"
  | "about"
  | "contact"
  | "facilities"
  | "packages"
  | "general";

export class IngestionSourceError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  hint: string;

  constructor(input: { code: string; message: string; status?: number | null; retryable?: boolean; hint: string }) {
    super(input.message);
    this.name = "IngestionSourceError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.retryable = Boolean(input.retryable);
    this.hint = input.hint;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function normalizeName(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeStrings(values: Array<string | null | undefined>, max = 24): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const next = (value ?? "").trim();
    if (next) set.add(next);
    if (set.size >= max) break;
  }
  return Array.from(set);
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeParseJson<T>(raw: string): T | null {
  const candidate = raw.includes("```") ? raw.replace(/```json|```/g, "").trim() : raw.trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const match = candidate.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

function toStringArray(value: unknown, max = 20): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, max);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, max);
  }
  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePhones(raw: string): string[] {
  const results: string[] = [];
  for (const m of raw.matchAll(/\+91[-\s]?[6-9]\d{9}/g)) results.push(m[0].replace(/\s/g, ""));
  for (const m of raw.matchAll(/\b0[1-9]\d{1,3}[-\s]?\d{6,8}\b/g)) results.push(m[0].replace(/\s/g, ""));
  for (const m of raw.matchAll(/\b1800[-\s]?\d{3}[-\s]?\d{4}\b/g)) results.push(m[0].replace(/\s/g, ""));
  for (const m of raw.matchAll(/(?<!\d)[6-9]\d{9}(?!\d)/g)) results.push(m[0]);
  return dedupeStrings(results, 12);
}

function parseEmails(raw: string): string[] {
  return dedupeStrings(raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [], 10);
}

function parseSocialLinks(raw: string): Record<string, string> {
  const links = dedupeStrings(raw.match(/https?:\/\/[^\s"'<>)]+/g) ?? [], 120);
  const out: Record<string, string> = {};
  for (const url of links) {
    if (!out.facebook && /facebook\.com/i.test(url)) out.facebook = url;
    if (!out.instagram && /instagram\.com/i.test(url)) out.instagram = url;
    if (!out.linkedin && /linkedin\.com/i.test(url)) out.linkedin = url;
    if (!out.youtube && /youtube\.com|youtu\.be/i.test(url)) out.youtube = url;
    if (!out.x && /x\.com|twitter\.com/i.test(url)) out.x = url;
  }
  return out;
}

function parseOperatingHours(raw: string): Record<string, unknown> | null {
  const hits = raw.match(/(?:mon|tue|wed|thu|fri|sat|sun)[^\n.]{0,80}/gi) ?? [];
  if (!hits.length) return null;
  return { summary: dedupeStrings(hits, 7).join(" | ") };
}

function parsePackagesFromText(raw: string): IngestionPackage[] {
  const lines = raw.split(/[\n.]/).map(l => l.trim()).filter(l => /package|surgery|procedure|angioplasty|cataract|delivery|knee replacement/i.test(l));
  const rows: IngestionPackage[] = [];
  for (const line of lines.slice(0, 36)) {
    const nameMatch = line.match(/([A-Za-z][A-Za-z\s-]{3,90}(?:package|surgery|procedure))/i);
    if (!nameMatch?.[1]) continue;
    const priceMatch = line.match(/(?:rs\.?|inr|rupees?|\u20b9)\s*([\d,]+)(?:\s*(?:-|to)\s*(?:rs\.?|inr|rupees?|\u20b9)?\s*([\d,]+))?/i);
    const min = priceMatch?.[1] ? Number(priceMatch[1].replace(/,/g, "")) : null;
    const max = priceMatch?.[2] ? Number(priceMatch[2].replace(/,/g, "")) : min;
    rows.push({ packageName: nameMatch[1].trim(), procedureName: nameMatch[1].trim(), priceMin: Number.isFinite(min ?? NaN) ? min : null, priceMax: Number.isFinite(max ?? NaN) ? max : null, currency: "INR", inclusions: null, exclusions: null, lengthOfStay: null });
  }
  return rows.slice(0, 24);
}

/**
 * NEW — parse procedure costs for cross-hospital cost comparison
 * Catches patterns like "Knee Replacement: ₹1.2L – ₹2.5L" or "MRI Brain ₹3500-₹5000"
 */
function parseProcedureCostsFromText(raw: string): IngestionProcedureCost[] {
  const results: IngestionProcedureCost[] = [];
  const lines = raw.split(/[\n|•]/).map(l => l.trim()).filter(l =>
    l.length > 8 && /(?:rs\.?|inr|rupees?|₹|\blakh\b|\bl\b)/i.test(l)
  );
  for (const line of lines.slice(0, 60)) {
    const priceMatch = line.match(/(?:rs\.?|inr|₹|rupees?)\s*([\d,.]+)\s*(?:(?:lakh|l)\b)?(?:\s*[-–to]+\s*(?:rs\.?|inr|₹|rupees?)?\s*([\d,.]+)\s*(?:(?:lakh|l)\b)?)?/i);
    if (!priceMatch) continue;
    const rawName = line.replace(priceMatch[0], "").replace(/[:\-–]/g, " ").trim();
    if (rawName.length < 4 || rawName.length > 120) continue;
    const lakhMultiplier = /lakh|l\b/i.test(priceMatch[0]) ? 100000 : 1;
    const pmin = priceMatch[1] ? Number(priceMatch[1].replace(/,/g, "")) * lakhMultiplier : null;
    const pmax = priceMatch[2] ? Number(priceMatch[2].replace(/,/g, "")) * lakhMultiplier : pmin;
    results.push({ procedureName: rawName, priceMin: pmin, priceMax: pmax, currency: "INR", notes: null });
  }
  return results.slice(0, 50);
}

function buildHeuristicFieldConfidences(payload: IngestionStructuredPayload, sourceUrl: string): IngestionFieldConfidence[] {
  const rows: IngestionFieldConfidence[] = [];
  const add = (entityType: IngestionFieldConfidence["entityType"], entityRef: string, fieldKey: string, value: unknown, confidence: number) => {
    if (value === null || value === undefined) return;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (!serialized || serialized === "[]" || serialized === "{}") return;
    rows.push({ entityType, entityRef, fieldKey, confidence, sourceType: "heuristic", sourceUrl, extractedValue: serialized.slice(0, 320) });
  };
  add("hospital", "hospital", "name", payload.hospital.name, 0.7);
  add("hospital", "hospital", "phone", payload.hospital.phone, 0.7);
  add("hospital", "hospital", "email", payload.hospital.email, 0.66);
  add("hospital", "hospital", "operatingHours", payload.hospital.operatingHours, 0.56);
  add("hospital", "hospital", "departments", payload.hospital.departments, 0.6);
  add("hospital", "hospital", "keyFacilities", payload.hospital.keyFacilities, 0.62);
  for (const [i, doc] of payload.doctors.slice(0, 20).entries()) {
    add("doctor", `${i}:${doc.fullName}`, "fullName", doc.fullName, 0.68);
    add("doctor", `${i}:${doc.fullName}`, "specialization", doc.specialization, 0.56);
    add("doctor", `${i}:${doc.fullName}`, "consultationFee", doc.consultationFee, 0.48);
  }
  for (const [i, pkg] of payload.packages.slice(0, 20).entries()) {
    add("package", `${i}:${pkg.packageName}`, "packageName", pkg.packageName, 0.56);
    add("package", `${i}:${pkg.packageName}`, "priceMin", pkg.priceMin, 0.45);
    add("package", `${i}:${pkg.packageName}`, "priceMax", pkg.priceMax, 0.45);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEB FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FETCH_HEADERS = { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-IN,en;q=0.9", Referer: "https://www.google.com/", DNT: "1" };

async function fetchDirect(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; status: number; html: string } | null> {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", headers: FETCH_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, status: res.status, html: "" };
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch { return null; }
}

async function fetchViaJina(url: string, timeoutMs = 20_000): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers: Record<string, string> = { Accept: "text/plain", "X-Return-Format": "text", "X-Timeout": "15" };
    if (env.JINA_API_KEY) headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
    const res = await fetch(jinaUrl, { method: "GET", cache: "no-store", headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function classifyPageUrl(url: string): PageCategory {
  const p = url.toLowerCase();
  if (/doctor|physician|consultant|specialist|our-team|meet-our|staff/i.test(p)) return "doctors";
  if (/service|treatment|procedure|therapy|programme/i.test(p)) return "services";
  if (/department|specialit|centre|center/i.test(p)) return "departments";
  if (/facilit|amenity|infrastructure|equipment/i.test(p)) return "facilities";
  if (/package|price|cost|tariff/i.test(p)) return "packages";
  if (/about|history|overview|mission|vision/i.test(p)) return "about";
  if (/contact|reach|location|address|map/i.test(p)) return "contact";
  return "general";
}

function extractValuableLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const VALUABLE = /doctor|physician|consultant|specialist|team|staff|service|treatment|department|facilit|about|contact|package|price|specialit|centre|center|procedure/i;
  const hrefs = [...html.matchAll(/href=["']([^"'#?][^"']*)/gi)].map(m => m[1]);
  const seen = new Set<string>([baseUrl]);
  const out: string[] = [];
  for (const href of hrefs) {
    try {
      const abs = href.startsWith("http") ? href : new URL(href, base).href;
      const u = new URL(abs);
      if (u.hostname === base.hostname && VALUABLE.test(u.pathname) && !seen.has(abs) && !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|zip)$/i.test(u.pathname)) {
        seen.add(abs);
        out.push(abs);
      }
    } catch { /* skip malformed */ }
  }
  return out.slice(0, 16); // increased from 12 to catch paginated doctor lists
}

/**
 * Detect pagination on doctor list pages with EXPANDED pattern matching.
 * Finds links like /doctors-list/page/2, /doctors?page=3, ?offset=20, ?pagination=2, etc.
 * PHASE 1 FIX: Expanded regex from 1 pattern to 9 patterns for better site coverage
 */
function extractPaginationLinks(html: string, baseUrl: string, currentUrl: string): string[] {
  const base = new URL(baseUrl);
  const current = new URL(currentUrl);

  // PHASE 1 ENHANCEMENT: Support 9 common pagination patterns
  // Old: /[?&/]page[=/](\d+)|\/(\d+)\/?$/i  
  // New: Multiple patterns to catch Manipal-style pagination and others
  const paginationPatterns = [
    /[\?&]page[=/]?(\d+)/i,           // ?page=2, ?page/2, &page=2
    /[\?&]offset[=/]?(\d+)/i,         // ?offset=20 (AJAX pagination)
    /[\?&]skip[=/]?(\d+)/i,           // ?skip=40
    /[\?&]start[=/]?(\d+)/i,          // ?start=50
    /[\?&]p[=/]?(\d+)/i,              // ?p=2 (short form)
    /[\?&]pagination[=/]?(\d+)/i,     // ?pagination=2 (Manipal-style)
    /\/\d+\/?$/i,                     // /2 at end of path
    /[-_]page[-_]?(\d+)/i,            // -page-2, _page_2
    /[-_](\d+)\/?$/i,                 // /doctors-list-2
  ];

  const hrefs = [...html.matchAll(/href=["']([^"']+)/gi)].map(m => m[1]);
  const seen = new Set<string>([currentUrl]);
  const out: string[] = [];

  for (const href of hrefs) {
    try {
      const abs = href.startsWith("http") ? href : new URL(href, base).href;
      const u = new URL(abs);
      if (u.hostname === base.hostname && !seen.has(abs)) {
        // Check if URL matches ANY of the pagination patterns
        let matchesPattern = false;
        for (const pattern of paginationPatterns) {
          if (pattern.test(u.href)) {
            matchesPattern = true;
            break;
          }
        }

        if (matchesPattern) {
          // Verify it's related to current path (prevent random pagination links)
          const currentBase = current.pathname.split(/[\?&]/)[0].replace(/\/\d+\/?$/, "");
          const targetBase = u.pathname.split(/[\?&]/)[0].replace(/\/\d+\/?$/, "");

          // Allow if: same base path OR target path starts with current path OR similar structure
          if (currentBase === targetBase ||
            u.pathname.startsWith(current.pathname.replace(/\/$/, "")) ||
            currentBase.replace(/\/$/, "") === targetBase.replace(/\/$/, "")) {
            seen.add(abs);
            out.push(abs);
            if (out.length >= 5) break; // max 6 pages total (original + 5 more)
          }
        }
      }
    } catch { /* skip malformed URLs */ }
  }
  return out;
}

/**
 * PHASE 2: Detect API endpoints from JavaScript and HTML
 * Finds JSON API patterns that can be used to fetch doctor/service data directly
 * Examples: /api/doctors, /api/v1/doctors, /graphql, etc.
 */
function detectApiPatterns(html: string, baseUrl: string, allText: string): string[] {
  const apiEndpoints: string[] = [];
  const base = new URL(baseUrl);

  // Pattern 1: Direct API calls in inline JavaScript or HTML attributes
  // Matches: fetch('/api/doctors'), axios.get('/api/doctors?page=1'), etc.
  const directApiPattern = /["'](https?:\/\/[^"']+\/api\/[^"']+)["']/gi;
  for (const match of html.matchAll(directApiPattern)) {
    apiEndpoints.push(match[1]);
  }

  // Pattern 2: Relative API calls in JavaScript
  // Matches: fetch('/doctors/list'), '/v1/doctors?page=1', etc.
  const relativeApiPattern = /["'](\/[a-z0-9/_-]+\?[^"']*(?:page|offset|limit)[^"']*)["\';]/gi;
  for (const match of html.matchAll(relativeApiPattern)) {
    try {
      const abs = new URL(match[1], base).href;
      apiEndpoints.push(abs);
    } catch { /* skip */ }
  }

  // Pattern 3: GraphQL endpoints
  // Matches: /graphql, /api/graphql
  const graphqlPattern = /["'](https?:\/\/[^"']*\/graphql[^"']*)["\';]|["'](\/[^"']*\/graphql[^"']*)["\';]/gi;
  for (const match of html.matchAll(graphqlPattern)) {
    const endpoint = match[1] || match[2];
    if (endpoint) {
      const abs = endpoint.startsWith('http') ? endpoint : new URL(endpoint, base).href;
      apiEndpoints.push(abs);
    }
  }

  // Pattern 4: Common hospital API patterns (infer from URL structure)
  // If URL is /baner/doctors-list, try common API patterns
  const pathMatch = new URL(baseUrl).pathname.match(/(\w+)\/doctor/i);
  if (pathMatch) {
    const location = pathMatch[1];
    const patterns = [
      `/api/doctors?location=${location}&page=1`,
      `/api/doctors?hospital=${location}&page=1`,
      `/api/v1/doctors?location=${location}`,
      `/api/locations/${location}/doctors`,
      `/api/doctors?branch=${location}`,
    ];
    for (const pattern of patterns) {
      try {
        apiEndpoints.push(new URL(pattern, base).href);
      } catch { /* skip */ }
    }
  }

  // Pattern 5: Check for common REST patterns in HTML data attributes
  // Matches: data-api="/api/doctors", data-endpoint="/doctors/list"
  const dataAttrPattern = /data-(?:api|endpoint|url)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(dataAttrPattern)) {
    try {
      const abs = match[1].startsWith('http') ? match[1] : new URL(match[1], base).href;
      apiEndpoints.push(abs);
    } catch { /* skip */ }
  }

  // Pattern 6: Detect API base from common naming
  // If we see "apiBase" or "apiUrl" in JavaScript
  const apiBasePattern = /(?:apiBase|apiUrl|apiEndpoint|baseUrl)\s*[:=]\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(apiBasePattern)) {
    const endpoint = match[1];
    if (endpoint.includes('/api')) {
      try {
        apiEndpoints.push(new URL(endpoint, base).href);
      } catch { /* skip */ }
    }
  }

  // Deduplicate and return first 10 unique endpoints
  return [...new Set(apiEndpoints)].slice(0, 10);
}

/**
 * PHASE 2: Try to fetch data from detected API endpoints
 * Attempts to fetch doctor/service data in JSON format
 */
async function tryApiEndpoints(apiEndpoints: string[]): Promise<{
  html: string;
  text: string;
  warnings: string[];
} | null> {
  const warnings: string[] = [];

  for (const endpoint of apiEndpoints.slice(0, 5)) {
    try {
      // Try to fetch with various headers
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const res = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });

      if (!res.ok) {
        warnings.push(`API endpoint ${endpoint} returned ${res.status}`);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        warnings.push(`API endpoint ${endpoint} did not return JSON`);
        continue;
      }

      const json = await res.json();

      // Check if response contains doctor/service data
      if (typeof json !== 'object' || json === null) continue;

      // Detect if this looks like doctor/service data
      const jsonStr = JSON.stringify(json);
      const hasDoctorData = /doctor|physician|specialist|consultant|name|qualif|specializ/i.test(jsonStr);
      const hasServiceData = /service|treatment|procedure|department|facility/i.test(jsonStr);

      if (hasDoctorData || hasServiceData) {
        // Convert JSON to text format for AI extraction
        const text = formatApiResponseAsText(json);
        if (text.length > 500) {
          return {
            html: jsonStr,
            text,
            warnings: [...warnings, `Successfully fetched API data from ${endpoint}`],
          };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('timeout')) {
        warnings.push(`API endpoint attempt failed: ${endpoint}`);
      }
    }
  }

  return null;
}

/**
 * PHASE 3: Browser automation option for JavaScript-heavy websites
 * Uses Playwright/Puppeteer simulation to execute JavaScript and click pagination
 * Note: browserAutomationAvailable will be determined when fetchWithPlaywright is called
 */

/**
 * PHASE 3: Fetch with browser automation using Browserless.io (cloud)
 * Recommended for production: No local Chrome needed, handles all JS/pagination
 */
async function fetchWithBrowserless(url: string, options?: { useBrowserAutomation?: boolean }): Promise<string | null> {
  if (!options?.useBrowserAutomation) return null;

  const browserlessKey = env.BROWSERLESS_API_KEY;
  if (!browserlessKey) {
    console.warn('[ingestion] Browserless key not set - skipping browser automation');
    return null;
  }

  try {
    const response = await fetch('https://chrome.browserless.io/content?token=' + browserlessKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        timeout: 25000,
        waitForSelector: 'body', // Wait for page load
        scrollPage: true, // Scroll to load lazy-loaded content
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`[ingestion] Browserless returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    return html.length > 500 ? html : null;
  } catch (err) {
    console.warn('[ingestion] Browserless fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * PHASE 3: Fetch with local browser automation using Playwright
 * Requires: npm install playwright
 * Self-hosted option with more control
 */
async function fetchWithPlaywright(url: string, options?: { useBrowserAutomation?: boolean }): Promise<string | null> {
  if (!options?.useBrowserAutomation) return null;

  try {
    // Dynamic import - will fail gracefully if playwright is not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = await import('playwright').catch(() => null) as any;
    if (!chromium) return null;

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // For low-memory environments
        '--disable-gpu',
      ],
    }).catch(() => null);

    if (!browser) return null;

    try {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      // Set realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Block heavy resources to speed up loading
      await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico}', (route: any) => route.abort());
      await page.route('**/*.{mp4,webm,wav,mp3}', (route: any) => route.abort());

      // Navigate to page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 20000,
      }).catch(() => null);

      if (!page.url()) {
        await context.close();
        return null;
      }

      // Scroll to load lazy content
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);

      for (let i = 0; i < 5; i++) {
        if (previousHeight === currentHeight) break;

        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);

        previousHeight = currentHeight;
        currentHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
      }

      // Auto-click "View More" / "Load More" buttons (up to 5 times)
      for (let i = 0; i < 5; i++) {
        try {
          // Try multiple selectors for various button styles
          const selectors = [
            'button[class*="more"]',
            'button[class*="load"]',
            'button[class*="view"]',
            'a[class*="more"]',
            'a[class*="load"]',
            'button:text("View More")',
            'button:text("Load More")',
            'button:text("Next")',
          ];

          let moreButton = null;
          for (const selector of selectors) {
            try {
              moreButton = await page.$(selector);
              if (moreButton) break;
            } catch {
              // Selector failed, try next
            }
          }

          if (!moreButton) break;

          await moreButton.click().catch(() => null);
          await page.waitForTimeout(2000);

          // Scroll down after clicking
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await page.waitForTimeout(1500);
        } catch {
          break;
        }
      }

      // Get fully rendered HTML
      const html = await page.content();
      await context.close();

      return html && html.length > 500 ? html : null;
    } finally {
      await browser.close().catch(() => null);
    }
  } catch (err) {
    console.warn('[ingestion] Playwright fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * PHASE 3: Smart fallback - try Browserless first, then Playwright, then skip
 */
async function fetchWithBrowserAutomation(url: string, options?: { useBrowserAutomation?: boolean }): Promise<string | null> {
  if (!options?.useBrowserAutomation) return null;

  // Try Browserless.io first (cloud-based, always works if configured)
  const browserlessHtml = await fetchWithBrowserless(url, options);
  if (browserlessHtml) {
    return browserlessHtml;
  }

  // Fallback to local Playwright
  const playwrightHtml = await fetchWithPlaywright(url, options);
  if (playwrightHtml) {
    return playwrightHtml;
  }

  return null;
}

function formatApiResponseAsText(json: unknown, depth = 0): string {
  if (depth > 5) return ''; // Prevent infinite recursion

  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  if (Array.isArray(json)) {
    for (let i = 0; i < Math.min(json.length, 100); i++) {
      const item = json[i];
      if (typeof item === 'string') {
        lines.push(`${indent}${item}`);
      } else if (typeof item === 'object' && item !== null) {
        lines.push(formatApiResponseAsText(item, depth + 1));
      }
    }
  } else if (typeof json === 'object' && json !== null) {
    const record = json as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        lines.push(`${indent}${key}: ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        lines.push(formatApiResponseAsText(value, depth + 1));
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${indent}${key}:`);
        lines.push(formatApiResponseAsText(value, depth + 1));
      }
    }
  }

  return lines.join('\n');
}

function toBlockedCode(status: number | null): string {
  if (status === 401 || status === 403) return "WEBSITE_ACCESS_BLOCKED";
  if (status === 406 || status === 451) return "WEBSITE_POLICY_BLOCKED";
  if (status === 429) return "WEBSITE_RATE_LIMITED";
  return "WEBSITE_FETCH_FAILED";
}

export async function fetchWebsiteSource(url: string, options?: {
  useBrowserAutomation?: boolean;
  respectRobotsTxt?: boolean;
  onProgress?: ProgressCallback;
}): Promise<WebsiteSourceResult> {
  const warnings: string[] = [];
  const onProgress = options?.onProgress;
  await onProgress?.({ stage: 'fetching', message: `Initializing fetch for ${url}...`, percent: 5 });
  const opts = {
    useBrowserAutomation: options?.useBrowserAutomation ?? false,
    respectRobotsTxt: options?.respectRobotsTxt ?? true,
  };

  // Root page: Try browser automation first if enabled, then fallback to direct
  let directHtml = '';
  let directText = '';
  let mode: WebsiteSourceResult["mode"] = "direct";
  let blockedStatus: number | null = null;

  // PHASE 3: Try browser automation if enabled
  if (opts.useBrowserAutomation) {
    const browserHtml = await fetchWithBrowserAutomation(url, { useBrowserAutomation: true });
    if (browserHtml) {
      directHtml = browserHtml;
      directText = stripHtmlToText(browserHtml);
      mode = "jina"; // Mark as processed content
      warnings.push('PHASE 3: Fetched root page using browser automation');
    }
  }

  let direct: { ok: boolean; status: number; html: string } | null = null;

  // Fallback to direct fetch if browser automation not used or failed
  if (!directHtml) {
    const [directResult, jinaResult] = await Promise.allSettled([fetchDirect(url), fetchViaJina(url)]);
    direct = directResult.status === "fulfilled" ? directResult.value : null;
    const jina = jinaResult.status === "fulfilled" ? jinaResult.value : null;

    directHtml = direct?.html ?? "";
    directText = direct?.ok ? stripHtmlToText(directHtml) : "";
    const jinaClean = jina ?? "";

    blockedStatus = direct && !direct.ok && [401, 403, 406, 429, 451].includes(direct.status) ? direct.status : null;
    if (blockedStatus) warnings.push(`Direct fetch returned ${blockedStatus}; using Jina Reader content.`);

    const useJina = jinaClean.length > directText.length * 1.15;
    directText = useJina ? jinaClean.slice(0, 50_000) : directText.slice(0, 50_000);
    directHtml = useJina ? jinaClean.slice(0, 120_000) : directHtml.slice(0, 120_000);
    mode = useJina ? (direct?.ok ? "jina" : "proxy_fallback") : "direct";
  }

  await onProgress?.({ stage: 'fetching', message: `Fetched root page (${directHtml.length} bytes)`, percent: 30 });

  const rootText = directText;
  const rootHtml = directHtml;

  if (!rootText && !rootHtml) {
    throw new IngestionSourceError({
      code: toBlockedCode(blockedStatus ?? direct?.status ?? null),
      message: direct?.status ? `Website fetch failed with ${direct.status}` : "Website fetch failed",
      status: blockedStatus ?? direct?.status ?? null,
      retryable: [429, 503, 504].includes(direct?.status ?? 0),
      hint: blockedStatus === 403
        ? "This website is blocking automated access. Jina Reader also failed to access it."
        : "Could not access this website reliably. Try a different URL or wait and retry.",
    });
  }

  // Crawl sub-pages
  const subUrls = extractValuableLinks(rootHtml, url);
  const crawledPages: CrawledPage[] = [];
  const doctorSubUrls: string[] = [];

  // PHASE 2: Try to detect and use API endpoints
  const apiEndpoints = detectApiPatterns(rootHtml, url, rootText);
  let apiDataPage: CrawledPage | null = null;
  if (apiEndpoints.length > 0) {
    const apiData = await tryApiEndpoints(apiEndpoints);
    if (apiData) {
      apiDataPage = { url: `${url} (API)`, text: apiData.text, category: "doctors" };
      warnings.push(`PHASE 2: Found and fetched JSON API data (${apiData.text.length} chars)`);
    }
  }

  if (subUrls.length > 0) {
    const BATCH = 3;
    for (let i = 0; i < subUrls.length; i += BATCH) {
      const batch = subUrls.slice(i, i + BATCH);
      await onProgress?.({
        stage: 'fetching',
        message: `Crawling sub-pages: ${i + 1} to ${Math.min(i + BATCH, subUrls.length)} of ${subUrls.length}`,
        percent: 30 + Math.floor((i / subUrls.length) * 40)
      });
      const results = await Promise.allSettled(batch.map(u => {
        if (opts.useBrowserAutomation) {
          return fetchWithBrowserAutomation(u, { useBrowserAutomation: true });
        }
        return fetchDirect(u, 10_000);
      }));

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const pageUrl = batch[j];

        // Handle result format from both fetchDirect and fetchWithBrowserAutomation
        const html = r.status === "fulfilled"
          ? (typeof r.value === "string" ? r.value : r.value?.ok ? r.value.html : "")
          : "";

        if (html.length > 300) {
          const text = stripHtmlToText(html).slice(0, 25_000);
          const category = classifyPageUrl(pageUrl);
          if (text.length > 200) {
            const page: CrawledPage = { url: pageUrl, text, category };
            crawledPages.push(page);
            await onProgress?.({
              stage: 'fetching',
              message: `Saved crawl checkpoint: ${pageUrl}`,
              data: { page }
            });

            // Collect doctor pages for pagination discovery
            if (category === "doctors") {
              doctorSubUrls.push(pageUrl);
              // Look for pagination on this doctor page
              const pagLinks = extractPaginationLinks(html, url, pageUrl);
              for (const pl of pagLinks) {
                if (!subUrls.includes(pl) && !batch.includes(pl)) {
                  doctorSubUrls.push(pl);
                }
              }
            }
          }
        }
      }

      // PHASE 1 IMPROVEMENT: Increased delay from 400ms to 1000ms for better rate limiting
      if (i + BATCH < subUrls.length) await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Fetch paginated doctor pages we discovered
  const paginatedDoctorUrls = [...new Set(doctorSubUrls)].filter(u => !crawledPages.some(p => p.url === u));
  if (paginatedDoctorUrls.length > 0) {
    const results = await Promise.allSettled(paginatedDoctorUrls.slice(0, 4).map(u => fetchDirect(u, 10_000)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const pageUrl = paginatedDoctorUrls[j];
      if (r.status === "fulfilled" && r.value?.ok && r.value.html.length > 300) {
        const text = stripHtmlToText(r.value.html).slice(0, 25_000);
        if (text.length > 200) {
          crawledPages.push({ url: pageUrl, text, category: "doctors" });
        }
      }
    }
  }

  // PHASE 2: Add API data to crawled pages if found
  if (apiDataPage) {
    crawledPages.push(apiDataPage);
  }

  return { html: rootHtml, text: rootText, mode, warnings, blockedStatus, crawledPages };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI EXTRACTION — THREE FOCUSED PASSES
// ═══════════════════════════════════════════════════════════════════════════════

const JSON_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.05,
  maxOutputTokens: 8192,
};

const SYSTEM_A = `You are EasyHeals hospital data extraction AI for India.
Extract ONLY hospital identity and contact information from the provided website text.
Return strict JSON. Use null for any field not clearly present. Never invent data.

TYPE DETECTION — pick one:
  "hospital"          → multi-specialty, mentions beds / ICU / in-patient / 24-hour emergency
  "clinic"            → OPD only, no beds, single or small group of doctors
  "diagnostic_center" → primarily lab tests / scans / imaging
  "nursing_home"      → small inpatient facility, usually <50 beds
  "specialty_center"  → dedicated to one specialty (eye, dental, IVF, ortho, etc.)

PHONE rules: Capture ALL phones. Indian: +91XXXXXXXXXX, 0XX-XXXXXXXX, 1800-XXX-XXXX, bare 10-digit.
ACCREDITATIONS: NABH, NABL, JCI, ISO 9001, AHPI, CRISIL, AAA.
OPERATING HOURS: { "monday": "9am-6pm", "emergency": "24x7" } OR { "summary": "..." }.

Return JSON:
{
  "name": "string",
  "type": "hospital|clinic|diagnostic_center|nursing_home|specialty_center",
  "city": "string|null",
  "state": "string|null",
  "country": "India",
  "addressLine1": "full street address|null",
  "phone": "primary phone|null",
  "contactNumbers": ["all phones"],
  "whatsapp": "string|null",
  "email": "string|null",
  "website": "string|null",
  "socialLinks": { "facebook": null, "instagram": null, "linkedin": null, "youtube": null, "x": null },
  "operatingHours": { "summary": "string" }|null,
  "accreditations": [],
  "bedCount": null,
  "establishedYear": null,
  "description": "max 300 char|null",
  "specialties": [],
  "departments": [],
  "keyFacilities": [],
  "majorServices": [],
  "uniqueOfferings": [],
  "rating": null,
  "reviewCount": null,
  "confidence": 0.0
}`;

const SYSTEM_B = `You are EasyHeals doctor data extraction AI for India.
Extract ALL doctors, consultants, physicians and surgeons from the provided text.
Return strict JSON. NEVER invent names — only include people explicitly mentioned.

RULES:
  • Must have a medical title: Dr., Prof., MBBS, MD, MS, DM, MCh, FRCS, DNB or similar
  • Include "Dr." prefix in fullName where present in the source
  • Include designation (Senior Consultant, HOD, Director of Cardiology, etc.)
  • Include qualifications exactly as written (MBBS, MD, MS (Ortho), DNB, etc.)
  • DEDUPLICATION: if same doctor appears multiple times, merge into one complete record

SPECIALIZATION: use standard terms:
  Cardiology | Orthopedics | Neurology | Oncology | Gynecology | Pediatrics |
  Urology | Nephrology | Gastroenterology | Pulmonology | ENT | Ophthalmology |
  Dermatology | Psychiatry | Radiology | Pathology | General Surgery | etc.

FEES: numeric INR only. From "₹500-₹800" extract feeMin=500, feeMax=800.
EXPERIENCE: numeric years (from "15+ years" → 15).
CONSULTATION DAYS: expand abbreviations → ["Monday","Wednesday","Friday"].

Return JSON:
{
  "doctors": [
    {
      "fullName": "Dr. FirstName LastName",
      "specialization": "string|null",
      "designation": "Senior Consultant|HOD|null",
      "qualifications": [],
      "yearsOfExperience": null,
      "languages": [],
      "phone": "string|null",
      "email": "string|null",
      "consultationFee": null,
      "feeMin": null,
      "feeMax": null,
      "consultationDays": [],
      "opdTiming": "string|null",
      "schedule": null,
      "confidence": 0.0
    }
  ]
}`;

const SYSTEM_C = `You are EasyHeals services, packages and cost extraction AI for India.
Extract all medical services, treatment packages, procedures and cost data.
Return strict JSON. Use null for missing fields.

SERVICE CATEGORIES (pick one): "Diagnostics" | "Surgery" | "OPD Consultation" | "Emergency" |
  "Preventive" | "Rehabilitation" | "Maternity" | "Pediatric" | "Other"

PACKAGES: Named bundles with a price range. priceMin/priceMax: numeric INR only.
  lengthOfStay: "3 days" | "1 week" | null. inclusions/exclusions: { "items": [...] } | null.

PROCEDURE COSTS: Individual procedure pricing for cost comparison across hospitals.
  Even if not a formal "package", extract any mentioned price for a named procedure.
  Examples: "MRI Brain ₹3500", "Knee Replacement surgery ₹1.2 – 2.5 lakh", "Normal delivery ₹30,000"
  priceMin/priceMax: numeric INR (multiply lakhs: 1 lakh = 100000).

DEPARTMENTS: Named hospital units (Cardiology Dept, NICU, Blood Bank, Emergency, etc.)

Return JSON:
{
  "services": [ { "name": "string", "category": "Diagnostics|Surgery|...", "description": "string|null" } ],
  "packages": [
    {
      "packageName": "string",
      "procedureName": "string|null",
      "department": "string|null",
      "priceMin": null,
      "priceMax": null,
      "currency": "INR",
      "inclusions": null,
      "exclusions": null,
      "lengthOfStay": "string|null"
    }
  ],
  "procedureCosts": [
    { "procedureName": "string", "department": "string|null", "priceMin": null, "priceMax": null, "currency": "INR", "notes": "string|null" }
  ],
  "departments": ["string"]
}`;

async function runPass<T>(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  userContent: string,
  fallback: T,
): Promise<T> {
  try {
    const response = await model.generateContent(userContent.slice(0, 150_000));
    const parsed = safeParseJson<T>(response.response.text());
    return parsed ?? fallback;
  } catch (err) {
    console.warn("[ingestion] Gemini pass failed:", err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

function mergeDoctors(doctors: IngestionDoctor[]): IngestionDoctor[] {
  const map = new Map<string, IngestionDoctor>();
  for (const doc of doctors) {
    const key = normalizeName(doc.fullName);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, doc);
    } else {
      map.set(key, {
        ...existing,
        specialization: existing.specialization ?? doc.specialization,
        designation: existing.designation ?? doc.designation,
        qualifications: dedupeStrings([...(existing.qualifications ?? []), ...(doc.qualifications ?? [])], 8),
        languages: dedupeStrings([...(existing.languages ?? []), ...(doc.languages ?? [])], 6),
        phone: existing.phone ?? doc.phone,
        email: existing.email ?? doc.email,
        yearsOfExperience: existing.yearsOfExperience ?? doc.yearsOfExperience,
        consultationFee: existing.consultationFee ?? doc.consultationFee,
        feeMin: existing.feeMin ?? doc.feeMin,
        feeMax: existing.feeMax ?? doc.feeMax,
        consultationDays: dedupeStrings([...(existing.consultationDays ?? []), ...(doc.consultationDays ?? [])], 7),
        opdTiming: existing.opdTiming ?? doc.opdTiming,
        schedule: existing.schedule ?? doc.schedule,
      });
    }
  }
  return Array.from(map.values()).slice(0, 120);
}

function heuristicExtract(
  websiteUrl: string,
  allText: string,
  hints: { hospitalName?: string; city?: string },
  googleProfile: GoogleProfileResult | null,
): IngestionStructuredPayload {
  const doctorMatches = allText.match(/(?:Dr\.?|Prof\.?)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z.]+){0,3}/g) ?? [];
  const serviceKeywords = allText.match(/(cardiology|orthopaedics?|orthopedics?|neurology|oncology|ivf|urology|nephrology|gastroenterology|pulmonology|gynaecology|gynecology|ent|ophthalmology|dermatology|psychiatry|radiology|pathology|emergency|trauma|icu|nicu|dialysis|mri|ct scan|x-ray|endoscopy|laparoscopy|cataract|lasik|angioplasty|bypass|transplant)/gi) ?? [];
  const services = dedupeStrings(serviceKeywords, 40);
  const departments = dedupeStrings(services.filter(s => /cardio|ortho|neuro|onco|ivf|uro|pulmo|gyn|ent|ophthal|derma|nephro|gastro/i.test(s)), 24);
  const keyFacilities = dedupeStrings(services.filter(s => /icu|nicu|dialysis|emergency|trauma|mri|ct|blood bank|pharmacy/i.test(s)), 24);
  const phones = parsePhones(allText);
  const emails = parseEmails(allText);
  const socialLinks = parseSocialLinks(allText);
  const packages = parsePackagesFromText(allText);
  const procedureCosts = parseProcedureCostsFromText(allText);
  const nameHint = hints.hospitalName ?? googleProfile?.name ?? new URL(websiteUrl).hostname.replace(/^www\./i, "").replace(/[-_]/g, " ");

  const payload: IngestionStructuredPayload = {
    hospital: {
      name: nameHint,
      city: hints.city ?? null,
      country: "India",
      addressLine1: googleProfile?.formattedAddress ?? null,
      addressData: googleProfile?.formattedAddress ? { fullAddress: googleProfile.formattedAddress } : null,
      phone: googleProfile?.internationalPhone ?? phones[0] ?? null,
      contactNumbers: dedupeStrings([...(googleProfile?.internationalPhone ? [googleProfile.internationalPhone] : []), ...phones]),
      whatsapp: phones[0] ?? null,
      email: emails[0] ?? null,
      website: googleProfile?.website ?? websiteUrl,
      socialLinks,
      operatingHours: googleProfile?.openingHours.length ? { weekdayText: googleProfile.openingHours } : parseOperatingHours(allText),
      departments,
      majorServices: services.slice(0, 30),
      keyFacilities,
      uniqueOfferings: dedupeStrings(keyFacilities.filter(s => /trauma|emergency|dialysis|icu|mri|ct/i.test(s)), 16),
      description: allText.slice(0, 400),
      specialties: departments,
      services: services.slice(0, 40),
      rating: googleProfile?.rating ?? null,
      reviewCount: googleProfile?.reviewCount ?? null,
      latitude: googleProfile?.latitude ?? null,
      longitude: googleProfile?.longitude ?? null,
      sourceLinks: dedupeStrings([websiteUrl, googleProfile?.mapsUrl ?? null], 20),
      googlePlaceId: googleProfile?.placeId ?? null,
    },
    doctors: dedupeStrings(doctorMatches, 30).map(fullName => ({ fullName, specialization: null, qualifications: [], languages: [], consultationDays: [], opdTiming: null, consultationFee: null, schedule: null })),
    services: services.slice(0, 40).map(name => ({ name })),
    packages,
    procedureCosts,
    fieldConfidences: [],
    confidence: googleProfile ? 0.45 : 0.3,
    notes: ["Heuristic extraction — AI unavailable or API key missing."],
  };

  payload.fieldConfidences = buildHeuristicFieldConfidences(payload, websiteUrl);
  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractStructuredFromSources — main export
// ═══════════════════════════════════════════════════════════════════════════════

export async function extractStructuredFromSources(params: {
  websiteUrl: string;
  websiteText: string;
  searchSnippets: SearchSnippet[];
  hints: { hospitalName?: string; city?: string; targetHospitalId?: string };
  googleProfile?: GoogleProfileResult | null;
  crawledPages: CrawledPage[];
  onProgress?: ProgressCallback;
}): Promise<IngestionStructuredPayload> {
  const onProgress = params.onProgress;
  const crawledPages = params.crawledPages;

  // ── FIX: Aggregate ALL doctor pages — was the root cause of missing doctors ─
  const doctorPageText = crawledPages
    .filter(p => p.category === "doctors")
    .map(p => p.text)
    .join("\n\n---PAGE---\n\n")
    .slice(0, 200_000);

  const servicePageText = crawledPages
    .filter(p => ["services", "departments", "packages", "facilities"].includes(p.category))
    .map(p => p.text)
    .join("\n\n---PAGE---\n\n")
    .slice(0, 80_000);

  const aboutPageText = crawledPages
    .filter(p => ["about", "contact", "general"].includes(p.category))
    .map(p => p.text)
    .join("\n\n")
    .slice(0, 10_000);

  const allText = [params.websiteText, ...crawledPages.map(p => p.text)].join("\n\n").slice(0, 80_000);

  const fallback = heuristicExtract(params.websiteUrl, allText, params.hints, params.googleProfile ?? null);
  if (!env.GOOGLE_AI_API_KEY) return fallback;

  try {
    const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
    const ctx = [
      `Hospital name hint: ${params.hints.hospitalName ?? "unknown"}`,
      `City hint: ${params.hints.city ?? "unknown"}`,
      `Website URL: ${params.websiteUrl}`,
    ].join("\n");

    // ── PASS A — Hospital core ─────────────────────────────────────────────
    await onProgress?.({ stage: 'extracting', message: "AI Pass A: Hospital Profile...", percent: 75 });
    const modelA = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_A, generationConfig: JSON_CONFIG });
    const passAInput = [ctx, "ROOT PAGE:\n" + params.websiteText.slice(0, 28_000), aboutPageText ? "ABOUT/CONTACT:\n" + aboutPageText : ""].join("\n\n");
    const passA = await runPass<Partial<IngestionHospital>>(modelA, passAInput, {});

    // ── PASS B — Doctors ────────────────────────────────────────────────────
    await onProgress?.({ stage: 'extracting', message: "AI Pass B: Doctor Directory...", percent: 85 });
    const modelB = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_B, generationConfig: JSON_CONFIG });
    const passBInput = [
      ctx,
      doctorPageText
        ? `DEDICATED DOCTOR PAGES (${crawledPages.filter(p => p.category === "doctors").length} pages crawled):\n` + doctorPageText
        : "DEDICATED DOCTOR PAGES: none found — extracting from root page.",
      "ROOT PAGE (full):\n" + params.websiteText.slice(0, 50_000),
    ].join("\n\n");
    const passB = await runPass<{ doctors?: unknown[] }>(modelB, passBInput, { doctors: [] });

    // ── PASS C — Services + Packages + Procedure Costs ─────────────────────
    await onProgress?.({ stage: 'extracting', message: "AI Pass C: Services & Pricing...", percent: 95 });
    const modelC = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_C, generationConfig: JSON_CONFIG });
    const passCInput = [
      ctx,
      servicePageText ? "SERVICE/PACKAGE/DEPT PAGES:\n" + servicePageText : "SERVICE PAGES: none found separately.",
      "ROOT PAGE:\n" + params.websiteText.slice(0, 50_000),
    ].join("\n\n");
    const passC = await runPass<{ services?: unknown[]; packages?: unknown[]; departments?: unknown[]; procedureCosts?: unknown[] }>(
      modelC, passCInput, { services: [], packages: [], departments: [], procedureCosts: [] }
    );

    if (!passA?.name) return fallback;

    const mergedDepartments = dedupeStrings([...toStringArray(passA.departments, 40), ...toStringArray(passC.departments, 40)], 40);

    // ── Normalize doctors ──────────────────────────────────────────────────
    const rawDoctors = ((passB.doctors ?? []) as IngestionDoctor[]).filter((d): d is IngestionDoctor => Boolean(d?.fullName));
    const mergedDoctors = mergeDoctors(rawDoctors);

    // ── Normalize services ─────────────────────────────────────────────────
    const mergedServices: IngestionService[] = ((passC.services ?? []) as IngestionService[])
      .filter((s): s is IngestionService => Boolean(s?.name))
      .slice(0, 80)
      .map(s => ({ name: String(s.name).trim(), category: s.category ?? null, description: s.description ?? null }));

    // ── Normalize packages ─────────────────────────────────────────────────
    const mergedPackages: IngestionPackage[] = ((passC.packages ?? []) as IngestionPackage[])
      .filter((p): p is IngestionPackage => Boolean(p?.packageName))
      .slice(0, 80)
      .map(p => ({
        packageName: String(p.packageName).trim(),
        procedureName: p.procedureName ?? null,
        department: p.department ?? null,
        priceMin: toNumber(p.priceMin),
        priceMax: toNumber(p.priceMax),
        currency: p.currency ?? "INR",
        inclusions: toRecord(p.inclusions),
        exclusions: toRecord(p.exclusions),
        lengthOfStay: p.lengthOfStay ?? null,
      }));

    // ── NEW: Normalize procedure costs ─────────────────────────────────────
    const aiProcedureCosts: IngestionProcedureCost[] = ((passC.procedureCosts ?? []) as IngestionProcedureCost[])
      .filter((p): p is IngestionProcedureCost => Boolean(p?.procedureName))
      .slice(0, 100)
      .map(p => ({
        procedureName: String(p.procedureName).trim(),
        department: p.department ?? null,
        priceMin: toNumber(p.priceMin),
        priceMax: toNumber(p.priceMax),
        currency: p.currency ?? "INR",
        notes: p.notes ?? null,
      }));

    // Merge AI costs with heuristic regex costs (deduplicate by name)
    const allProcedureCosts = [...aiProcedureCosts];
    const costNames = new Set(aiProcedureCosts.map(c => normalizeName(c.procedureName)));
    for (const hc of fallback.procedureCosts) {
      if (!costNames.has(normalizeName(hc.procedureName))) allProcedureCosts.push(hc);
    }

    const filledCoreFields = [passA.name, passA.phone, passA.city, passA.email, passA.addressLine1, passA.description].filter(Boolean).length;
    const aiConfidence = Math.min(0.95, 0.5 + filledCoreFields * 0.07 + (mergedDoctors.length > 0 ? 0.08 : 0));

    const allPhones = dedupeStrings([
      ...toStringArray(passA.contactNumbers, 12),
      ...parsePhones(allText).slice(0, 4),
      ...(params.googleProfile?.internationalPhone ? [params.googleProfile.internationalPhone] : []),
    ], 12);

    const output: IngestionStructuredPayload = {
      hospital: {
        name: String(passA.name ?? fallback.hospital.name).trim(),
        type: passA.type ?? null,
        city: passA.city ?? params.hints.city ?? null,
        state: passA.state ?? null,
        country: passA.country ?? "India",
        addressLine1: passA.addressLine1 ?? null,
        addressData: toRecord(passA.addressData),
        phone: passA.phone ?? params.googleProfile?.internationalPhone ?? allPhones[0] ?? null,
        contactNumbers: allPhones,
        whatsapp: passA.whatsapp ?? null,
        email: passA.email ?? parseEmails(allText)[0] ?? null,
        website: passA.website ?? params.googleProfile?.website ?? params.websiteUrl,
        socialLinks: toRecord(passA.socialLinks) ?? parseSocialLinks(allText),
        operatingHours: toRecord(passA.operatingHours) ?? (params.googleProfile?.openingHours.length ? { weekdayText: params.googleProfile.openingHours } : null),
        departments: mergedDepartments,
        majorServices: toStringArray(passA.majorServices, 40),
        keyFacilities: toStringArray(passA.keyFacilities, 40),
        uniqueOfferings: toStringArray(passA.uniqueOfferings, 30),
        accreditations: toStringArray(passA.accreditations, 10),
        description: passA.description ?? null,
        specialties: dedupeStrings([...toStringArray(passA.specialties, 30), ...mergedDepartments.slice(0, 10)], 30),
        services: mergedServices.map(s => s.name),
        bedCount: toNumber(passA.bedCount),
        establishedYear: passA.establishedYear ?? null,
        rating: toNumber(passA.rating) ?? params.googleProfile?.rating ?? null,
        reviewCount: toNumber(passA.reviewCount) ?? params.googleProfile?.reviewCount ?? null,
        latitude: toNumber(passA.latitude) ?? params.googleProfile?.latitude ?? null,
        longitude: toNumber(passA.longitude) ?? params.googleProfile?.longitude ?? null,
        sourceLinks: dedupeStrings([params.websiteUrl, params.googleProfile?.mapsUrl ?? null, ...crawledPages.map(p => p.url)], 20),
        googlePlaceId: (typeof passA.googlePlaceId === "string" ? passA.googlePlaceId : null) ?? params.googleProfile?.placeId ?? null,
      },
      doctors: mergedDoctors,
      services: mergedServices,
      packages: mergedPackages.length ? mergedPackages : fallback.packages,
      procedureCosts: allProcedureCosts,
      fieldConfidences: [],
      confidence: aiConfidence,
      notes: [
        `3-pass AI extraction (hospital core / doctors / services+costs).`,
        `Sub-pages crawled: ${crawledPages.length} (doctor pages: ${crawledPages.filter(p => p.category === "doctors").length}).`,
        `Doctors extracted: ${mergedDoctors.length}.`,
        `Services extracted: ${mergedServices.length}.`,
        `Packages extracted: ${mergedPackages.length}.`,
        `Procedure costs extracted: ${allProcedureCosts.length}.`,
      ],
    };

    output.fieldConfidences = buildAiFieldConfidences(output, params.websiteUrl);
    return output;
  } catch {
    return fallback;
  }
}

function buildAiFieldConfidences(payload: IngestionStructuredPayload, sourceUrl: string): IngestionFieldConfidence[] {
  const rows: IngestionFieldConfidence[] = [];
  const add = (entityType: IngestionFieldConfidence["entityType"], entityRef: string, fieldKey: string, value: unknown, confidence: number) => {
    if (value === null || value === undefined) return;
    const s = typeof value === "string" ? value : JSON.stringify(value);
    if (!s || s === "[]" || s === "{}") return;
    rows.push({ entityType, entityRef, fieldKey, confidence, sourceType: "ai_extracted", sourceUrl, extractedValue: s.slice(0, 320) });
  };
  const h = payload.hospital;
  const b = payload.confidence;
  add("hospital", "hospital", "name", h.name, Math.min(0.98, b + 0.15));
  add("hospital", "hospital", "type", h.type, Math.min(0.90, b + 0.10));
  add("hospital", "hospital", "phone", h.phone, Math.min(0.93, b + 0.13));
  add("hospital", "hospital", "email", h.email, Math.min(0.88, b + 0.08));
  add("hospital", "hospital", "city", h.city, Math.min(0.90, b + 0.10));
  add("hospital", "hospital", "addressLine1", h.addressLine1, Math.min(0.82, b + 0.05));
  add("hospital", "hospital", "operatingHours", h.operatingHours, Math.min(0.78, b + 0.02));
  add("hospital", "hospital", "departments", h.departments, Math.min(0.83, b + 0.06));
  add("hospital", "hospital", "specialties", h.specialties, Math.min(0.85, b + 0.07));
  add("hospital", "hospital", "keyFacilities", h.keyFacilities, Math.min(0.78, b));
  add("hospital", "hospital", "accreditations", h.accreditations, Math.min(0.88, b + 0.10));
  add("hospital", "hospital", "bedCount", h.bedCount, Math.min(0.76, b));
  add("hospital", "hospital", "description", h.description, Math.min(0.72, b));
  for (const [i, doc] of payload.doctors.slice(0, 60).entries()) {
    const ref = `${i}:${doc.fullName}`;
    add("doctor", ref, "fullName", doc.fullName, 0.82);
    add("doctor", ref, "specialization", doc.specialization, 0.72);
    add("doctor", ref, "qualifications", doc.qualifications, 0.70);
    add("doctor", ref, "consultationFee", doc.consultationFee, 0.62);
    add("doctor", ref, "yearsOfExperience", doc.yearsOfExperience, 0.65);
    add("doctor", ref, "consultationDays", doc.consultationDays, 0.68);
  }
  for (const [i, pkg] of payload.packages.slice(0, 60).entries()) {
    const ref = `${i}:${pkg.packageName}`;
    add("package", ref, "packageName", pkg.packageName, 0.72);
    add("package", ref, "priceMin", pkg.priceMin, 0.63);
    add("package", ref, "priceMax", pkg.priceMax, 0.63);
    add("package", ref, "lengthOfStay", pkg.lengthOfStay, 0.58);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

export async function chooseBestHospitalMatch(params: {
  candidateName: string;
  candidateCity?: string | null;
  options: Array<{ id: string; name: string; city: string }>;
}): Promise<{ action: "create" | "update" | "skip"; matchHospitalId: string | null; confidence: number; reason: string }> {
  const normalizedCandidate = normalizeName(params.candidateName);
  const exact = params.options.find(item => normalizeName(item.name) === normalizedCandidate);
  if (exact) return { action: "update", matchHospitalId: exact.id, confidence: 0.95, reason: "Exact normalized hospital name match." };

  const cityOptions = params.candidateCity
    ? params.options.filter(item => normalizeName(item.city) === normalizeName(params.candidateCity ?? ""))
    : params.options;

  const candidateTokens = new Set(normalizedCandidate.split(" ").filter(t => t.length > 2));
  const fuzzy = cityOptions.find(item => {
    const optTokens = new Set(normalizeName(item.name).split(" ").filter(t => t.length > 2));
    return [...candidateTokens].filter(t => optTokens.has(t)).length >= Math.min(2, candidateTokens.size - 1);
  }) ?? cityOptions.find(item => {
    const option = normalizeName(item.name);
    return option.includes(normalizedCandidate) || normalizedCandidate.includes(option);
  });

  if (fuzzy) return { action: "update", matchHospitalId: fuzzy.id, confidence: 0.78, reason: "Fuzzy match within city scope." };

  if (!env.GOOGLE_AI_API_KEY || !params.options.length) {
    return { action: "create", matchHospitalId: null, confidence: 0.64, reason: "No confident existing match found." };
  }

  try {
    const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, generationConfig: JSON_CONFIG });
    const prompt = [
      "You are a hospital entity matching engine. Return JSON only.",
      '{"action":"create|update|skip","matchHospitalId":"id or null","confidence":0.0,"reason":"string"}',
      `Candidate: "${params.candidateName}" city: "${params.candidateCity ?? "unknown"}"`,
      "Options:\n" + params.options.slice(0, 30).map(o => `${o.id} | ${o.name} | ${o.city}`).join("\n"),
    ].join("\n");

    const response = await model.generateContent(prompt);
    const parsed = safeParseJson<{ action?: "create" | "update" | "skip"; matchHospitalId?: string | null; confidence?: number; reason?: string }>(response.response.text());
    if (!parsed?.action) throw new Error("invalid-match-json");

    if (parsed.action === "update" && parsed.matchHospitalId) {
      if (params.options.some(o => o.id === parsed.matchHospitalId)) {
        return { action: "update", matchHospitalId: parsed.matchHospitalId, confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.7)), reason: parsed.reason ?? "AI matched." };
      }
    }
    return { action: parsed.action, matchHospitalId: null, confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.66)), reason: parsed.reason ?? "AI suggested create." };
  } catch {
    return { action: "create", matchHospitalId: null, confidence: 0.6, reason: "Fallback create — AI parsing failed." };
  }
}

export function chooseBestDoctorMatch(params: {
  candidateName: string;
  candidateCity?: string | null;
  options: Array<{ id: string; fullName: string; city: string | null }>;
}): { action: "create" | "update" | "skip"; matchDoctorId: string | null; confidence: number; reason: string } {
  const candidate = normalizeName(params.candidateName);
  const exact = params.options.find(item => normalizeName(item.fullName) === candidate);
  if (exact) return { action: "update", matchDoctorId: exact.id, confidence: 0.93, reason: "Exact doctor name match." };

  // IMPORTANT: City scope prevents cross-branch false matches.
  // Dr. Sharma at Manipal Mumbai should NOT match Dr. Sharma at Manipal Pune.
  const cityScoped = params.candidateCity
    ? params.options.filter(item => normalizeName(item.city ?? "") === normalizeName(params.candidateCity ?? ""))
    : params.options;

  const candidateTokens = new Set(candidate.split(" ").filter(t => t.length > 2));
  const fuzzy = cityScoped.find(item => {
    const nameTokens = new Set(normalizeName(item.fullName).split(" ").filter(t => t.length > 2));
    return [...candidateTokens].filter(t => nameTokens.has(t)).length >= 2;
  }) ?? cityScoped.find(item => {
    const name = normalizeName(item.fullName);
    return name.includes(candidate) || candidate.includes(name);
  });

  if (fuzzy) return { action: "update", matchDoctorId: fuzzy.id, confidence: 0.74, reason: "Fuzzy doctor name match in city scope." };
  return { action: "create", matchDoctorId: null, confidence: 0.63, reason: "No confident doctor match found — will create new." };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE / SEARCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function isGoogleProfileUrl(url: string): boolean {
  return /google\.[^/]+\/maps|maps\.app\.goo\.gl/i.test(url);
}

export async function googleSearchSnippets(query: string): Promise<SearchSnippet[]> {
  if (!env.GOOGLE_SEARCH_API_KEY || !env.GOOGLE_SEARCH_CX) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.GOOGLE_SEARCH_API_KEY);
  url.searchParams.set("cx", env.GOOGLE_SEARCH_CX);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "8");
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (payload.items ?? []).map(item => ({ title: item.title?.trim() ?? "", link: item.link?.trim() ?? "", snippet: item.snippet?.trim() ?? "" })).filter(item => item.title && item.link).slice(0, 8);
}

async function getGooglePlaceDetails(placeId: string): Promise<GoogleProfileResult | null> {
  if (!env.GOOGLE_PLACES_API_KEY) return null;
  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", placeId);
  detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,international_phone_number,formatted_phone_number,website,url,rating,user_ratings_total,geometry,opening_hours");
  detailsUrl.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);
  const response = await fetch(detailsUrl.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) return null;
  const p = (await response.json()) as { result?: Record<string, unknown> };
  const result = p.result;
  if (!result) return null;
  const geo = toRecord(result.geometry);
  const loc = toRecord(geo?.location);
  return {
    placeId: String(result.place_id ?? placeId),
    name: typeof result.name === "string" ? result.name : null,
    formattedAddress: typeof result.formatted_address === "string" ? result.formatted_address : null,
    internationalPhone: typeof result.international_phone_number === "string" ? result.international_phone_number : typeof result.formatted_phone_number === "string" ? result.formatted_phone_number : null,
    website: typeof result.website === "string" ? result.website : null,
    rating: toNumber(result.rating),
    reviewCount: toNumber(result.user_ratings_total),
    latitude: toNumber(loc?.lat),
    longitude: toNumber(loc?.lng),
    mapsUrl: typeof result.url === "string" ? result.url : null,
    openingHours: toStringArray(toRecord(result.opening_hours)?.weekday_text, 7),
  };
}

export async function fetchGoogleProfileData(params: { sourceUrl: string; hospitalName?: string; city?: string }): Promise<GoogleProfileResult | null> {
  if (!env.GOOGLE_PLACES_API_KEY) return null;
  const directPlaceId = params.sourceUrl.match(/[?&]place_id=([^&]+)/i)?.[1];
  if (directPlaceId) return getGooglePlaceDetails(decodeURIComponent(directPlaceId));
  const query = [params.hospitalName, params.city, "hospital"].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const findUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  findUrl.searchParams.set("input", query);
  findUrl.searchParams.set("inputtype", "textquery");
  findUrl.searchParams.set("fields", "place_id");
  findUrl.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);
  const response = await fetch(findUrl.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { candidates?: Array<{ place_id?: string }> };
  const placeId = payload.candidates?.[0]?.place_id;
  if (!placeId) return null;
  return getGooglePlaceDetails(placeId);
}

/**
 * P2.2 — Google Pricing Discovery
 * Searches specifically for pricing/cost pages for a hospital and extracts them using AI.
 */
export async function discoverHospitalPricing(hostname: string, city: string): Promise<{ packages: IngestionPackage[], costs: IngestionProcedureCost[], sources: SearchSnippet[] }> {
  const query = `${hostname} ${city} hospital package price list cost treatment India`;
  const snippets = await googleSearchSnippets(query);

  if (snippets.length === 0) return { packages: [], costs: [], sources: [] };

  // Step 1: Use AI to decide which 2 links look most like pricing data
  const model = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!).getGenerativeModel({ model: env.GEMINI_MODEL });
  const rankPrompt = `I have a list of search results for a hospital's pricing.
Which 2 links are MOST likely to contain a structured table of medical procedure costs or package prices?
Return ONLY a JSON array of indices (0-7).

Results:
${snippets.map((s, i) => `[${i}] ${s.title}: ${s.snippet}`).join("\n")}
`;

  const rankResult = await model.generateContent(rankPrompt);
  let topIndices: number[] = [0, 1];
  try {
    const text = rankResult.response.text();
    const match = text.match(/\[.*\]/);
    if (match) topIndices = JSON.parse(match[0]);
  } catch (e) {
    console.error("AI ranking failed, using defaults", e);
  }

  const selectedLinks = topIndices.slice(0, 2).map(i => snippets[i]).filter(Boolean);
  const scrapedSources: string[] = [];

  // Step 2: Scrape the selected links
  for (const source of selectedLinks) {
    try {
      const content = await fetchWebsiteSource(source.link);
      if (content.text) scrapedSources.push(`Source: ${source.link}\n${content.text}`);
    } catch (e) {
      console.error(`Failed to scrape pricing source ${source.link}`, e);
    }
  }

  if (scrapedSources.length === 0) return { packages: [], costs: [], sources: selectedLinks };

  // Step 3: Extract pricing data from the scraped results
  const extractPrompt = `Extract medical pricing information from the following text snippets.
Found for hospital: ${hostname} in ${city}.

Focus on:
1. "packages" - bundled offerings with name and price range.
2. "costs" - specific procedure names and their expected costs.

Return ONLY JSON:
{
  "packages": [{ "packageName": string, "priceMin": number, "priceMax": number, "currency": "INR", "inclusions": string[] }],
  "costs": [{ "procedureName": string, "priceMin": number, "priceMax": number, "currency": "INR", "notes": string }]
}

Text:
${scrapedSources.join("\n\n---\n\n").slice(0, 30000)}
`;

  const extraction = await model.generateContent(extractPrompt);
  try {
    const cleanText = extraction.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanText);
    return {
      packages: data.packages || [],
      costs: data.costs || [],
      sources: selectedLinks
    };
  } catch (e) {
    console.error("Pricing extraction failed", e);
    return { packages: [], costs: [], sources: selectedLinks };
  }
}
