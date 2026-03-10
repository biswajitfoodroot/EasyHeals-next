/**
 * src/lib/ingestion.ts
 *
 * EasyHeals – AI Website Scraping & Mapping Engine
 *
 * DROP-IN REPLACEMENT for the original file.
 * All exported types and function signatures are preserved so no other
 * files need to change.
 *
 * ─── What changed and why ────────────────────────────────────────────────────
 *
 * PROBLEM 1 – Only the root page was scraped.
 *   Hospital data is spread across sub-pages: /doctors, /services,
 *   /departments, /about, /contact. The original code never crawled them.
 *   FIX: crawlWebsitePages() discovers and fetches up to 12 high-value
 *   internal links in parallel batches of 3 and tags each page by category.
 *
 * PROBLEM 2 – Jina was only a fallback on 403.
 *   Many sites are JavaScript-rendered SPAs. A 200 response still returns
 *   an empty shell with no content. Jina Reader renders JS and returns clean
 *   text. Direct fetch only returns HTML source.
 *   FIX: both are run in parallel for the root page. Whichever returns more
 *   usable text content wins. Sub-pages always use direct fetch (Jina quota).
 *
 * PROBLEM 3 – One giant prompt tried to extract everything at once.
 *   A single 30k-token prompt for hospital + doctors + services + packages
 *   causes Gemini to miss fields, hallucinate, and hit output limits.
 *   FIX: Three focused passes, each with a tight system instruction:
 *     Pass A → Hospital identity + contact + accreditations
 *     Pass B → Doctors only (sent only doctor/team page text)
 *     Pass C → Services + packages + departments
 *
 * PROBLEM 4 – responseMimeType was not set.
 *   Without JSON mode the model wraps output in markdown fences or adds
 *   preamble text that breaks safeParseJson on edge cases.
 *   FIX: generationConfig.responseMimeType = "application/json".
 *
 * PROBLEM 5 – Phone regex missed landlines, toll-free, and spaced formats.
 *   FIX: parsePhones() now covers +91 mobile, 0XX-XXXXXXXX landline,
 *   1800-XXX-XXXX toll-free, and bare 10-digit numbers.
 *
 * PROBLEM 6 – Duplicate doctors when multiple pages mention the same person.
 *   FIX: mergeDoctors() deduplicates by normalized name and merges fields
 *   from multiple mentions (takes best non-null value per field).
 *
 * PROBLEM 7 – Hospital type was never detected.
 *   FIX: Pass A prompt infers type from text signals (bed count, "OPD only",
 *   "multi-speciality", "nursing home", "diagnostic centre", etc.).
 *   New optional field added to IngestionHospital without breaking the type.
 *
 * PROBLEM 8 – Token chunking was a hard slice to 30,000 chars.
 *   FIX: each pass gets its own appropriate text segment. Doctor pages go
 *   to Pass B, service pages go to Pass C. Root page text goes to Pass A.
 *   Total AI input is actually richer while each prompt is more focused.
 *
 * ─── Unchanged ───────────────────────────────────────────────────────────────
 *   All exported types (IngestionDoctor, IngestionHospital, etc.)
 *   chooseBestHospitalMatch, chooseBestDoctorMatch
 *   googleSearchSnippets, fetchGoogleProfileData, isGoogleProfileUrl
 *   stripHtmlToText, normalizeName, dedupeStrings
 *   WebsiteSourceResult shape (mode now has extra literal "jina" — additive)
 */

import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import { env } from "@/lib/env";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES  (all preserved from original)
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
  // NEW optional field — additive, no breaking change
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
  // NEW optional fields — additive
  accreditations?: string[];
  bedCount?: number | null;
  establishedYear?: string | null;
};

