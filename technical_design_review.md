# 🔬 Technical & Design Review: PLAN.md + ARCHITECTURE.md
## Scope: Architectural Flaws & Design Issues to Rectify
## Reviewer: Antigravity AI | Date: 2026-03-13

> This review focuses exclusively on **technical design flaws** in the planned architecture and how they interact with the **existing codebase**. Project management concerns (timeline, scope) are excluded.

---

## A. DATA MODEL DESIGN FLAWS

### A1. Polymorphic FK Anti-Pattern — userId vs. patientId Duality
**Severity: 🔴 HIGH | Affects: 5+ tables**

The gamification schema uses a dual-nullable-FK pattern across **five tables** (`user_points`, `point_events`, `user_badges`, `streaks`, `leaderboard_cache`):

```typescript
userId: text("user_id").references(() => users.id),       // nullable
patientId: text("patient_id").references(() => patients.id), // nullable
// "exactly ONE must be set — enforced at app layer"
```

**Design Problems:**
1. **No DB-level enforcement** — SQLite has no `CHECK` constraint that says "exactly one must be non-null." The "enforced at app layer" comment means every query, every insert, every migration script must remember this rule. One missed check = orphaned or invalid rows.
2. **Every query needs COALESCE/OR logic** — Leaderboard queries, point aggregations, badge lookups all need `WHERE userId = ? OR patientId = ?`. This doubles query complexity and prevents simple index usage.
3. **Future JOIN hell** — To display a leaderboard with user details, you need: `LEFT JOIN users ON userId LEFT JOIN patients ON patientId`. Every consumer repeats this.

**Fix: Use a unified `actor_id` + `actor_type` pattern:**
```typescript
// Single approach — polymorphic but clean
actorId: text("actor_id").notNull(),
actorType: text("actor_type").notNull(), // 'user' | 'patient'

// OR better — create an `actors` table (identity map):
// actors: { id, type: 'user'|'patient', linkedId, displayAlias }
// All gamification tables FK to actors.id
```

This eliminates the COALESCE pattern, allows a single unique index, and makes the DB the source of truth.

---

### A2. Identity Split — patients.phone_hash vs. leads.phone (raw)
**Severity: 🔴 HIGH | Affects: Consent flow integrity**

The ARCHITECTURE plans for patients to be identified by `phone_hash` (SHA-256), and the PLAN requires `consent_record_id` on every lead. But the **existing** `leads` table stores **raw phone numbers**:

```typescript
// Current leads schema (schema.ts line 587)
phone: text("phone").notNull(),  // RAW phone — no hash, no encryption
```

Meanwhile, the new patients table uses:
```typescript
phoneHash: text("phone_hash").notNull().unique(), // SHA-256
```

**Design Problems:**
1. **Two identity systems** — Old leads have raw phones; new leads need patient_id (which is phone_hash-based). There's no migration path documented for existing lead data.
2. **Consent retroactivity** — Existing leads were created without consent. The plan adds `consentRecordId` as nullable on leads, but doesn't address: are existing leads DPDP-compliant? Do they need retroactive consent?
3. **Phone lookup ambiguity** — To check "has this patient already submitted a lead to this hospital?", you need to hash the incoming phone, find the patient, then query leads by patient_id. But old leads don't HAVE patient_id. So dedup logic must check BOTH `leads.phone = raw` AND `leads.patientId = patient.id`.

**Fix:**
- Add a migration task that hashes all existing `leads.phone` values and creates corresponding `patients` rows.
- Add `leads.phoneHash` column (computed from existing phone at migration time) for uniform lookups.
- Document the legacy data strategy explicitly in PLAN.md.

---

### A3. Consent Circular Dependency
**Severity: 🟡 MEDIUM | Affects: Patient onboarding flow**

The PLAN describes this flow (Task 2.2):
```
1. Hash phone → find/create patient
2. Check consent_records for 'booking_lead' purpose
3. If missing → throw LEAD_CONSENT_REQUIRED
```

But `consent_records` has a FK to `patients`:
```typescript
patientId: text("patient_id").references(() => patients.id),
```

**Circular dependency:** You can't create a consent record without a patient. You can't submit a lead without consent. But the patient is created FROM the lead submission flow. Who creates the patient first?

The UX flow (UX-2) shows: Consent Modal → OTP → Create Patient → Submit Lead. But the API design (Task 2.1 `POST /api/v1/consent`) accepts `patientId?` (optional). This means consent can be created WITHOUT a patient, making the FK meaningless.

