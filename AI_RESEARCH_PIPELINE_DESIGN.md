# AI Research Pipeline — Two-Mode Design (v2, reviewed & updated)

## Status: APPROVED FOR IMPLEMENTATION

---

## Problem Statement

The batch "Hospital / Provider Names" textarea has a single pipeline:
`input → deep profile extraction → save candidates`

When a **discovery query** like `Top 5 hospitals in Paschim Medinipur, West Bengal` is entered,
the system treats it as a hospital name, runs profile extraction directly, and Gemini picks a
well-known hospital (Apollo Gleneagles in Kolkata) — completely wrong geography.

---

## Two Modes

### Mode A — Entity Profile (existing, being fixed)

**Input**: A specific named provider
`Apollo Gleneagles Hospital, Kolkata`
`Medica Superspecialty Hospital`

**Pipeline**:
```
Name (clean entity)
  → Pass 1: Google Search grounding   (SPECIALTY-AWARE: official site + Practo doctors + prices per specialty)
  → Pass 2: Structured extraction     (DEEP_RESEARCH_SYSTEM → full JSON profile)
  → saveDeepProfileToCandidates()     (hospital + doctors + packages + procedureCosts + services)
```

**Pass 1 Search Strategy (specialty-aware)**:
```
1. Official website — Departments, Doctors directory, Pricing pages
2. Google Maps — address, PIN, phone, rating, hours
3. Practo.com — ALL affiliated doctors by specialty (name, qual, fee, OPD timing)
4. Per specialty: "[specialty] doctors at [hospital]" — explicit specialty-doctor search
5. Treatment costs — "[hospital] [procedure] cost" for key procedures
6. Accreditations — NABH, NABL, JCI
7. JustDial/Sulekha — supplementary doctor + phone data
8. Patient reviews — Google + Practo sentiment
```

---

### Mode B — Discovery Search (new)

**Input**: A geography/type search query
`Top 5 hospitals in Paschim Medinipur, West Bengal`
`Best cardiac hospitals in Delhi`
`Hospitals in Siliguri`

**Pipeline**:
```
Discovery query
  → Pass 1: DISCOVERY grounding        (DISCOVERY_SYSTEM → JSON array of real named providers)
  → VALIDATION LAYER                   (dedupe, geo-filter, type-filter, cap at 5)
  → FALLBACK if < 3 found             (broaden geo: district → state, retry once)
  → PARALLEL research (max 3 at once):
      For each validated entity:
        → Pass 2: Google Search grounding  (SPECIALTY-AWARE — same 8-step strategy as Mode A)
        → Pass 3: DEEP_RESEARCH_SYSTEM     (structured extraction)
        → saveDeepProfileToCandidates()
  → Aggregate results                  (sum doctors, specialties, prices across all)
  → Update batch item with discoveredEntities[]
```

---

## Input Classifier (fixed — precise, avoids false positives)

**File**: `src/lib/ai/deep-research.ts`
**Function**: `classifyInput(input: string): "entity_profile" | "discovery_search"`

```typescript
// DISCOVERY → starts with search-intent words (not a proper name)
/^(top\s+\d+)/                           → "Top 5 ..."
/^(best\s+(hospital|clinic|doctor|...))/ → "Best hospitals ..."
/^(list\s+of)/                           → "List of ..."
/^(find\s+(hospitals?|clinics?|...))/    → "Find hospitals ..."
/^(hospitals?|clinics?|doctors?)\s+(in|near|at)\s+/  → "Hospitals in ..."
/^\d+\s+(hospitals?|clinics?)\s+in\s+/  → "5 hospitals in ..."
/near\s+me/                              → "... near me"

// ENTITY PROFILE → everything else (even if it contains "in")
"Fortis Hospital in Mumbai"   → entity_profile  ✓ (starts with proper name)
"Apollo Gleneagles, Kolkata"  → entity_profile  ✓
"Dr. Subhas Dasgupta"         → entity_profile  ✓
```

**Key rule**: Only classify as discovery if query STARTS with a category word or search intent. A query starting with a proper name is always an entity.

---

## System Prompts

### DISCOVERY_SYSTEM (new)

**Purpose**: Pass 1 of Mode B — discover real named providers from a geography query.

**Critical rules to include**:
1. **Geo enforcement**: Only include providers within the requested geography. Reject providers from different cities/districts unless query is city-level.
2. **Ranking**: If query says "top" or "best", rank by: Google rating → review count → hospital size → source credibility.
3. **Per-entity confidence**: Score each entity `high | medium | low` based on source count and data agreement.
4. **Never invent**: Only include providers confirmed by grounding sources.
5. **Source tracing**: Include `sourceUrl` for every entity — where it was found.

**Output schema**:
```json
{
  "entities": [
    {
      "name": "string",
      "city": "string",
      "state": "string|null",
      "district": "string|null",
      "type": "hospital|clinic|diagnostic_center|nursing_home|specialty_center",
      "address": "string|null",
      "phone": "string|null",
      "website": "string|null",
      "googleRating": "string|null",
      "reviewCount": "string|null",
      "sourceUrl": "string|null",
      "confidence": "high|medium|low"
    }
  ],
  "queryIntent": "string — what was searched",
  "geographyUsed": "string — actual geography that was searched",
  "totalFound": 0
}
```

