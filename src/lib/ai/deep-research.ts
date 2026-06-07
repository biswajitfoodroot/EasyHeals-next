/**
 * Shared deep-research utilities used by:
 *   /api/admin/research/agent        — single + batch research
 *   /api/admin/research/batch/process — DB-driven batch processing
 */

import { eq, and, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  hospitals,
  ingestionJobs,
  ingestionSources,
  ingestionHospitalCandidates,
  ingestionDoctorCandidates,
  ingestionServiceCandidates,
  ingestionPackageCandidates,
} from "@/db/schema";
import { normalizeCityName } from "@/lib/strings";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_DISCOVERY_ENTITIES = 5;
export const MAX_CONCURRENCY = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiscoveredEntity = {
  name: string;
  city: string | null;
  state: string | null;
  type: string;
  address: string | null;
  area: string | null;
  landmark: string | null;
  pinCode: string | null;
  phone: string | null;
  emergencyPhone: string | null;
  website: string | null;
  googleRating: string | null;
  reviewCount: string | null;
  bedCount: string | null;
  topDoctors: string[];
  topSpecialties: string[];
  sourceUrl: string | null;
  confidence: "high" | "medium" | "low";
};

// ── Input intent classifier ───────────────────────────────────────────────────

/** Returns "discovery_search" if the input looks like a search/discovery query
 *  (e.g. "Top 5 hospitals in Kolkata"), or "entity_profile" if it is a specific
 *  named provider (e.g. "Apollo Gleneagles Hospital").
 *  Key rule: only classify as discovery if query STARTS with a category word or
 *  search intent. A query starting with a proper name is always an entity.
 */
export function classifyInput(input: string): "entity_profile" | "discovery_search" {
  const q = input.toLowerCase().trim();
  const patterns = [
    /^top\s+\d+/,                                                   // "Top 5 ..."
    /^best\s+(hospital|clinic|doctor|surgeon|specialist)/,           // "Best hospitals ..."
    /^list\s+of/,                                                    // "List of ..."
    /^find\s+(hospitals?|clinics?|doctors?)/,                        // "Find hospitals ..."
    /^(hospitals?|clinics?|doctors?)\s+(in|near|at)\s+/,            // "Hospitals in ..."
    /^\d+\s+(hospitals?|clinics?)\s+in\s+/,                         // "5 hospitals in ..."
    /near\s+me/,                                                     // "... near me"
  ];
  return patterns.some(p => p.test(q)) ? "discovery_search" : "entity_profile";
}

/** Validates, deduplicates, confidence-sorts and caps discovered entities.
 *  Strictly follows the design spec validation layer.
 */