**Fix:** Make the flow explicit:
1. `POST /api/v1/auth/otp/send` — takes raw phone, no patient needed
2. `POST /api/v1/auth/otp/verify` — creates patient by phone_hash, returns patientId
3. `POST /api/v1/consent` — requires patientId (non-optional), creates consent record
4. `POST /api/v1/leads` — requires both patientId and consentRecordId

The `patientId` on consent should be `.notNull()`, not nullable. The consent API should NOT accept requests without a verified patient.

---

### A4. Redundant Leaderboard Storage
**Severity: 🟡 MEDIUM | Affects: Data consistency**

The architecture plans TWO storage systems for the same leaderboard data:

1. **Redis Sorted Sets** (ARCHITECTURE §D):
   ```
   leaderboard:{city}:{period}  → Sorted Set (ZADD score=points, member=userId)
   ```

2. **SQLite Table** (PLAN Task 1.1):
   ```typescript
   leaderboardCache = sqliteTable("leaderboard_cache", { ... })
   ```

Both are refreshed hourly. Both contain the same data. The `GET /api/v1/leaderboard/:city` endpoint reads from the DB table, not Redis.

**Problem:** Two sources of truth for the same data that can drift. The hourly cron writes to both, but if one fails, they're inconsistent.

**Fix:** Pick one:
- **Redis only** (recommended for real-time, auto-expiry) — drop the `leaderboard_cache` table entirely. Read from Redis sorted set. If Redis is down, return "leaderboard temporarily unavailable."
- **DB only** — drop the Redis sorted set. The hourly cron is sufficient for a P1 leaderboard that doesn't need real-time updates.

---

### A5. Provenance Upgrade Without Entity FK
**Severity: 🟡 MEDIUM | Affects: Ingestion data integrity**

The plan upgrades `ingestion_field_confidences` with provenance columns (`review_status`, `reviewed_by`, etc.) but the existing table has this schema:

```typescript
entityType: text("entity_type").notNull(),  // "hospital" | "doctor"
entityId: text("entity_id").notNull(),      // UUID string — no FK!
```

`entityId` is a free-form text field with **no foreign key** to any table. It could reference `hospitals.id`, `doctors.id`, `ingestion_hospital_candidates.id`, or a typo. There's no referential integrity.

**Fix:** Either:
- Add separate nullable FK columns: `hospitalId`, `doctorId`, `candidateId` — one must be non-null
- Or add a CHECK constraint on `entityType` values and document that `entityId` is validated at app-layer with explicit tests

---

## B. SECURITY ARCHITECTURE FLAWS

### B1. Session Token Stored as Plaintext UUID
**Severity: 🔴 HIGH | Affects: Session hijacking risk**

Current implementation ([session.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/session.ts)):
```typescript
const sessionToken = randomUUID();
await db.insert(sessions).values({ sessionToken, userId, expiresAt });
```

The session token is a raw UUID stored directly in the database. If the DB is compromised (SQL injection, backup leak, admin access), **every active session is immediately hijackable**.

**Industry standard:** Store `SHA-256(sessionToken)` in DB. Send the raw token to the client. On lookup: hash the cookie value and compare to DB. This way, a DB leak doesn't compromise sessions.

**Fix:**
```typescript
const rawToken = randomUUID();
const tokenHash = createHash('sha256').update(rawToken).digest('hex');
await db.insert(sessions).values({ sessionToken: tokenHash, userId, expiresAt });
// Send rawToken to client; lookup by hash
```

The ARCHITECTURE.md plans patient sessions in Redis but doesn't address this existing flaw in admin/portal sessions.

---

### B2. Middleware Validates Cookie Existence, Not Session Validity
**Severity: 🔴 HIGH | Affects: Auth bypass**