export type IngestionStructuredPayload = {
  hospital: IngestionHospital;
  doctors: IngestionDoctor[];
  services: IngestionService[];
  packages: IngestionPackage[];
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

// mode extended with "jina" (additive — no break)
export type WebsiteSourceResult = {
  html: string;
  text: string;
  mode: "direct" | "proxy_fallback" | "jina";
  warnings: string[];
  blockedStatus: number | null;
  /** NEW: additional pages crawled beyond root */
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

  constructor(input: {
    code: string;
    message: string;
    status?: number | null;
    retryable?: boolean;
    hint: string;
  }) {
    super(input.message);
    this.name = "IngestionSourceError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.retryable = Boolean(input.retryable);
    this.hint = input.hint;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES  (all preserved + extended)
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
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")        // strip nav clutter
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")   // strip footer clutter
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeParseJson<T>(raw: string): T | null {
  // Strip markdown fences
  const candidate = raw.includes("```") ? raw.replace(/```json|```/g, "").trim() : raw.trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Attempt to extract first JSON object/array from noisy output
    const match = candidate.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

function toStringArray(value: unknown, max = 20): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, max);
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

function normalizeConfidence(value: unknown, fallback: number): number {
  const parsed = toNumber(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

// ─── Phone parsing — now covers all Indian formats ───────────────────────────
function parsePhones(raw: string): string[] {
  const results: string[] = [];
  // +91 mobile
  for (const m of raw.matchAll(/\+91[-\s]?[6-9]\d{9}/g)) results.push(m[0].replace(/\s/g, ""));
  // Landline with STD code: 0XX-XXXXXXXX
  for (const m of raw.matchAll(/\b0[1-9]\d{1,3}[-\s]?\d{6,8}\b/g)) results.push(m[0].replace(/\s/g, ""));
  // Toll-free: 1800-XXX-XXXX
  for (const m of raw.matchAll(/\b1800[-\s]?\d{3}[-\s]?\d{4}\b/g)) results.push(m[0].replace(/\s/g, ""));
  // Bare 10-digit mobile (not preceded/followed by digit)
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
  const lines = raw
    .split(/[\n.]/)
    .map((l) => l.trim())
    .filter((l) => /package|surgery|procedure|angioplasty|cataract|delivery|knee replacement/i.test(l));
  const rows: IngestionPackage[] = [];
  for (const line of lines.slice(0, 36)) {
    const nameMatch = line.match(/([A-Za-z][A-Za-z\s-]{3,90}(?:package|surgery|procedure))/i);
    if (!nameMatch?.[1]) continue;
    const priceMatch = line.match(
      /(?:rs\.?|inr|rupees?|\u20b9)\s*([\d,]+)(?:\s*(?:-|to)\s*(?:rs\.?|inr|rupees?|\u20b9)?\s*([\d,]+))?/i,
    );
    const min = priceMatch?.[1] ? Number(priceMatch[1].replace(/,/g, "")) : null;
    const max = priceMatch?.[2] ? Number(priceMatch[2].replace(/,/g, "")) : min;
    rows.push({
      packageName: nameMatch[1].trim(),
      procedureName: nameMatch[1].trim(),
      priceMin: Number.isFinite(min ?? NaN) ? min : null,
      priceMax: Number.isFinite(max ?? NaN) ? max : null,
      currency: "INR",
      inclusions: null,
      exclusions: null,
      lengthOfStay: null,
    });
  }
  return rows.slice(0, 24);
}

function buildHeuristicFieldConfidences(
  payload: IngestionStructuredPayload,
  sourceUrl: string,
): IngestionFieldConfidence[] {
  const rows: IngestionFieldConfidence[] = [];
  const add = (
    entityType: IngestionFieldConfidence["entityType"],
    entityRef: string,
    fieldKey: string,
    value: unknown,
    confidence: number,
  ) => {
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

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
  Referer: "https://www.google.com/",
  DNT: "1",
};

async function fetchDirect(
  url: string,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; html: string } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, html: "" };
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch {
    return null;
  }
}

/**
 * Jina Reader: converts any web page to clean readable text/markdown.
 * Handles JavaScript-rendered SPAs and strips nav/ads/cookie banners.
 * Free tier: ~20 req/min — sufficient for crawling one hospital site.
 */
async function fetchViaJina(url: string, timeoutMs = 20_000): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers: Record<string, string> = {
      Accept: "text/plain",
      "X-Return-Format": "text",
      "X-Timeout": "15",
    };
    if (env.JINA_API_KEY) headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;

    const res = await fetch(jinaUrl, {
      method: "GET",
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Classify a URL path into a content category so we know which AI pass
 * to route the text to.
 */
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

/**
 * Extract internal links that are likely to contain useful medical data.
 * Skips images, PDFs, same-page anchors, and external domains.
 */
function extractValuableLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const VALUABLE =
    /doctor|physician|consultant|specialist|team|staff|service|treatment|department|facilit|about|contact|package|price|specialit|centre|center|procedure/i;

  const hrefs = [...html.matchAll(/href=["']([^"'#?][^"']*)/gi)].map((m) => m[1]);
  const seen = new Set<string>([baseUrl]);
  const out: string[] = [];

  for (const href of hrefs) {
    try {
      const abs = href.startsWith("http") ? href : new URL(href, base).href;
      const u = new URL(abs);
      if (
        u.hostname === base.hostname &&
        VALUABLE.test(u.pathname) &&
        !seen.has(abs) &&
        !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|zip)$/i.test(u.pathname)
      ) {
        seen.add(abs);
        out.push(abs);
      }
    } catch { /* skip malformed */ }
  }

  return out.slice(0, 12);
}

function toBlockedCode(status: number | null): string {
  if (status === 401 || status === 403) return "WEBSITE_ACCESS_BLOCKED";
  if (status === 406 || status === 451) return "WEBSITE_POLICY_BLOCKED";
  if (status === 429) return "WEBSITE_RATE_LIMITED";
  return "WEBSITE_FETCH_FAILED";
}

/**
 * fetchWebsiteSource — replaces original single-page fetch.
 *
 * Changes:
 *  • Root page: direct fetch + Jina run in parallel; best text wins
 *  • Sub-pages: up to 12 valuable links crawled in batches of 3
 *  • Jina fallback still works if direct is blocked
 *  • Returns crawledPages[] so AI passes can use page-specific text
 */
export async function fetchWebsiteSource(url: string): Promise<WebsiteSourceResult> {
  const warnings: string[] = [];

  // ── Root page: run direct + Jina in parallel ──────────────────────────────
  const [directResult, jinaText] = await Promise.allSettled([
    fetchDirect(url),
    fetchViaJina(url),
  ]);

  const direct = directResult.status === "fulfilled" ? directResult.value : null;
  const jina = jinaText.status === "fulfilled" ? jinaText.value : null;

  const directHtml = direct?.html ?? "";
  const directText = direct?.ok ? stripHtmlToText(directHtml) : "";
  const jinaClean = jina ?? "";

  // Blocked by server
  const blockedStatus =
    direct && !direct.ok && [401, 403, 406, 429, 451].includes(direct.status)
      ? direct.status
      : null;

  if (blockedStatus) {
    warnings.push(`Direct fetch returned ${blockedStatus}; using Jina Reader content.`);
  }

  // Pick richer content source
  const useJina = jinaClean.length > directText.length * 1.15;
  const rootText = useJina ? jinaClean.slice(0, 45_000) : directText.slice(0, 45_000);
  const rootHtml = useJina ? jinaClean.slice(0, 120_000) : directHtml.slice(0, 120_000);
  const mode: WebsiteSourceResult["mode"] = useJina
    ? direct?.ok ? "jina" : "proxy_fallback"
    : "direct";

  if (!rootText && !rootHtml) {
    throw new IngestionSourceError({
      code: toBlockedCode(blockedStatus ?? direct?.status ?? null),
      message: direct?.status
        ? `Website fetch failed with ${direct.status}`
        : "Website fetch failed",
      status: blockedStatus ?? direct?.status ?? null,
      retryable: [429, 503, 504].includes(direct?.status ?? 0),
      hint: blockedStatus === 403
        ? "This website is blocking automated access. Jina Reader also failed to access it."
        : "Could not access this website reliably. Try a different URL or wait and retry.",
    });
  }

  // ── Discover and crawl valuable sub-pages ─────────────────────────────────
  const subUrls = extractValuableLinks(rootHtml, url);
  const crawledPages: CrawledPage[] = [];

  if (subUrls.length > 0) {
    const BATCH = 3;
    for (let i = 0; i < subUrls.length; i += BATCH) {
      const batch = subUrls.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map((u) => fetchDirect(u, 10_000)));

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const pageUrl = batch[j];
        if (r.status === "fulfilled" && r.value?.ok && r.value.html.length > 300) {
          const text = stripHtmlToText(r.value.html).slice(0, 20_000);
          if (text.length > 200) {
            crawledPages.push({ url: pageUrl, text, category: classifyPageUrl(pageUrl) });
          }
        }
      }

      // Polite delay between batches
      if (i + BATCH < subUrls.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  return {
    html: rootHtml,
    text: rootText,
    mode,
    warnings,
    blockedStatus,
    crawledPages,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI EXTRACTION — THREE FOCUSED PASSES
// ═══════════════════════════════════════════════════════════════════════════════

// JSON mode config for all passes
const JSON_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.05,   // near-zero → deterministic, factual extraction
  maxOutputTokens: 8192,
};

// ── Pass A: Hospital core identity + contact ──────────────────────────────────
const SYSTEM_A = `You are EasyHeals hospital data extraction AI for India.
Extract ONLY hospital identity and contact information from the provided website text.
Return strict JSON. Use null for any field not clearly present in the text. Never invent data.

TYPE DETECTION rules — pick one:
  "hospital"          → multi-specialty, mentions beds / ICU / in-patient / 24-hour emergency
  "clinic"            → OPD only, no beds, single or small group of doctors
  "diagnostic_center" → primarily lab tests / scans / imaging (MRI, CT, X-ray, blood tests)
  "nursing_home"      → small inpatient facility, usually <50 beds, often single specialty
  "specialty_center"  → dedicated to one specialty (eye hospital, dental, IVF, ortho, etc.)

PHONE extraction rules:
  • Capture ALL phone numbers found (mobile, landline, toll-free, emergency)
  • Indian formats: +91XXXXXXXXXX, 0XX-XXXXXXXX, 1800-XXX-XXXX, bare 10-digit mobiles
  • Put primary contact in "phone", all others in "contactNumbers"

ACCREDITATIONS: look for NABH, NABL, JCI, ISO 9001, AHPI, CRISIL, AAA, NABH-Entry Level

OPERATING HOURS: structure as:
  { "monday": "9am–6pm", "saturday": "9am–2pm", "emergency": "24x7" }
  OR { "summary": "Mon–Sat 9am–6pm, Emergency 24x7" }

SOCIAL LINKS: only include URLs actually present in the source text.

CONFIDENCE: 0.0–1.0 reflecting how clearly each piece of data appears in text.

Return this exact JSON schema (omit keys you cannot fill — do NOT include keys with null unless they are important):
{
  "name": "string",
  "type": "hospital|clinic|diagnostic_center|nursing_home|specialty_center",
  "tagline": "string|null",
  "city": "string|null",
  "state": "string|null",
  "country": "India",
  "addressLine1": "full street address|null",
  "phone": "primary phone|null",
  "contactNumbers": ["all phones found"],
  "whatsapp": "string|null",
  "email": "primary email|null",
  "website": "string|null",
  "socialLinks": { "facebook": "url|null", "instagram": "url|null", "linkedin": "url|null", "youtube": "url|null", "x": "url|null" },
  "operatingHours": { "summary": "string" }|null,
  "accreditations": ["NABH","NABL",...],
  "bedCount": number|null,
  "establishedYear": "YYYY|null",
  "description": "max 300 char summary from About section|null",
  "specialties": ["standard specialty names"],
  "departments": ["department names"],
  "keyFacilities": ["ICU","NICU","Blood Bank","OT",...],
  "majorServices": ["service names"],
  "uniqueOfferings": ["anything distinctive about this provider"],
  "rating": number|null,
  "reviewCount": number|null,
  "confidence": 0.0-1.0
}`;

// ── Pass B: Doctors ───────────────────────────────────────────────────────────
const SYSTEM_B = `You are EasyHeals doctor data extraction AI for India.
Extract ALL doctors, consultants, physicians, and surgeons found in the provided text.
Return strict JSON. Use null for missing fields. NEVER invent names — only include people explicitly mentioned.

INCLUSION RULES:
  • Must have a medical title: Dr., Prof., MBBS, MD, MS, DM, MCh, FRCS, DNB, or similar
  • Include fullName with "Dr." prefix where present
  • DO include designation (Senior Consultant, HOD, Director of Cardiology, etc.)
  • DO include qualifications exactly as written (MBBS, MD, MS (Ortho), DNB, etc.)

SPECIALIZATION: map to standard specialty name:
  Cardiology | Orthopedics | Neurology | Oncology | Gynecology | Pediatrics |
  Urology | Nephrology | Gastroenterology | Pulmonology | ENT | Ophthalmology |
  Dermatology | Psychiatry | Radiology | Pathology | General Surgery | etc.

FEES: extract numeric INR values only (no ₹ symbol in the number field).
EXPERIENCE: numeric years only (from "15+ years" extract 15).
CONSULTATION DAYS: expand abbreviations → ["Monday","Wednesday","Friday"].

DEDUPLICATION: if the same doctor appears multiple times, include them once with the most complete data.

Return JSON:
{
  "doctors": [
    {
      "fullName": "Dr. FirstName LastName",
      "specialization": "string|null",
      "qualifications": ["MBBS","MD",...],
      "designation": "Senior Consultant|HOD|string|null",
      "yearsOfExperience": number|null,
      "languages": ["English","Hindi",...],
      "phone": "string|null",
      "email": "string|null",
      "consultationFee": number|null,
      "feeMin": number|null,
      "feeMax": number|null,
      "consultationDays": ["Monday","Tuesday",...],
      "opdTiming": "10am-1pm, 4pm-7pm|null",
      "schedule": { "Monday": "10am-1pm", ... }|null,
      "confidence": 0.0-1.0
    }
  ]
}`;

// ── Pass C: Services, packages, departments ───────────────────────────────────
const SYSTEM_C = `You are EasyHeals services & packages data extraction AI for India.
Extract all medical services, treatment packages, procedures, and departments.
Return strict JSON. Use null for missing fields.

SERVICE CATEGORIES (use exactly one per service):
  "Diagnostics" | "Surgery" | "OPD Consultation" | "Emergency" |
  "Preventive" | "Rehabilitation" | "Maternity" | "Pediatric" | "Other"

PACKAGES:
  • Named bundles with a price range (e.g. "Cardiac Wellness Package – ₹15,000")
  • priceMin / priceMax: numeric INR only (no symbols)
  • lengthOfStay: e.g. "3 days", "1 week", or null
  • inclusions / exclusions: as object { "items": ["...","..."] } or null

DEPARTMENTS: named hospital units (Cardiology Dept, Emergency Unit, NICU, Blood Bank OT, etc.)

Return JSON:
{
  "services": [
    { "name": "string", "category": "Diagnostics|Surgery|...", "description": "string|null" }
  ],
  "packages": [
    {
      "packageName": "string",
      "procedureName": "string|null",
      "department": "string|null",
      "priceMin": number|null,
      "priceMax": number|null,
      "currency": "INR",
      "inclusions": { "items": ["..."] }|null,
      "exclusions": { "items": ["..."] }|null,
      "lengthOfStay": "string|null"
    }
  ],
  "departments": ["string", ...]
}`;

// ── Generic Gemini runner ─────────────────────────────────────────────────────
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

// ── Doctor dedup + merge across pages ────────────────────────────────────────
function mergeDoctors(doctors: IngestionDoctor[]): IngestionDoctor[] {
  const map = new Map<string, IngestionDoctor>();
  for (const doc of doctors) {
    const key = normalizeName(doc.fullName);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, doc);
    } else {
      // Merge: prefer non-null value; concat arrays
      map.set(key, {
        ...existing,
        specialization: existing.specialization ?? doc.specialization,
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
  return Array.from(map.values()).slice(0, 80);
}

// ── Heuristic fallback (AI unavailable) ──────────────────────────────────────
function heuristicExtract(
  websiteUrl: string,
  allText: string,
  hints: { hospitalName?: string; city?: string },
  googleProfile: GoogleProfileResult | null,
): IngestionStructuredPayload {
  const doctorMatches = allText.match(
    /(?:Dr\.?|Prof\.?)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z.]+){0,3}/g,
  ) ?? [];

  const serviceKeywords = allText.match(
    /(cardiology|orthopaedics?|orthopedics?|neurology|oncology|ivf|urology|nephrology|gastroenterology|pulmonology|gynaecology|gynecology|ent|ophthalmology|dermatology|psychiatry|radiology|pathology|emergency|trauma|icu|nicu|dialysis|mri|ct scan|x-ray|endoscopy|laparoscopy|cataract|lasik|angioplasty|bypass|transplant)/gi,
  ) ?? [];

  const services = dedupeStrings(serviceKeywords, 40);
  const departments = dedupeStrings(
    services.filter((s) => /cardio|ortho|neuro|onco|ivf|uro|pulmo|gyn|ent|ophthal|derma|nephro|gastro/i.test(s)),
    24,
  );
  const keyFacilities = dedupeStrings(
    services.filter((s) => /icu|nicu|dialysis|emergency|trauma|mri|ct|blood bank|pharmacy/i.test(s)),
    24,
  );
  const phones = parsePhones(allText);
  const emails = parseEmails(allText);
  const socialLinks = parseSocialLinks(allText);
  const packages = parsePackagesFromText(allText);
  const nameHint =
    hints.hospitalName ??
    googleProfile?.name ??
    new URL(websiteUrl).hostname.replace(/^www\./i, "").replace(/[-_]/g, " ");

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
      operatingHours: googleProfile?.openingHours.length
        ? { weekdayText: googleProfile.openingHours }
        : parseOperatingHours(allText),
      departments,
      majorServices: services.slice(0, 30),
      keyFacilities,
      uniqueOfferings: dedupeStrings(keyFacilities.filter((s) => /trauma|emergency|dialysis|icu|mri|ct/i.test(s)), 16),
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
    doctors: dedupeStrings(doctorMatches, 30).map((fullName) => ({
      fullName,
      specialization: null,
      qualifications: [],
      languages: [],
      consultationDays: [],
      opdTiming: null,
      consultationFee: null,
      schedule: null,
    })),
    services: services.slice(0, 40).map((name) => ({ name })),
    packages,
    fieldConfidences: [],
    confidence: googleProfile ? 0.45 : 0.3,
    notes: ["Heuristic extraction — AI unavailable or API key missing."],
  };

  payload.fieldConfidences = buildHeuristicFieldConfidences(payload, websiteUrl);
  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractStructuredFromSources  — main export, signature preserved
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Takes website text (root + sub-pages) and runs three focused Gemini passes
 * to extract hospital, doctor, and service data.
 *
 * Signature is backwards-compatible with the original:
 *   websiteUrl, websiteText, searchSnippets, hints, googleProfile
 *
 * New optional parameter:
 *   crawledPages — from the updated fetchWebsiteSource(); pass it through for
 *   maximum accuracy. Safe to omit for callers that haven't been updated yet.
 */
export async function extractStructuredFromSources(params: {
  websiteUrl: string;
  websiteText: string;
  searchSnippets: SearchSnippet[];
  hints: { hospitalName?: string; city?: string };
  googleProfile?: GoogleProfileResult | null;
  // NEW optional — sub-pages from fetchWebsiteSource
  crawledPages?: CrawledPage[];
}): Promise<IngestionStructuredPayload> {
  const crawledPages = params.crawledPages ?? [];

  // Build per-category text segments from sub-pages
  const doctorPageText = crawledPages
    .filter((p) => p.category === "doctors")
    .map((p) => p.text)
    .join("\n\n")
    .slice(0, 24_000);

  const servicePageText = crawledPages
    .filter((p) => ["services", "departments", "packages", "facilities"].includes(p.category))
    .map((p) => p.text)
    .join("\n\n")
    .slice(0, 20_000);

  const aboutPageText = crawledPages
    .filter((p) => ["about", "contact", "general"].includes(p.category))
    .map((p) => p.text)
    .join("\n\n")
    .slice(0, 8_000);

  const allText = [params.websiteText, ...crawledPages.map((p) => p.text)].join("\n\n").slice(0, 60_000);

  // Always build heuristic fallback
  const fallback = heuristicExtract(
    params.websiteUrl,
    allText,
    params.hints,
    params.googleProfile ?? null,
  );

  if (!env.GOOGLE_AI_API_KEY) return fallback;

  try {
    const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

    // Context block sent at the start of every pass
    const ctx = [
      `Hospital name hint: ${params.hints.hospitalName ?? "unknown"}`,
      `City hint: ${params.hints.city ?? "unknown"}`,
      `Website URL: ${params.websiteUrl}`,
    ].join("\n");

    // ── PASS A  — Hospital core ────────────────────────────────────────────
    const modelA = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_A, generationConfig: JSON_CONFIG });
    const passAInput = [ctx, "ROOT PAGE:\n" + params.websiteText.slice(0, 24_000), aboutPageText].join("\n\n");
    const passA = await runPass<Partial<IngestionHospital>>(modelA, passAInput, {});

    // ── PASS B  — Doctors ──────────────────────────────────────────────────
    const modelB = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_B, generationConfig: JSON_CONFIG });
    const passBInput = [
      ctx,
      doctorPageText ? "DOCTOR PAGES:\n" + doctorPageText : "DOCTOR PAGES: none found separately.",
      "ROOT PAGE (may contain doctor listings):\n" + params.websiteText.slice(0, 45_000),
    ].join("\n\n");
    const passB = await runPass<{ doctors?: unknown[] }>(modelB, passBInput, { doctors: [] });

    // ── PASS C  — Services + Packages + Departments ────────────────────────
    const modelC = genAI.getGenerativeModel({ model: env.GEMINI_MODEL, systemInstruction: SYSTEM_C, generationConfig: JSON_CONFIG });
    const passCInput = [
      ctx,
      servicePageText ? "SERVICE/DEPARTMENT PAGES:\n" + servicePageText : "SERVICE PAGES: none found separately.",
      "ROOT PAGE:\n" + params.websiteText.slice(0, 45_000),
    ].join("\n\n");
    const passC = await runPass<{ services?: unknown[]; packages?: unknown[]; departments?: unknown[] }>(
      modelC, passCInput, { services: [], packages: [], departments: [] },
    );

    // ── Validate Pass A ────────────────────────────────────────────────────
    if (!passA?.name) return fallback;

    // ── Merge departments from A + C ──────────────────────────────────────
    const mergedDepartments = dedupeStrings([
      ...toStringArray(passA.departments, 40),
      ...toStringArray(passC.departments, 40),
    ], 40);

    // ── Normalize + dedup doctors from Pass B ─────────────────────────────
    const rawDoctors = ((passB.doctors ?? []) as IngestionDoctor[])
      .filter((d): d is IngestionDoctor => Boolean(d?.fullName));
    const mergedDoctors = mergeDoctors(rawDoctors);

    // ── Normalize services from Pass C ────────────────────────────────────
    const mergedServices: IngestionService[] = ((passC.services ?? []) as IngestionService[])
      .filter((s): s is IngestionService => Boolean(s?.name))
      .slice(0, 80)
      .map((s) => ({
        name: String(s.name).trim(),
        category: s.category ?? null,
        description: s.description ?? null,
      }));

    // ── Normalize packages from Pass C; fallback to heuristic regex ───────
    const mergedPackages: IngestionPackage[] = ((passC.packages ?? []) as IngestionPackage[])
      .filter((p): p is IngestionPackage => Boolean(p?.packageName))
      .slice(0, 80)
      .map((p) => ({
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

    // ── Compute confidence from field population ──────────────────────────
    const filledCoreFields = [passA.name, passA.phone, passA.city, passA.email, passA.addressLine1, passA.description].filter(Boolean).length;
    const aiConfidence = Math.min(0.95, 0.5 + filledCoreFields * 0.07 + (mergedDoctors.length > 0 ? 0.08 : 0));

    // ── Phones: merge AI result with regex-found phones ───────────────────
    const allPhones = dedupeStrings([
      ...(toStringArray(passA.contactNumbers, 12)),
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
        operatingHours: toRecord(passA.operatingHours) ??
          (params.googleProfile?.openingHours.length ? { weekdayText: params.googleProfile.openingHours } : null),
        departments: mergedDepartments,
        majorServices: toStringArray(passA.majorServices, 40),
        keyFacilities: toStringArray(passA.keyFacilities, 40),
        uniqueOfferings: toStringArray(passA.uniqueOfferings, 30),
        accreditations: toStringArray(passA.accreditations, 10),
        description: passA.description ?? null,
        specialties: dedupeStrings([...toStringArray(passA.specialties, 30), ...mergedDepartments.slice(0, 10)], 30),
        services: mergedServices.map((s) => s.name),
        bedCount: toNumber(passA.bedCount),
        establishedYear: passA.establishedYear ?? null,
        rating: toNumber(passA.rating) ?? params.googleProfile?.rating ?? null,
        reviewCount: toNumber(passA.reviewCount) ?? params.googleProfile?.reviewCount ?? null,
        latitude: toNumber(passA.latitude) ?? params.googleProfile?.latitude ?? null,
        longitude: toNumber(passA.longitude) ?? params.googleProfile?.longitude ?? null,
        sourceLinks: dedupeStrings([params.websiteUrl, params.googleProfile?.mapsUrl ?? null, ...crawledPages.map((p) => p.url)], 20),
        googlePlaceId: (typeof passA.googlePlaceId === "string" ? passA.googlePlaceId : null) ?? params.googleProfile?.placeId ?? null,
      },
      doctors: mergedDoctors,
      services: mergedServices,
      packages: mergedPackages.length ? mergedPackages : fallback.packages,
      fieldConfidences: [],
      confidence: aiConfidence,
      notes: [
        `3-pass AI extraction (hospital core / doctors / services).`,
        `Sub-pages crawled: ${crawledPages.length}.`,
        `Doctors extracted: ${mergedDoctors.length}.`,
        `Services extracted: ${mergedServices.length}.`,
        `Packages extracted: ${mergedPackages.length}.`,
      ],
    };

    // Build per-field confidence scores
    output.fieldConfidences = buildAiFieldConfidences(output, params.websiteUrl);
    return output;

  } catch {
    return fallback;
  }
}

function buildAiFieldConfidences(
  payload: IngestionStructuredPayload,
  sourceUrl: string,
): IngestionFieldConfidence[] {
  const rows: IngestionFieldConfidence[] = [];
  const add = (
    entityType: IngestionFieldConfidence["entityType"],
    entityRef: string,
    fieldKey: string,
    value: unknown,
    confidence: number,
  ) => {
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
// ENTITY MATCHING  (preserved from original + improved fuzzy)
// ═══════════════════════════════════════════════════════════════════════════════

export async function chooseBestHospitalMatch(params: {
  candidateName: string;
  candidateCity?: string | null;
  options: Array<{ id: string; name: string; city: string }>;
}): Promise<{ action: "create" | "update" | "skip"; matchHospitalId: string | null; confidence: number; reason: string }> {
  const normalizedCandidate = normalizeName(params.candidateName);

  const exact = params.options.find((item) => normalizeName(item.name) === normalizedCandidate);
  if (exact) {
    return { action: "update", matchHospitalId: exact.id, confidence: 0.95, reason: "Exact normalized hospital name match." };
  }

  const cityOptions = params.candidateCity
    ? params.options.filter((item) => normalizeName(item.city) === normalizeName(params.candidateCity ?? ""))
    : params.options;

  // Improved: token-based fuzzy handles "Apollo Hospitals Pune" vs "Apollo Hospital Pune"
  const candidateTokens = new Set(normalizedCandidate.split(" ").filter((t) => t.length > 2));
  const fuzzy = cityOptions.find((item) => {
    const optTokens = new Set(normalizeName(item.name).split(" ").filter((t) => t.length > 2));
    const overlap = [...candidateTokens].filter((t) => optTokens.has(t));
    return overlap.length >= Math.min(2, candidateTokens.size - 1);
  }) ?? cityOptions.find((item) => {
    const option = normalizeName(item.name);
    return option.includes(normalizedCandidate) || normalizedCandidate.includes(option);
  });

  if (fuzzy) {
    return { action: "update", matchHospitalId: fuzzy.id, confidence: 0.78, reason: "Fuzzy match within city scope." };
  }

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
      "Options:\n" + params.options.slice(0, 30).map((o) => `${o.id} | ${o.name} | ${o.city}`).join("\n"),
    ].join("\n");

    const response = await model.generateContent(prompt);
    const parsed = safeParseJson<{ action?: "create" | "update" | "skip"; matchHospitalId?: string | null; confidence?: number; reason?: string }>(response.response.text());

    if (!parsed?.action) throw new Error("invalid-match-json");

    if (parsed.action === "update" && parsed.matchHospitalId) {
      if (params.options.some((o) => o.id === parsed.matchHospitalId)) {
        return { action: "update", matchHospitalId: parsed.matchHospitalId, confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.7)), reason: parsed.reason ?? "AI matched candidate to existing hospital." };
      }
    }

    return { action: parsed.action, matchHospitalId: null, confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.66)), reason: parsed.reason ?? "AI suggested creating new hospital record." };
  } catch {
    return { action: "create", matchHospitalId: null, confidence: 0.6, reason: "Fallback create recommendation due to AI parsing failure." };
  }
}