### DEEP_RESEARCH_SYSTEM (existing, already updated)

**Purpose**: Full structured profile extraction for a SINGLE known provider.
**Used in**: Mode A (Pass 2), Mode B (Pass 3 for each discovered entity).

---

## Validation Layer (new — between discovery and research)

**Purpose**: Clean discovered entities before running expensive deep research.

```typescript
function validateDiscoveredEntities(
  entities: DiscoveredEntity[],
  targetGeo: string,    // from user input (city or district)
  maxCount = 5
): DiscoveredEntity[] {
  // 1. Remove blanks / nulls
  const valid = entities.filter(e => e.name?.trim().length > 2);

  // 2. Deduplicate by normalized name
  const seen = new Set<string>();
  const deduped = valid.filter(e => {
    const key = e.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Prefer high/medium confidence entities first
  const sorted = [
    ...deduped.filter(e => e.confidence === "high"),
    ...deduped.filter(e => e.confidence === "medium"),
    ...deduped.filter(e => e.confidence === "low"),
  ];

  // 4. Cap at maxCount
  return sorted.slice(0, maxCount);
}
```

---

## Fallback Logic (if discovery returns < 3 entities)

```
Discovery Pass 1 returns 0–2 entities
  → Broaden geography (remove district qualifier, use state or city-level)
  → Retry discovery ONCE with broadened query
  → If still < 2: save what was found, mark item with note "limited results found"
```

---

## Parallel Execution

Mode B processes discovered entities with **max 3 concurrent** Gemini calls:

```typescript
const CONCURRENCY = 3;
for (let i = 0; i < validEntities.length; i += CONCURRENCY) {
  const batch = validEntities.slice(i, i + CONCURRENCY);
  await Promise.allSettled(batch.map(entity => runFullResearch(entity)));
}
```

---

## Limits

| Parameter | Value | Reason |
|-----------|-------|--------|
| `MAX_DISCOVERY_ENTITIES` | 5 | Cost + rate-limit safety |
| `MAX_CONCURRENCY` | 3 | Gemini quota protection |
| `MAX_OUTPUT_TOKENS` | 16384 | Prevent JSON truncation |

If user query says "Top 20" or "Top 100" → cap at 5, log a warning in the batch item.

---

## Data Model Changes

### `ResearchBatchItem` in `src/db/schema.ts`

Add two new optional fields:

```typescript
export type ResearchBatchItem = {
  name: string;
  city?: string | null;
  type: "hospital" | "clinic" | "doctor" | "unknown";
  status: "pending" | "processing" | "done" | "failed";
  jobId?: string | null;
  error?: string | null;
  specialtyCount?: number;
  doctorCount?: number;
  priceCount?: number;
  confidence?: number;
  // NEW: populated only for discovery mode items
  discoveredCount?: number;
  discoveredEntities?: Array<{
    jobId: string;
    name: string;
    city: string | null;
    confidence: number;
  }>;
};
```

No DB migration needed — `items` is a JSON column, adding optional fields is backwards-compatible.

---

## Deduplication & Append Logic (in `saveDeepProfileToCandidates`)

When the same hospital is researched again, the system must NOT create duplicate records.
Instead it appends missing data to the existing candidate.

### Hospital candidate
1. Look up `ingestionHospitalCandidates` by `normalizedName` where `applyStatus IN (draft, review)`
   - **Found → UPDATE** (merge missing fields only; existing values take priority):
     - `phone`, `email`, `website`, `whatsapp`, `addressLine1`, `description` — fill if currently null
     - `specialties`, `departments`, `majorServices` — union merge (no duplicates)
     - `sourceLinks` — append new URL
     - `rawPayload` — merge (existing keys win)
     - `matchHospitalId` — link if main hospital found and not yet linked
   - **Not found → INSERT** new candidate
2. Also look up `hospitals` by `lower(name) = lower(entityName)`:
   - If match: set `mergeAction: "update"` + `matchHospitalId` on the candidate (UI shows "Update" action)
   - If no match: set `mergeAction: "review"` (UI shows "Create new")

### Doctor candidates
- Before insert, fetch existing `normalizedName` set for this `hospitalCandidateId`
- Only insert doctors whose `normalizedName` is NOT already in the set