Current [middleware.ts](file:///c:/Biswajit/Codex/easyheals-next/src/middleware.ts):
```typescript
export function middleware(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    return NextResponse.next();  // ← Just checks cookie EXISTS
  }
  return NextResponse.redirect(redirectUrl);
}
```

The middleware **only checks if the cookie exists** — it never validates the session token against the database. A user can set `easyheals_next_session=anything` and bypass the middleware.

**Mitigation:** Individual route handlers call [requireAuth()](file:///c:/Biswajit/Codex/easyheals-next/src/lib/auth.ts#70-85) which DOES validate against the DB. So the actual auth check works. But the middleware gives a false sense of security and allows unauthenticated requests to reach route handlers (wasting compute).

The ARCHITECTURE plans to upgrade middleware (Task 3.9) with rate limiting and consent checks, but doesn't mention fixing this fundamental auth gap.

**Fix:** The middleware should either:
- Validate the session token against the DB (expensive on every request), OR
- Use a signed JWT/HMAC token that can be validated without a DB call, OR
- Accept the current design but document that middleware is a **redirect-only guard**, not an auth check

---

### B3. `/api/book` — Raw Phone, No Auth, No Rate Limit, No Consent
**Severity: 🔴 HIGH | Affects: PII exposure, spam**

The existing [/api/book](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/book/route.ts) endpoint:
```typescript
// "Public endpoint — no auth required"
export async function POST(req: NextRequest) {
  // No rate limiting
  // No consent check
  // No bot guard
  // Stores raw phone directly:
  phone: parsed.data.phone,  // RAW phone in DB
}
```

This endpoint is publicly accessible, accepts raw phone numbers, has no rate limiting, no CAPTCHA, no consent check, and stores PII directly. It's a spam/data-harvesting vector.

The PLAN creates a new `/api/v1/leads` with all protections, but `/api/book` is kept "for backwards compat." This means the unprotected endpoint stays live indefinitely.

**Fix:**
- Immediately add rate limiting to `/api/book` (even before P1 sprint)
- Set a deprecation date: `/api/book` returns `410 Gone` after P1 launch
- Never keep two endpoints with different security postures for the same action

---

### B4. Audit Log Stores Raw PII
**Severity: 🟡 MEDIUM | Affects: DPDP compliance**

Current [/api/leads](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/leads/route.ts) writes to audit log:
```typescript
await writeAuditLog({
  ipAddress: req.headers.get("x-forwarded-for"),  // raw IP
  changes: { fullName: lead.fullName, phone: lead.phone, status: lead.status },
  // ↑ RAW phone number in audit log!
});
```

The ARCHITECTURE (§L.2) explicitly says "NEVER log phone, full_name" — but the existing code does exactly that. The planned `phi-redactor.ts` doesn't exist yet, so there's no safety net.

**Fix:**
- Audit log `changes` field should hash or redact PII before storage
- [writeAuditLog()](file:///c:/Biswajit/Codex/easyheals-next/src/lib/audit.ts#13-23) should take a `phiSafe: boolean` flag or auto-redact known PII fields
- This is a pre-existing bug that should be fixed BEFORE the P1 sprint, not during it

---

## C. AI / GEMINI ARCHITECTURE FLAWS

### C1. GoogleGenerativeAI Instantiated 12+ Times — No Singleton
**Severity: 🟡 MEDIUM | Affects: Performance, cost tracking**

`new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY)` appears in **12 different files**:
- [ingestion.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/ingestion.ts) (4 times!)
- [gemini.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/gemini.ts), [outlier.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/outlier.ts), [doctor-enrich.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/doctor-enrich.ts)
- [search/route.ts](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/search/route.ts), `search/ai/route.ts`
- [admin/research/brochure/route.ts](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/admin/research/brochure/route.ts), `admin/research/agent/route.ts`
- `admin/research/brochure/scan/route.ts`
- `admin/contributions/ai-review/route.ts`
- `admin/audit-log/route.ts`

Each instantiation creates a new client. There's **no centralized cost tracking**, no token counting, no rate limiting across calls. The ARCHITECTURE plans an `ai/cost-tracker.ts` and `ai/circuit-breaker.ts`, but the current code has zero infrastructure for this.

**Design flaw:** The planned `AIProvider` interface wraps the Gemini client, but NONE of the 12 call sites use it. The refactoring from "12 scattered instantiations" → "1 provider with cost tracking" is a massive effort that isn't sized as such.

**Fix:** Before the P1 sprint:
1. Create `src/lib/ai/client.ts` — singleton Gemini client with token counting
2. All 12 call sites import from this single module
3. Add `getAIClient()` function that wraps cost tracking + circuit breaker

---

### C2. No AI Call Timeout or Retry
**Severity: 🟡 MEDIUM | Affects: Reliability**

Every Gemini call in the codebase is a raw `await model.generateContent(prompt)` with **no timeout**:

```typescript
// search/route.ts
const response = await model.generateContent(prompt);  // No timeout!
```

Gemini API calls can take 5-30+ seconds. If the API hangs, the request hangs. Vercel has a 10s timeout on Hobby and 60s on Pro. A hung AI call = dead request with no error message.

The ARCHITECTURE plans `circuit-breaker.ts` but gives no detail on timeout handling.

**Fix:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000); // 8s max
try {
  const result = await model.generateContent({ contents, signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```
Add this to the centralized AI client (C1 fix).

---

### C3. Search Route — 3 Sequential AI Calls, No Streaming
**Severity: 🟡 MEDIUM | Affects: Search latency**

The [search/route.ts](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/search/route.ts) makes these calls sequentially:
```
1. extractSearchIntent(query)     → Gemini call (~1-3s)
2. DB query (hospitals + doctors)  → (~100-500ms)
3. generateAssistant(...)          → Gemini call (~1-3s)
4. searchLogs insert               → (~50ms)
```

Total: **2-7 seconds per search**. The ARCHITECTURE doesn't address this. The planned caching (Redis intent cache, 5min TTL) helps on cache hits but cold searches are still slow.

**Fix:**
- **Step 3 (assistant generation) should be streamed** or returned async — don't block the search results on the conversational response
- Consider returning search results immediately and streaming the assistant response via SSE
- Or: return results with a `conversationId` and let the client poll for the assistant response

---

## D. API & INFRASTRUCTURE DESIGN FLAWS

### D1. No Error Contract Consistency Across 40 Routes
**Severity: 🟡 MEDIUM | Affects: API reliability**

The existing 40 route handlers have **at least 4 different error response shapes**:

```typescript
// Pattern 1 (book/route.ts):
{ error: "Invalid request body" }

// Pattern 2 (leads/route.ts):
{ error: "Validation error", details: {...} }

// Pattern 3 (auth.ts):
{ error: "Unauthorized", code: "AUTH_REQUIRED" }

// Pattern 4 (search/route.ts):
{ error: "Search failed", message: "..." }
```

The ARCHITECTURE plans `AppError` with a unified `{ error: { code, message } }` shape, but the migration from 4 different patterns to 1 is not specified. Frontend code that checks for errors will break if response shapes change.

**Fix:**
- Document the EXACT target error shape in ARCHITECTURE.md
- Add a migration checklist for all 40 routes
- Use a response type wrapper: `ApiResponse<T> = { data: T } | { error: { code: ErrorCode; message: string } }`
- The `withErrorHandler` wrapper should convert ALL responses (not just errors) to ensure consistency

---

### D2. Outbox Pattern Won't Work on Vercel Serverless
**Severity: 🟡 MEDIUM | Affects: CRM event delivery (P2)**

ARCHITECTURE §H describes:
```
P2: Vercel cron every 30s reads status='pending' rows → delivers to Redis pub/sub
```

But [vercel.json](file:///c:/Biswajit/Codex/easyheals-next/vercel.json) shows the actual cron is `*/2 * * * *` (every 2 minutes), and Vercel crons have these limitations:
- Minimum interval: 1 minute (Hobby) or custom (Pro)
- Each invocation is a cold-start serverless function
- No guaranteed execution — crons can be delayed
- No persistent connection to Redis pub/sub

**Design problem:** The outbox processor needs to SELECT, process, and UPDATE rows atomically. But Vercel functions have a 10-60s timeout. If there are 1000 pending events, the function times out before finishing.

**Fix:**
- Process events in batches (e.g., 50 per invocation)
- Use `LIMIT 50 ORDER BY available_at FOR UPDATE` pattern (though SQLite doesn't support `FOR UPDATE`)
- Consider: instead of outbox polling, use a direct webhook from the route handler (fire-and-forget) with the outbox as a fallback for failed deliveries

---

### D3. Feature Flag Race on Cold Start
**Severity: ⚪ LOW | Affects: Reliability edge case**

[env.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/env.ts) parses at module load time (top-level `const parsed = envSchema.parse(...)`). The planned `feature-flags.ts` reads from DB → Redis cache. But on Vercel cold start:

1. [env.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/env.ts) parses (synchronous, works fine)
2. First request hits a route that calls `isFeatureEnabled()`
3. `isFeatureEnabled()` reads from Redis (async)
4. Redis call fails on first cold start (connection not yet established)
5. Falls back to... what? DB? That's also a cold connection.

**Fix:** Define explicit cold-start behavior:
```typescript
export async function isFeatureEnabled(key: string): Promise<boolean> {
  // 1. Check in-memory cache (populated after first successful read)
  // 2. Try Redis GET (with 500ms timeout)
  // 3. Try DB SELECT (with 1s timeout)
  // 4. Fall back to hardcoded defaults (NEVER return false for P1 flags)
}
```
The hardcoded defaults are critical — P1 flags should default to ON even if both Redis and DB are unreachable.

---

### D4. SearchProvider Interface Assumes FTS5 — But No FTS5 Tables Exist
**Severity: 🟡 MEDIUM | Affects: Search correctness**

The ARCHITECTURE plans a `SearchProvider` interface with `fts5.provider.ts` as the P1 implementation. But the actual search ([search/route.ts](file:///c:/Biswajit/Codex/easyheals-next/src/app/api/search/route.ts)) uses `LIKE '%query%'`:

```typescript
or(
  like(hospitals.name, broadQ),
  like(hospitals.description, broadQ),
  like(hospitals.specialties, broadQ),
)
```

There are **no FTS5 virtual tables** in the schema. The search is a full `LIKE` scan, which:
- Doesn't support stemming ("cardiac" won't match "cardiology")
- Doesn't support ranking by relevance
- Is O(n) per query — gets slower as data grows
- Cannot use indexes (leading `%` wildcard defeats indexing)

The `fts5.provider.ts` is planned but the schema doesn't include FTS5 table creation. Turso/libSQL supports FTS5, but it requires explicit `CREATE VIRTUAL TABLE ... USING fts5(...)` DDL.

**Fix:**
- Add FTS5 virtual table creation to the migration plan (Task 1.1):
  ```sql
  CREATE VIRTUAL TABLE hospitals_fts USING fts5(name, city, description, specialties, content=hospitals, content_rowid=rowid);
  CREATE VIRTUAL TABLE doctors_fts USING fts5(full_name, city, specialization, bio, content=doctors, content_rowid=rowid);
  ```
- Add triggers to keep FTS5 tables in sync with base tables
- The `fts5.provider.ts` should use `MATCH` queries, not `LIKE`

---

## E. STRUCTURAL / MODULE DESIGN FLAWS

### E1. ingestion.ts — 1757 Lines, Untestable Monolith
**Severity: 🟡 MEDIUM | Affects: Maintainability**

[ingestion.ts](file:///c:/Biswajit/Codex/easyheals-next/src/lib/ingestion.ts) is 1,757 lines with:
- 4 separate `new GoogleGenerativeAI()` instantiations
- HTTP fetching (Jina, Google Search API)
- AI prompt construction and parsing
- Database operations
- Business logic (fuzzy matching, dedup)
- Type definitions

This file cannot be unit tested because every function depends on live Gemini and live DB. There are no dependency injection seams.

**Fix:** The ARCHITECTURE mentions moving to `src/lib/ai/operations/ingestion.ts` but that's just a rename. The actual fix needs:
```
src/lib/ingestion/
├── types.ts              — all type exports
├── fetchers/
│   ├── jina.ts           — fetchViaJina()
│   ├── google-search.ts  — fetchViaGoogleSearch()
│   └── browser.ts        — fetchViaBrowser()
├── extractors/
│   ├── hospital.ts       — extractHospitalFromText(text, aiClient)
│   ├── doctor.ts         — extractDoctorsFromText(text, aiClient)
│   └── package.ts        — extractPackagesFromText(text, aiClient)
├── matchers/
│   ├── fuzzy.ts          — chooseBestHospitalMatch()
│   └── dedup.ts          — deduplicateCandidates()
└── pipeline.ts           — orchestrator that composes the above
```
Each module takes dependencies as parameters (dependency injection) so they can be tested with mocks.

---

### E2. Provider Interface Violates Interface Segregation Principle
**Severity: ⚪ LOW | Affects: Code clarity**

The `NotificationProvider` interface (ARCHITECTURE §C.1) requires ALL implementations to have:
```typescript
sendOTP(...)                    // P1
sendLeadConfirmation(...)       // P1
sendWhatsAppTemplate(...)       // P2 — throws NotImplementedError in P1
sendBroadcast(...)              // P2 — throws NotImplementedError in P1
sendPushNotification(...)       // P3 — throws NotImplementedError in P1-P2
```

The `ConsoleProvider` (P1) must implement 5 methods, 3 of which throw `NotImplementedError`. This is a textbook ISP violation.

Similarly, the `PaymentProvider` requires `refund()` — which makes no sense for the `ConsoleProvider` (there's nothing to refund).

**Fix:** Use composed interfaces:
```typescript
interface OTPSender { sendOTP(...): Promise<void> }
interface LeadNotifier { sendLeadConfirmation(...): Promise<void> }
interface WhatsAppSender { sendWhatsAppTemplate(...): Promise<void> }  // P2
interface BroadcastSender { sendBroadcast(...): Promise<BroadcastResult> }  // P2
interface PushSender { sendPushNotification(...): Promise<void> }  // P3

// P1 provider only implements what it needs:
class ConsoleProvider implements OTPSender, LeadNotifier { ... }

// P2 provider implements more:
class MSG91Provider implements OTPSender, LeadNotifier, WhatsAppSender { ... }
```

---

### E3. ESLint Import Rules Declared — But No ESLint Config Exists
**Severity: ⚪ LOW | Affects: Long-term code quality**

ARCHITECTURE §A.2 declares 5 import rules:
```
Rule 1: src/lib/emr/* MUST NOT import from any other src/lib/* module
Rule 2: src/lib/referral/* MUST NOT import from any other src/lib/* module
Rule 3: src/app/api/v1/* MUST use withErrorHandler wrapper
...
```

But these are prose rules with no enforcement. There's no `.eslintrc` rule configuration, no `eslint-plugin-import` boundaries setup, no CI check.

**Fix:** Add to the P1 plan:
```bash
npm install eslint-plugin-boundaries
```
```json
// .eslintrc — import boundary rules
"boundaries/element-types": [
  { "type": "emr", "pattern": "src/lib/emr/*" },
  { "type": "referral", "pattern": "src/lib/referral/*" },
  { "type": "lib", "pattern": "src/lib/*" }
],
"boundaries/external": [
  { "from": "emr", "disallow": ["lib"] },
  { "from": "referral", "disallow": ["lib"] }
]
```

---

## SUMMARY: Priority Fix Order

| # | Finding | Severity | Fix Effort | Fix Before |
|---|---------|----------|------------|------------|
| B1 | Session token plaintext in DB | 🔴 HIGH | 1 hour | Now |
| B3 | /api/book — no auth, raw phone, no rate limit | 🔴 HIGH | 2 hours | Now |
| B4 | Audit log stores raw PII | 🟡 MEDIUM | 1 hour | Now |
| B2 | Middleware only checks cookie existence | 🔴 HIGH | 30 min | Now |
| A1 | Polymorphic FK anti-pattern in gamification | 🔴 HIGH | 4 hours | Before Task 1.1 |
| A2 | Identity split — phone_hash vs raw phone | 🔴 HIGH | 4 hours | Before Task 1.1 |
| A3 | Consent circular dependency | 🟡 MEDIUM | 1 hour | Before Task 2.1 |
| C1 | 12x GoogleGenerativeAI instantiations | 🟡 MEDIUM | 3 hours | Before Task 1.2b |
| D4 | No FTS5 tables — search is LIKE scan | 🟡 MEDIUM | 4 hours | Before Task 1.1 |
| E1 | ingestion.ts 1757-line monolith | 🟡 MEDIUM | 8 hours | Before Task 1.2b |
| C3 | Search 3-call cascade, no streaming | 🟡 MEDIUM | 4 hours | Before Task 2.5 |
| A4 | Redundant leaderboard storage | 🟡 MEDIUM | 1 hour | Before Task 1.1 |
| D1 | 4 different error response shapes | 🟡 MEDIUM | 4 hours | Before Task 1.3 |
| C2 | No AI timeout/retry | 🟡 MEDIUM | 2 hours | Before Task 1.6 |
| D2 | Outbox polling won't work on Vercel | 🟡 MEDIUM | Design | Before Task 1.6 |
| A5 | ingestion_field_confidences no FK | 🟡 MEDIUM | 2 hours | Before Task 1.1 |
| D3 | Feature flag cold-start race | ⚪ LOW | 1 hour | Before Task 1.4 |
| E2 | NotificationProvider ISP violation | ⚪ LOW | 2 hours | Before Task 3.6 |
| E3 | Import rules without ESLint enforcement | ⚪ LOW | 1 hour | During Task 1.2b |

> **Bottom line:** Fix B1, B2, B3, B4 (security) immediately — these are live production vulnerabilities. Then address A1, A2 (data model) before writing any P1 schema migrations. The rest can be addressed in sequence during the P1 sprint.