export function chooseBestDoctorMatch(params: {
  candidateName: string;
  candidateCity?: string | null;
  options: Array<{ id: string; fullName: string; city: string | null }>;
}): { action: "create" | "update" | "skip"; matchDoctorId: string | null; confidence: number; reason: string } {
  const candidate = normalizeName(params.candidateName);

  const exact = params.options.find((item) => normalizeName(item.fullName) === candidate);
  if (exact) return { action: "update", matchDoctorId: exact.id, confidence: 0.93, reason: "Exact doctor name match." };

  const cityScoped = params.candidateCity
    ? params.options.filter((item) => normalizeName(item.city ?? "") === normalizeName(params.candidateCity ?? ""))
    : params.options;

  // Token-based fuzzy for doctors: first + last name both match
  const candidateTokens = new Set(candidate.split(" ").filter((t) => t.length > 2));
  const fuzzy = cityScoped.find((item) => {
    const nameTokens = new Set(normalizeName(item.fullName).split(" ").filter((t) => t.length > 2));
    return [...candidateTokens].filter((t) => nameTokens.has(t)).length >= 2;
  }) ?? cityScoped.find((item) => {
    const name = normalizeName(item.fullName);
    return name.includes(candidate) || candidate.includes(name);
  });

  if (fuzzy) return { action: "update", matchDoctorId: fuzzy.id, confidence: 0.74, reason: "Fuzzy doctor name match in city scope." };

  return { action: "create", matchDoctorId: null, confidence: 0.63, reason: "No confident doctor match found." };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE / SEARCH HELPERS  (preserved unchanged)
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
  return (payload.items ?? []).map((item) => ({ title: item.title?.trim() ?? "", link: item.link?.trim() ?? "", snippet: item.snippet?.trim() ?? "" })).filter((item) => item.title && item.link).slice(0, 8);
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

export async function fetchGoogleProfileData(params: {
  sourceUrl: string;
  hospitalName?: string;
  city?: string;
}): Promise<GoogleProfileResult | null> {
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