### Package/service candidates
- Before insert, fetch existing `packageName` / `serviceName` set for this `hospitalCandidateId`
- Only insert items whose name is NOT already in the set
- Also deduplicate within the same research run (same procedure can't be added twice)

---

## Batch Item Result Shape

### Mode A (entity) — unchanged
```json
{
  "name": "Apollo Gleneagles Hospital",
  "status": "done",
  "jobId": "job_abc",
  "specialtyCount": 18,
  "doctorCount": 12,
  "priceCount": 5,
  "confidence": 0.82
}
```

### Mode B (discovery) — new
```json
{
  "name": "Top 5 hospitals in Paschim Medinipur",
  "status": "done",
  "jobId": null,
  "specialtyCount": 42,
  "doctorCount": 31,
  "priceCount": 8,
  "confidence": 0.71,
  "discoveredCount": 5,
  "discoveredEntities": [
    { "jobId": "job_1", "name": "Spandan Hospital", "city": "Medinipur", "confidence": 0.85 },
    { "jobId": "job_2", "name": "Nirnoy Hospital", "city": "Medinipur", "confidence": 0.78 },
    { "jobId": "job_3", "name": "Midnapore Medical College", "city": "Medinipur", "confidence": 0.90 },
    { "jobId": "job_4", "name": "Bani Bibi Hospital", "city": "Kharagpur", "confidence": 0.65 },
    { "jobId": "job_5", "name": "District Hospital Paschim Medinipur", "city": "Medinipur", "confidence": 0.70 }
  ]
}
```

---

## Files to Change

### 1. `src/db/schema.ts`
- [ ] Add `discoveredCount?: number` to `ResearchBatchItem`
- [ ] Add `discoveredEntities?: Array<{jobId, name, city, confidence}>` to `ResearchBatchItem`

### 2. `src/lib/ai/deep-research.ts`
- [x] `classifyInput()` — basic version added, needs precision fix
- [x] `DISCOVERY_SYSTEM` — added, needs geo enforcement + ranking + confidence updates
- [x] Fix `runMode: "grounded_research"`
- [x] Fix `sourceType: "grounded_research"`
- [x] Fix `website` fallback removed
- [ ] Add `MAX_DISCOVERY_ENTITIES = 5`
- [ ] Add `MAX_CONCURRENCY = 3`
- [ ] Add `validateDiscoveredEntities()` helper
- [ ] Export `DiscoveredEntity` type

### 3. `src/app/api/admin/research/batch/process/route.ts`
- [ ] Import `classifyInput`, `DISCOVERY_SYSTEM`, `validateDiscoveredEntities`, `MAX_DISCOVERY_ENTITIES`
- [ ] Add Mode A / Mode B branching per item
- [ ] Mode B: Pass 1 discovery → validate → fallback if < 3 → parallel Pass 2+3 → aggregate
- [ ] Update batch item result with `discoveredCount` and `discoveredEntities`

### 4. `src/app/admin/AdminDashboardClient.tsx`
- [ ] Parse batch names lines and show badge: yellow "discovery" or grey "entity" per line
- [ ] Update batch item card to show `discoveredCount` when > 0
- [ ] Show `discoveredEntities` links in the done card (each one "Open in Review →")
- [ ] Update `batchItems` state type to include `discoveredCount` and `discoveredEntities`

### 5. `src/app/api/admin/research/agent/route.ts` (optional, later)
- [ ] Add discovery toggle for Single Query tab
- [ ] If discovery mode: run Mode B pipeline, return array of entities

---

## UI Design for Batch Progress Card

### Entity item (Mode A):
```
[✓] Apollo Gleneagles Hospital, Kolkata         DONE
    18 specialties · 12 doctors · 5 prices · 82% conf
    [Open in Review →]
```

### Discovery item (Mode B):
```
[✓] Top 5 hospitals in Paschim Medinipur        DONE
    5 hospitals discovered · 42 specialties · 31 doctors total
    ├─ Spandan Hospital          85% conf  [Open in Review →]
    ├─ Nirnoy Hospital           78% conf  [Open in Review →]
    ├─ Midnapore Medical College 90% conf  [Open in Review →]
    ├─ Bani Bibi Hospital        65% conf  [Open in Review →]
    └─ District Hospital         70% conf  [Open in Review →]
```

---

## Answers to Key Questions

1. **Should discovered hospitals become individual batch items?**
   → NO — they are stored as `discoveredEntities[]` inside the parent item. This avoids UI clutter and keeps the batch count stable. Each discovered entity links to its own job record for review.

2. **Show `discoveredCount` in batch progress UI?**
   → YES — show "N hospitals discovered" + expandable list of discovered entities.

3. **Single Query tab discovery mode?**
   → YES (phase 2) — add a "Discover mode" toggle checkbox. For now implement in batch only.

---

## Example End-to-End Flow

```
User enters in Batch Names textarea:
  Line 1: "Apollo Gleneagles Hospital, Kolkata"
  Line 2: "Top 5 hospitals in Paschim Medinipur, West Bengal"
  Line 3: "Medica Superspecialty Hospital"

classifyInput("Apollo Gleneagles Hospital, Kolkata")      → entity_profile → Mode A
classifyInput("Top 5 hospitals in Paschim Medinipur...")  → discovery_search → Mode B
classifyInput("Medica Superspecialty Hospital")            → entity_profile → Mode A

Batch processes:
  Item 1 (Mode A): Apollo → 1 job + candidates
  Item 2 (Mode B): Discovery → finds 5 hospitals → 5 jobs + candidates
  Item 3 (Mode A): Medica → 1 job + candidates

Result: 3 batch items, 7 total jobs/candidates created
```