export function validateDiscoveredEntities(
  entities: any[],
  maxCount = MAX_DISCOVERY_ENTITIES,
): DiscoveredEntity[] {
  if (!Array.isArray(entities)) return [];

  // 1. Remove blanks / nulls
  const valid = entities.filter(e => e?.name && String(e.name).trim().length > 2);

  // 2. Deduplicate by normalized name
  const seen = new Set<string>();
  const deduped = valid.filter(e => {
    const key = String(e.name).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Prefer high/medium confidence entities first
  const sorted = [
    ...deduped.filter(e => e.confidence === "high"),
    ...deduped.filter(e => e.confidence === "medium"),
    ...deduped.filter(e => e.confidence === "low"),
    ...deduped.filter(e => !["high", "medium", "low"].includes(e.confidence)),
  ];

  // 4. Cap at maxCount and normalize shape
  return sorted.slice(0, maxCount).map(e => ({
    name: String(e.name).trim(),
    city: e.city ? String(e.city).trim() : null,
    state: e.state ? String(e.state).trim() : null,
    type: e.type || "hospital",
    address: e.address ? String(e.address).trim() : null,
    area: e.area ? String(e.area).trim() : null,
    landmark: e.landmark ? String(e.landmark).trim() : null,
    pinCode: e.pinCode ? String(e.pinCode).trim() : null,
    phone: e.phone ? String(e.phone).trim() : null,
    emergencyPhone: e.emergencyPhone ? String(e.emergencyPhone).trim() : null,
    website: e.website ? String(e.website).trim() : null,
    googleRating: e.googleRating ? String(e.googleRating).trim() : null,
    reviewCount: e.reviewCount ? String(e.reviewCount).trim() : null,
    bedCount: e.bedCount ? String(e.bedCount).trim() : null,
    topDoctors: Array.isArray(e.topDoctors) ? e.topDoctors.map(String) : [],
    topSpecialties: Array.isArray(e.topSpecialties) ? e.topSpecialties.map(String) : [],
    sourceUrl: e.sourceUrl ? String(e.sourceUrl).trim() : null,
    confidence: (["high", "medium", "low"] as const).includes(e.confidence)
      ? e.confidence as "high" | "medium" | "low"
      : "medium",
  }));
}

// ── Discovery System Prompt ───────────────────────────────────────────────────

export const DISCOVERY_SYSTEM = `You are a healthcare provider discovery AI for India.

Given a search query, use Google Search grounding to find REAL, NAMED hospitals and clinics that match.
Return ONLY providers that are clearly confirmed by search results. NEVER invent providers.

DISCOVERY RULES:
1. GEO ENFORCEMENT: Only return providers within the requested geography (city, district, state).
2. CONFIDENCE SCORING: "high" = 3+ sources confirm, "medium" = 1-2 sources, "low" = single mention
3. RANKING: If query says "top" or "best", rank providers by: Google rating (descending) → review count (descending) → hospital size/bed count → source credibility.
4. NEVER INVENT: Only include providers confirmed by grounding sources.
5. SOURCE DIVERSITY: Cross-reference Google Maps, Practo, JustDial, Sulekha, hospital directories
6. AFFILIATED DOCTORS: For each hospital found, also include top doctor names if visible in search results
7. BASIC PRICING: Include any pricing hints visible in search results (e.g. "starts from ₹500")
8. Always include PIN code, area/locality, landmark if visible in search results

For each discovered provider return:
- name: exact official name as found in sources
- city: CITY NAME ONLY — e.g. "Pune", "Mumbai", "Chennai". NEVER put locality/area/pincode here (e.g. NOT "Baner, Pune", NOT "Erandwane", NOT "411001"). If only locality is known, infer the parent city.
- state: state if found
- type: hospital | clinic | diagnostic_center | nursing_home | specialty_center
- address: brief address if found (null if not found)
- area: neighborhood/locality (e.g. "Salt Lake", "Bandra West") (null if not found)
- landmark: nearby landmark (null if not found)
- pinCode: 6-digit Indian PIN code (null if not found)
- phone: primary phone number (null if not found)
- emergencyPhone: emergency/ambulance number (null if not found)
- website: official website URL (null if not found)
- googleRating: rating like "4.2" (null if not found)
- reviewCount: number of reviews (null if not found)
- bedCount: number of beds if mentioned (null if not found)
- topDoctors: array of doctor names found in search results (empty array if none)
- topSpecialties: array of specialties mentioned (empty array if none)
- sourceUrl: the URL where this provider was found
- confidence: "high" | "medium" | "low"

Return strict JSON:
{
  "entities": [
    {
      "name": "string",
      "city": "string",
      "state": "string|null",
      "type": "hospital|clinic|diagnostic_center|nursing_home|specialty_center",
      "address": "string|null",
      "area": "string|null",
      "landmark": "string|null",
      "pinCode": "string|null",
      "phone": "string|null",
      "emergencyPhone": "string|null",
      "website": "string|null",
      "googleRating": "string|null",
      "reviewCount": "string|null",
      "bedCount": "string|null",
      "topDoctors": [],
      "topSpecialties": [],
      "sourceUrl": "string|null",
      "confidence": "high|medium|low"
    }
  ],
  "queryIntent": "string — what was searched for",
  "geographyUsed": "string — actual geography that was searched",
  "totalFound": 0
}`;

// ── Deep Research System Prompt ───────────────────────────────────────────────

export const DEEP_RESEARCH_SYSTEM = `You are EasyHeals healthcare research and structured data extraction AI for India.

OBJECTIVE: For every hospital/clinic, collect the MOST COMPLETE structured profile possible.
Return strict JSON only. Use null for fields not clearly found. NEVER invent data.
Cross-reference all available information from the grounded research content.
Your goal is to MINIMIZE manual data entry — extract EVERYTHING available.

SOURCE PRIORITY (use in this order — cross-reference ALL available sources):
1. Official hospital website (home, about, doctors directory, services, packages/pricing pages)
2. Google Business Profile / Google Maps listing (address, PIN, phone, rating, reviews, hours)
3. Practo hospital page: practo.com/[city]/hospital/[slug] (doctors, fees, reviews, services)
4. JustDial / Sulekha / other credible directories (phone, address, reviews)
5. Credihealth / GoMedii / Lyfboat (treatment cost pages)
6. Patient review platforms (Google Reviews, Practo Reviews)
7. Hospital pricing/package pages or estimate calculators
8. Other credible medical portals

MANDATORY BASIC DETAILS — ALWAYS try to extract:
- Hospital/clinic name, full address with street, area/locality, city, state
- city: CITY NAME ONLY (e.g. "Pune", "Kolkata", "Chennai"). NEVER put locality/area/pincode in the city field. Locality goes in "area". Pincode goes in "pinCode". If hospital is in "Baner, Pune" → city is "Pune", area is "Baner".
- PIN code: Indian 6-digit postal code (e.g. 700001, 411038). ALWAYS search for this explicitly.
- Landmark: nearest well-known landmark for navigation (e.g. "Near Ruby General Hospital")
- Area/Locality: neighborhood name (e.g. "Salt Lake Sector V", "Bandra West", "Anandapur")
- ALL phone numbers, WhatsApp number, emergency/ambulance number
- Email address(es), official website URL
- Google rating + review count
- Bed count, accreditations (NABH, NABL, JCI, ISO), established year
- Operating hours, parking availability, nearest metro/railway station
- Insurance panels accepted, payment modes

SPECIALTY MASTER LIST (40 standard names — normalize all variants to exactly these):
Anaesthesiology | Bariatric Surgery | Cardiology | Cardiothoracic Surgery | Colorectal Surgery |
Dental & Oral Surgery | Dermatology | ENT (Ear, Nose & Throat) | Emergency Medicine | Endocrinology |
Gastroenterology | General Medicine & Internal Medicine | General Surgery | Geriatrics |
Gynaecology & Obstetrics | Haematology | Hepatology | Immunology & Allergy | Neonatology | Nephrology |
Neurology | Neurosurgery | Nutrition & Dietetics | Oncology | Ophthalmology | Orthopaedics |
Paediatric Surgery | Paediatrics | Palliative Care | Plastic & Reconstructive Surgery | Psychiatry |
Pulmonology | Radiology & Imaging | Reproductive Medicine & IVF | Rheumatology | Spine Surgery |
Sports Medicine | Transplant Medicine | Urology | Vascular Surgery

Normalization rules: colorectal-surgery → Colorectal Surgery | sports-medicine → Sports Medicine |
general medicine / internal medicine → General Medicine & Internal Medicine | ENT → ENT (Ear, Nose & Throat)
Remove duplicate doctors, duplicate phone numbers, and duplicate specialties.

SPECIALTY AUDIT RULES — audit ALL 40 specialties:
  "available"  → Clearly present (doctor listed, dedicated department, or specific procedures found)
  "not_found"  → Not mentioned anywhere in sources
  "unclear"    → Mentioned vaguely without specific evidence
  For each available specialty, list the doctors found and key procedures/services.

CROSS-REFERENCE RULES:
  When researching a HOSPITAL:
    - Search Practo for doctors affiliated with this hospital
    - Search Google for "doctors at [hospital name]"
    - For each doctor found, note which specialties they represent
    - Check: Practo hospital page, JustDial listing, Google Maps reviews for doctor names
  When researching a DOCTOR:
    - Find all hospitals/clinics where this doctor practices
    - Note affiliatedHospitals with name, city, and role/designation at each

PRICE RESEARCH — MULTI-SOURCE (actively search for ALL procedure prices):
  Search the hospital website, Practo treatment cost pages, Credihealth, GoMedii, or Google.
  For EACH specialty marked as "available", search for its key procedures:
  - Cardiology: Angiography ₹15K-40K, Angioplasty ₹1.2L-3.5L, CABG ₹1.5L-4L, Pacemaker ₹80K-3L, ECG, Echo
  - Orthopaedics: Knee Replacement ₹1.5L-4L, Hip Replacement ₹2L-5L, ACL ₹80K-2L, Arthroscopy
  - General Surgery: Hernia ₹40K-1.2L, Appendectomy ₹30K-80K, Cholecystectomy ₹40K-1L
  - Urology: Kidney Stone (PCNL/RIRS) ₹60K-1.5L, TURP ₹50K-1.2L, Circumcision ₹15K-30K
  - Gynaecology: Normal Delivery ₹20K-60K, C-Section ₹40K-1.5L, Hysterectomy ₹50K-1.5L
  - Reproductive Medicine: IVF Cycle ₹1L-2.5L, IUI ₹10K-20K
  - Oncology: Chemotherapy (per cycle) ₹30K-1L
  - Ophthalmology: Cataract (Phaco+IOL) ₹20K-60K, LASIK ₹25K-80K
  - ENT: Tonsillectomy, Septoplasty, Tympanoplasty
  - Bariatric: Sleeve Gastrectomy ₹2L-5L, Gastric Bypass ₹3L-7L
  - Neurosurgery: Craniotomy ₹1L-4L, Spine Decompression ₹1L-3L
  - Gastroenterology: Endoscopy ₹3K-8K, Colonoscopy ₹5K-12K, ERCP
  - Diagnostics: MRI ₹3K-8K, CT Scan ₹2K-5K, ECG ₹200-500, Ultrasound, X-Ray
  - Transplant: Kidney Transplant, Liver Transplant (if publicly available)
  - Nephrology: Dialysis (per session) ₹1.5K-3K
  - Vascular Surgery: Varicose Vein Surgery, AV Fistula
  - Spine Surgery: Spinal Fusion, Disc Replacement

  Label each price with its source clearly:
  priceType: "hospital-specific" | "practo-listed" | "city-range" | "market-estimated"
  priceSource: "official_website" | "practo" | "credihealth" | "google_search" | "justdial" | "estimated"
  All prices in INR numerically (lakhs → multiply by 100000). Keep null if completely unavailable.

CONTACT RULES:
  Extract ALL phone numbers. Identify WhatsApp and emergency/ambulance numbers separately.
  Email: array of all found emails. Rating: Google rating if found (e.g. "4.3/5 on Google").

DOCTOR RULES:
  Only include named doctors with medical credentials (Dr., MBBS, MD, MS, DNB, DM, MCh, etc.)
  DEDUPLICATION: merge duplicate entries into one complete record.
  Normalize specialization to the 40-specialty master list.
  Map doctors to specialties from clear source evidence only.
  For each doctor, try to find: registration number, Practo/Google profile URL, affiliated hospitals,
  procedures they perform, education background, awards/recognitions.

  AFFILIATION STATUS (CRITICAL — determines booking availability for patients):
  For EACH doctor, you MUST set the field "affiliationWithThisHospital":
    "current"  -> Doctor is ACTIVELY PRACTICING at this hospital RIGHT NOW.
                 Evidence: listed on hospital's current website/Practo page with active OPD schedule,
                 recent patient reviews mentioning them, active consultation fee listed.
    "past"     -> Doctor PREVIOUSLY worked here but NO LONGER does.
                 Evidence: role/bio says "formerly", "ex-", "previously", "ex-consultant",
                 no current OPD listing, mentions in past tense, or only appears in older articles.
    "unknown"  -> Cannot determine current vs past status from available sources.
  DEFAULT: use "unknown" when in doubt. NEVER assume "current" without active evidence.
  IMPORTANT: A doctor appearing in an old article or their bio mentioning "trained at" or "worked at"
  does NOT make them current. Only mark "current" if they have an active, bookable presence there.

REVIEW SYNOPSIS RULES — create a detailed positive and balanced summary:
  Focus on: doctor quality, nursing care, staff behaviour, cleanliness, infrastructure, trust,
  patient coordination, emergency responsiveness, parking, wait times, cost value.
  If repeated concerns exist, mention them softly and professionally.
  Do not include harsh or emotional language. Ignore suspicious or obviously fake reviews.
  Count total reviews analyzed and note average rating.

Return JSON:
{
  "hospital": {
    "name": "string",
    "type": "hospital|clinic|diagnostic_center|nursing_home|specialty_center",
    "city": "string|null",
    "state": "string|null",
    "addressLine1": "string|null",
    "area": "string|null",
    "landmark": "string|null",
    "pinCode": "string|null",
    "phone": "string|null",
    "contactNumbers": [],
    "whatsapp": "string|null",
    "emergencyContact": [],
    "ambulanceNumber": "string|null",
    "email": [],
    "website": "string|null",
    "accreditations": [],
    "bedCount": null,
    "establishedYear": null,
    "description": "string|null",
    "specialties": ["standard specialty names only"],
    "departments": [],
    "keyFacilities": [],
    "majorServices": [],
    "rating": null,
    "googleRating": null,
    "reviewCount": null,
    "insuranceAccepted": [],
    "paymentModes": [],
    "parking": "string|null",
    "nearestMetro": "string|null",
    "operatingHours": {}
  },
  "doctors": [
    {
      "fullName": "Dr. Name",
      "specialization": "standard specialty|null",
      "designation": "string|null",
      "qualifications": [],
      "yearsOfExperience": null,
      "consultationFee": null,
      "feeMin": null,
      "feeMax": null,
      "opdTiming": "string|null",
      "profileUrl": "string|null",
      "registrationNumber": "string|null",
      "practoProfileUrl": "string|null",
      "affiliationWithThisHospital": "current|past|unknown",
      "affiliatedHospitals": [
        {
          "name": "string",
          "city": "string|null",
          "role": "string|null",
          "affiliationStatus": "current|past|unknown"
        }
      ],
      "proceduresPerformed": [],
      "education": [
        { "degree": "string", "institution": "string|null", "year": "string|null" }
      ],
      "languagesSpoken": []
    }
  ],
  "packages": [
    {
      "packageName": "string",
      "procedureName": "string|null",
      "department": "string|null",
      "priceMin": null,
      "priceMax": null,
      "currency": "INR",
      "priceType": "hospital-specific|practo-listed|city-range|market-estimated",
      "priceSource": "official_website|practo|credihealth|google_search|estimated|null",
      "lengthOfStay": "string|null"
    }
  ],
  "procedureCosts": [
    {
      "procedureName": "string",
      "department": "string|null",
      "priceMin": null,
      "priceMax": null,
      "currency": "INR",
      "priceType": "hospital-specific|practo-listed|city-range|market-estimated",
      "priceSource": "official_website|practo|credihealth|google_search|estimated|null",
      "notes": "string|null"
    }
  ],
  "services": [
    { "name": "string", "category": "string|null" }
  ],
  "specialtyAudit": [
    {
      "specialty": "Cardiology",
      "status": "available|not_found|unclear",
      "services_found": [],
      "doctors_mentioned": [],
      "confidence": "high|medium|low"
    }
  ],
  "reviewSynopsis": {
    "summary": "string|null",
    "overallSentiment": "very_positive|positive|neutral|mixed",
    "patientSatisfactionScore": 0.0,
    "topPositives": [],
    "softConcerns": [],
    "keyStrengths": {
      "doctorQuality": "excellent|good|average|not_mentioned",
      "nursingCare": "excellent|good|average|not_mentioned",
      "infrastructure": "excellent|good|average|not_mentioned",
      "cleanliness": "excellent|good|average|not_mentioned",
      "waitTime": "short|moderate|long|not_mentioned",
      "costValue": "affordable|moderate|expensive|not_mentioned",
      "emergencyResponse": "quick|adequate|slow|not_mentioned"
    },
    "confidence": "high|medium|low",
    "sources": [],
    "reviewCount": 0,
    "averageRating": null
  },
  "sourceRegistry": [
    { "source_name": "string", "source_url": "string", "source_type": "official|directory|reviews|pricing|maps|other" }
  ],
  "overallConfidence": 0.0
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function toArr(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").slice(0, max);
}

// ── Save deep profile to DB as ingestion candidates ───────────────────────────

export async function saveDeepProfileToCandidates(
  userId: string,
  entityName: string,
  city: string | undefined,
  sourceUrl: string,
  groundedSummary: string,
  profile: Record<string, unknown>,
  batchId?: string,
): Promise<string> {
  const h = (profile.hospital ?? {}) as Record<string, unknown>;
  const doctors = Array.isArray(profile.doctors) ? profile.doctors as Record<string, unknown>[] : [];
  const packages = Array.isArray(profile.packages) ? profile.packages as Record<string, unknown>[] : [];
  const procedureCosts = Array.isArray(profile.procedureCosts) ? profile.procedureCosts as Record<string, unknown>[] : [];
  const services = Array.isArray(profile.services) ? profile.services as Record<string, unknown>[] : [];
  const specialtyAudit = Array.isArray(profile.specialtyAudit) ? profile.specialtyAudit : [];
  const reviewSynopsis = (profile.reviewSynopsis ?? null) as Record<string, unknown> | null;
  const overallConfidence = toNum(profile.overallConfidence) ?? 0.6;

  // Assess data quality for summary
  const hasData = doctors.length > 0 || packages.length > 0 || procedureCosts.length > 0 || services.length > 0;
  const dataWarnings: string[] = [];
  if (!hasData) dataWarnings.push("No structured data extracted from AI response");
  if (doctors.length === 0) dataWarnings.push("No doctors found");
  if (packages.length + procedureCosts.length === 0) dataWarnings.push("No pricing data found");
  if (overallConfidence < 0.4) dataWarnings.push(`Low confidence: ${(overallConfidence * 100).toFixed(0)}%`);

  // Create job record
  const [job] = await db.insert(ingestionJobs).values({
    requestedByUserId: userId,
    batchId: batchId ?? null,
    status: "done",
    sourceUrl,
    searchQuery: entityName,
    targetCity: city ?? null,
    runMode: "grounded_research",
    summary: {
      currentTask: hasData ? "Deep AI research completed" : "Research completed with limited data",
      percent: 100,
      doctorsFound: doctors.length,
      servicesFound: services.length,
      packagesFound: packages.length,
      procedureCostsFound: procedureCosts.length,
      confidence: overallConfidence,
      specialtiesAudited: specialtyAudit.length,
      specialtiesAvailable: (specialtyAudit as any[]).filter((s: any) => s.status === "available").length,
      warnings: dataWarnings,
      researchMode: "deep_ai_research",
      dataQuality: hasData ? "good" : "no_data",
    },
    startedAt: new Date(),
    completedAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  const jobId = job.id;

  // Source record — store longer snippet for review (increased from 400 to 2000)
  await db.insert(ingestionSources).values({
    jobId,
    sourceType: "grounded_research",
    sourceUrl,
    title: String(h.name ?? entityName),
    snippet: groundedSummary.slice(0, 2000),
    rawContent: null,
    structuredPayload: profile,
    confidence: overallConfidence,
  }).catch(() => null);

  // ── Hospital candidate — dedup-aware upsert ───────────────────────────────

  const name = String(h.name ?? entityName).trim();
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

  const emailRaw = h.email;
  const emails = Array.isArray(emailRaw)
    ? emailRaw.filter((x): x is string => typeof x === "string")
    : emailRaw ? [String(emailRaw)] : [];

  const newRawPayload = {
    specialtyAudit,
    reviewSynopsis,
    landmark: h.landmark ?? null,
    emergencyContact: toArr(h.emergencyContact),
    googleRating: toNum(h.googleRating),
    accreditations: toArr(h.accreditations),
    bedCount: toNum(h.bedCount),
    establishedYear: h.establishedYear ?? null,
    sourceRegistry: profile.sourceRegistry ?? [],
    researchMode: "deep_ai_research",
    batchId: batchId ?? null,
    pinCode: h.pinCode ?? null,
    area: h.area ?? null,
    ambulanceNumber: h.ambulanceNumber ?? null,
    insuranceAccepted: toArr(h.insuranceAccepted),
    paymentModes: toArr(h.paymentModes),
    parking: h.parking ?? null,
    nearestMetro: h.nearestMetro ?? null,
    operatingHours: h.operatingHours ?? null,
  } as Record<string, unknown>;

  // 1. Check for existing draft/review candidate with same normalizedName
  const [existingCandidate] = await db
    .select()
    .from(ingestionHospitalCandidates)
    .where(
      and(
        eq(ingestionHospitalCandidates.normalizedName, normalizedName),
        or(
          eq(ingestionHospitalCandidates.applyStatus, "draft"),
          eq(ingestionHospitalCandidates.applyStatus, "review"),
        ),
      )
    )
    .limit(1);

  // 2. Check for existing hospital in main table (for mergeAction flag)
  const [existingHospital] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(sql`lower(${hospitals.name}) = ${name.toLowerCase()}`)
    .limit(1);

  let hospitalCandidateId: string | null = null;

  if (existingCandidate) {
    // ── Update existing candidate: only fill in blank/empty fields ──────────
    hospitalCandidateId = existingCandidate.id;

    const existingSpecialties = Array.isArray(existingCandidate.specialties) ? existingCandidate.specialties as string[] : [];
    const existingDepts = Array.isArray(existingCandidate.departments) ? existingCandidate.departments as string[] : [];
    const existingMajor = Array.isArray(existingCandidate.majorServices) ? existingCandidate.majorServices as string[] : [];
    const existingLinks = Array.isArray(existingCandidate.sourceLinks) ? existingCandidate.sourceLinks as string[] : [];
    const mergedSpecialties = Array.from(new Set([...existingSpecialties, ...toArr(h.specialties)]));
    const mergedDepts = Array.from(new Set([...existingDepts, ...toArr(h.departments)]));
    const mergedMajor = Array.from(new Set([...existingMajor, ...toArr(h.majorServices)]));
    const mergedLinks = Array.from(new Set([...existingLinks, sourceUrl]));
    const existingPayload = (existingCandidate.rawPayload ?? {}) as Record<string, unknown>;

    await db.update(ingestionHospitalCandidates)
      .set({
        // Reassign to current job so the apply route can find this candidate
        // when it queries candidates by jobId (doctors/services/packages use the new jobId)
        jobId,
        phone: existingCandidate.phone ?? (h.phone ? String(h.phone) : null),
        email: existingCandidate.email ?? (emails[0] ?? null),
        website: existingCandidate.website ?? (h.website ? String(h.website) : null),
        whatsapp: existingCandidate.whatsapp ?? (h.whatsapp ? String(h.whatsapp) : null),
        addressLine1: existingCandidate.addressLine1 ?? (h.addressLine1 ? String(h.addressLine1) : null),
        addressData: existingCandidate.addressData ?? (h.addressData ? (h.addressData as Record<string, unknown>) : null),
        latitude: existingCandidate.latitude ?? toNum(h.latitude),
        longitude: existingCandidate.longitude ?? toNum(h.longitude),
        operatingHours: existingCandidate.operatingHours ?? (h.operatingHours ? (h.operatingHours as Record<string, unknown>) : null),
        description: existingCandidate.description ?? (h.description ? String(h.description).slice(0, 1000) : null),
        rating: existingCandidate.rating ?? toNum(h.rating),
        specialties: mergedSpecialties,
        departments: mergedDepts,
        majorServices: mergedMajor,
        sourceLinks: mergedLinks,
        // Merge rawPayload: existing values take priority, new values fill blanks
        rawPayload: { ...newRawPayload, ...existingPayload, sourceRegistry: mergedLinks } as Record<string, unknown>,
        aiConfidence: Math.max(existingCandidate.aiConfidence ?? 0, overallConfidence),
        // Reset apply status so the new job can re-apply fresh data
        applyStatus: "draft",
        reviewStatus: "draft",
        // If previously unlinked and we now found the main hospital, link it
        matchHospitalId: existingCandidate.matchHospitalId ?? existingHospital?.id ?? null,
        mergeAction: existingCandidate.matchHospitalId || existingHospital ? "update" : existingCandidate.mergeAction,
        updatedAt: new Date(),
      })
      .where(eq(ingestionHospitalCandidates.id, existingCandidate.id));

  } else {
    // ── Insert new candidate ─────────────────────────────────────────────────
    const mergeAction = existingHospital ? "update" : "review";
    const matchHospitalId = existingHospital?.id ?? null;

    const [newCandidate] = await db.insert(ingestionHospitalCandidates).values({
      jobId,
      name,
      normalizedName,
      city: normalizeCityName(String(h.city ?? city ?? "")) || null,
      state: h.state ? String(h.state) : null,
      country: "India",
      addressLine1: h.addressLine1 ? String(h.addressLine1) : null,
      addressData: h.addressData ? (h.addressData as Record<string, unknown>) : null,
      latitude: toNum(h.latitude) ?? null,
      longitude: toNum(h.longitude) ?? null,
      phone: h.phone ? String(h.phone) : null,
      contactNumbers: toArr(h.contactNumbers),
      whatsapp: h.whatsapp ? String(h.whatsapp) : null,
      email: emails[0] ?? null,
      website: h.website ? String(h.website) : null,
      operatingHours: h.operatingHours ? (h.operatingHours as Record<string, unknown>) : null,
      departments: toArr(h.departments),
      majorServices: toArr(h.majorServices),
      keyFacilities: toArr(h.keyFacilities),
      uniqueOfferings: [],
      specialties: toArr(h.specialties),
      services: [],
      description: h.description ? String(h.description).slice(0, 1000) : null,
      rating: toNum(h.rating),
      reviewCount: null,
      sourceLinks: [sourceUrl],
      outlierFlags: [],
      rawPayload: newRawPayload,
      aiConfidence: overallConfidence,
      matchHospitalId,
      mergeAction,
      applyStatus: "draft",
      reviewStatus: "draft",
      updatedAt: new Date(),
    }).returning().catch(() => []);

    hospitalCandidateId = (newCandidate as { id: string } | undefined)?.id ?? null;
  }

  // ── Doctor candidates — deduplicate by normalizedName ─────────────────────

  // Fetch already-stored doctor normalizedNames for this hospital candidate
  const existingDoctorNorms = new Set<string>();
  if (hospitalCandidateId) {
    const storedDocs = await db
      .select({ normalizedName: ingestionDoctorCandidates.normalizedName })
      .from(ingestionDoctorCandidates)
      .where(eq(ingestionDoctorCandidates.hospitalCandidateId, hospitalCandidateId));
    storedDocs.forEach(d => { if (d.normalizedName) existingDoctorNorms.add(d.normalizedName); });
  }

  const newDoctors = doctors.filter(doc => {
    const norm = String(doc.fullName ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    return norm.length > 2 && !existingDoctorNorms.has(norm);
  });

  if (newDoctors.length > 0) {
    await db.insert(ingestionDoctorCandidates).values(
      newDoctors.map(doc => ({
        jobId,
        hospitalCandidateId,
        fullName: String(doc.fullName ?? "Unknown Doctor").trim(),
        normalizedName: String(doc.fullName ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").trim(),
        specialization: doc.specialization ? String(doc.specialization) : null,
        qualifications: toArr(doc.qualifications),
        languages: [],
        phone: null,
        email: null,
        yearsOfExperience: toNum(doc.yearsOfExperience),
        feeMin: toNum(doc.feeMin),
        feeMax: toNum(doc.feeMax),
        consultationFee: toNum(doc.consultationFee),
        consultationDays: [],
        opdTiming: doc.opdTiming ? String(doc.opdTiming) : null,
        schedule: null,
        outlierFlags: [],
        rawPayload: {
          designation: doc.designation ?? null,
          profileUrl: doc.profileUrl ?? null,
          registrationNumber: doc.registrationNumber ?? null,
          practoProfileUrl: doc.practoProfileUrl ?? null,
          affiliatedHospitals: Array.isArray(doc.affiliatedHospitals) ? doc.affiliatedHospitals : [],
          proceduresPerformed: toArr(doc.proceduresPerformed),
          education: Array.isArray(doc.education) ? doc.education : [],
          languagesSpoken: toArr(doc.languagesSpoken),
        } as Record<string, unknown>,
        aiConfidence: overallConfidence,
        matchDoctorId: null,
        mergeAction: "review",
        applyStatus: "draft",
        reviewStatus: "draft",
        updatedAt: new Date(),
      }))
    ).catch(() => null);
  }

  // ── Service candidates — deduplicate by serviceName ──────────────────────

  const existingServiceNames = new Set<string>();
  if (hospitalCandidateId && services.length > 0) {
    const storedSvcs = await db
      .select({ serviceName: ingestionServiceCandidates.serviceName })
      .from(ingestionServiceCandidates)
      .where(eq(ingestionServiceCandidates.hospitalCandidateId, hospitalCandidateId));
    storedSvcs.forEach(s => existingServiceNames.add(s.serviceName.toLowerCase()));
  }

  const newServices = services.filter(svc => {
    const n = String(svc.name ?? "").trim().toLowerCase();
    return n.length > 0 && !existingServiceNames.has(n);
  });

  if (newServices.length > 0) {
    await db.insert(ingestionServiceCandidates).values(
      newServices.map(svc => ({
        jobId,
        hospitalCandidateId,
        serviceName: String(svc.name ?? "").trim(),
        category: svc.category ? String(svc.category) : null,
        description: null,
        sourceLinks: [],
        outlierFlags: [],
        rawPayload: null,
        aiConfidence: overallConfidence,
        mergeAction: "review",
        applyStatus: "draft",
        reviewStatus: "draft",
        updatedAt: new Date(),
      }))
    ).catch(() => null);
  }

  // ── Package candidates — deduplicate by packageName ───────────────────────

  const existingPackageNames = new Set<string>();
  if (hospitalCandidateId && (packages.length > 0 || procedureCosts.length > 0)) {
    const storedPkgs = await db
      .select({ packageName: ingestionPackageCandidates.packageName })
      .from(ingestionPackageCandidates)
      .where(eq(ingestionPackageCandidates.hospitalCandidateId, hospitalCandidateId));
    storedPkgs.forEach(p => existingPackageNames.add(p.packageName.toLowerCase()));
  }

  const newPackages = packages.filter(pkg => {
    const n = String(pkg.packageName ?? pkg.procedureName ?? "").trim().toLowerCase();
    return n.length > 0 && !existingPackageNames.has(n);
  });

  if (newPackages.length > 0) {
    await db.insert(ingestionPackageCandidates).values(
      newPackages.map(pkg => ({
        jobId,
        hospitalCandidateId,
        packageName: String(pkg.packageName ?? pkg.procedureName ?? "Package").trim(),
        procedureName: pkg.procedureName ? String(pkg.procedureName) : null,
        department: pkg.department ? String(pkg.department) : null,
        priceMin: toNum(pkg.priceMin),
        priceMax: toNum(pkg.priceMax),
        currency: "INR",
        inclusions: null,
        exclusions: null,
        lengthOfStay: pkg.lengthOfStay ? String(pkg.lengthOfStay) : null,
        outlierFlags: [],
        rawPayload: {
          priceType: pkg.priceType ?? "hospital-specific",
          priceSource: pkg.priceSource ?? null,
        } as Record<string, unknown>,
        aiConfidence: overallConfidence,
        mergeAction: "review",
        applyStatus: "draft",
        reviewStatus: "draft",
        updatedAt: new Date(),
      }))
    ).catch(() => null);
  }

  // ── Procedure cost candidates — deduplicate by procedureName ─────────────

  const newProcedureCosts = procedureCosts.filter(pc => {
    const n = String(pc.procedureName ?? "").trim().toLowerCase();
    if (!n || existingPackageNames.has(n)) return false;
    if (toNum(pc.priceMin) === null && toNum(pc.priceMax) === null) return false;
    existingPackageNames.add(n); // prevent same-run duplicates too
    return true;
  });

  if (newProcedureCosts.length > 0) {
    await db.insert(ingestionPackageCandidates).values(
      newProcedureCosts.map(pc => ({
        jobId,
        hospitalCandidateId,
        packageName: String(pc.procedureName ?? "Procedure").trim(),
        procedureName: String(pc.procedureName ?? "Procedure").trim(),
        department: pc.department ? String(pc.department) : null,
        priceMin: toNum(pc.priceMin),
        priceMax: toNum(pc.priceMax),
        currency: "INR",
        inclusions: null,
        exclusions: null,
        lengthOfStay: null,
        outlierFlags: [],
        rawPayload: {
          type: "procedure_cost",
          priceType: pc.priceType ?? "market-estimated",
          priceSource: pc.priceSource ?? null,
          notes: pc.notes ?? null,
        } as Record<string, unknown>,
        aiConfidence: overallConfidence * 0.85,
        mergeAction: "review",
        applyStatus: "draft",
        reviewStatus: "draft",
        updatedAt: new Date(),
      }))
    ).catch(() => null);
  }

  return jobId;
}
