# EasyHeals Platform — Cross-Phase Architecture Reference
## Version: 1.2 | Created: 2026-03-13 | Updated: 2026-03-13 | HLD Ref: v4.0 + P5 Pharmacy Extension
## HLD §0–§12 cross-checked. All gaps resolved. Monorepo deviation documented.
## Scope: P1 through P5 — decisions made upfront to avoid rework

> This document is the authoritative reference for all architecture decisions.
> PLAN.md contains the task list. This document explains *why*.

---

## SECTION A — MODULE BOUNDARIES & EXTRACTION TIMELINE

> **Intentional deviation from HLD §11**: HLD specifies a Turborepo monorepo (`apps/web/`, `packages/db/`, `packages/ai/`, etc.). This architecture uses a **flat Next.js app** (`src/lib/*`) instead, to avoid monorepo migration risk and build tooling overhead in P1-P2. All HLD `packages/*` modules map directly to `src/lib/*` subdirectories with identical module boundaries. Turborepo migration deferred to P3 if/when a separate AI worker is extracted.

### A.1 Module Map (what lives where, and when it moves)

```
src/lib/
├── core/           PERMANENT monolith — shared infra, never extracted
│   ├── db.ts                    Turso client + Drizzle instance
│   ├── redis.ts                 Upstash Redis client (singleton)
│   └── env.ts                   Zod-validated env (update existing)
│
├── ai/             P1-P2 monolith → EXTRACT to packages/ai at P3 (batch worker)
│   ├── providers/
│   │   ├── provider.interface.ts   AIProvider interface
│   │   ├── gemini.provider.ts      refactor existing gemini.ts
│   │   └── openai.provider.ts      P3 stub
│   ├── operations/
│   │   ├── search-intent.ts        refactor existing extractSearchIntent()
│   │   ├── health-news.ts          P1 — AI tips
│   │   ├── ingestion.ts            refactor existing ingestion.ts
│   │   ├── brochure.ts             refactor existing brochure logic
│   │   └── translation.ts          P2 — Hindi/regional
│   ├── cache.ts                    Redis-backed (TTL per operation type)
│   ├── cost-tracker.ts             Per-token budget limits + alerts
│   └── circuit-breaker.ts          Fail open → heuristic fallback
│
├── search/         P1-P2 monolith → STAYS in monolith (FTS5 until P3)
│   ├── provider.interface.ts    SearchProvider interface
│   ├── fts5.provider.ts         P1-P2: SQLite FTS5
│   ├── typesense.provider.ts    P3 stub (ready to fill)
│   └── index.ts                 factory: env.SEARCH_PROVIDER=fts5|typesense
│
├── notifications/  PERMANENT monolith (thin wrapper, no state)
│   ├── provider.interface.ts    NotificationProvider interface
│   ├── console.provider.ts      P1: free, zero infra
│   ├── msg91.provider.ts        P2 stub (MSG91_AUTH_KEY already in env.ts!)
│   ├── twilio.provider.ts       P2 stub
│   ├── whatsapp.provider.ts     P2 stub (WhatsApp Business API)
│   ├── fcm.provider.ts          P3 stub (Firebase Cloud Messaging push)
│   └── index.ts                 factory: env.NOTIFICATION_PROVIDER
│
├── payments/       P2+ only — P1 has free tier only
│   ├── provider.interface.ts    PaymentProvider interface
│   ├── console.provider.ts      P1 stub: logs payment intent (no charge)
│   ├── razorpay.provider.ts     P2 stub: subscription + one-time payments
│   └── index.ts                 factory: env.PAYMENT_PROVIDER
│
├── security/       PERMANENT monolith
│   ├── consent.ts               consent check + create + revoke
│   ├── phi-redactor.ts          scrub PII from log objects
│   ├── bot-guard.ts             UA + honeypot + cadence checks
│   ├── encryption.ts            AES-256 encrypt/decrypt for phone_encrypted
│   └── otp.ts                   generate + hash + verify OTP
│
├── gamification/   PERMANENT monolith
│   ├── award.ts                 awardPoints() — idempotent, capped, abused-checked
│   ├── caps.ts                  per-event caps and period logic
│   ├── proof-validator.ts       Phase-B proof checks (P2)
│   ├── abuse-detector.ts        device fp + duplicate account detection
│   └── refresh-leaderboard.ts   hourly cron job function
│
├── crm/            P1 stub → P2 full event bus
│   ├── events.ts                event type definitions (lead.created etc.)
│   ├── outbox.ts                writeEvent() → INSERT outbox_events (P1)
│   └── processor.ts             P2: polls outbox, delivers via Redis/webhook
│
├── analytics/      P1 minimal → P2 full
│   ├── events.ts                event name constants
│   ├── track.ts                 trackEvent() with consent check
│   └── provider-stats.ts        P2: hospital analytics aggregator
│
├── observability/  PERMANENT monolith
│   ├── logger.ts                PHI-safe structured logger (wraps console)
│   ├── metrics.ts               custom counters (search, lead, error rates)
│   └── health.ts                health check aggregator (db + redis + ai)
│
├── config/         PERMANENT monolith
│   ├── feature-flags.ts         isFeatureEnabled() — DB + env fallback
│   └── system-config.ts         getConfig() — DB-backed, Redis-cached 60s
│
├── errors/         PERMANENT monolith
│   └── app-error.ts             AppError class + withErrorHandler + error codes
│
├── i18n/           PERMANENT monolith
│   └── server.ts                server-side t() helper
│
├── emr/            P3 ISOLATED — will become separate deploy unit
│   └── index.ts                 P1: just exports feature flag check
│                                P3: full EMR module (never import from non-emr)
│
├── documents/      P5 (was P4) — patient document management + sharing
│   ├── blob.client.ts           Vercel Blob: upload(), getUrl(), delete() (replaces R2)
│   ├── share.ts                 createShare(), revokeShare(), getValidShare()
│   ├── access-log.ts            logDocumentAccess() — every provider access recorded
│   └── index.ts                 re-exports for API routes
│
├── health/         P5 NEW — AI Health Memory engine (PHI-encrypted, never logged)
│   ├── encryption.ts            encryptPHI(data) / decryptPHI(ciphertext)
│   │                            AES-256-GCM, HEALTH_PHI_ENCRYPTION_KEY env var
│   │                            SEPARATE key from existing security/encryption.ts (phone)
│   ├── extract.ts               Gemini Vision: blob URL → structured health events
│   │                            Returns: { diagnoses[], medications[], labs[], vitals[] }
│   ├── context.ts               buildHealthContext(patientId): string
│   │                            Decrypts + formats health_memory_events → Gemini system prompt
│   │                            Hard limit: 200 events (~30K tokens), newest-first
│   │                            NEVER cached — built fresh each Health Coach request
│   ├── memory-writer.ts         writeMemoryEvents(patientId, source, events[])
│   │                            Encrypts each event with encryptPHI before INSERT
│   │                            Used by: extract.ts, ABHA importer, EMR bridge
│   └── index.ts                 re-exports for API routes
│
├── scheduling/     P4 (activated P5) — slot generation + availability engine
│   ├── generate-slots.ts        buildSlotsForDate(doctorId, date) → appointmentSlots rows
│   ├── block.ts                 blockRange(), unblockRange()
│   └── config.ts                getProviderSchedule(), upsertProviderSchedule()
│
└── care-nav/       P6 ISOLATED — Care Navigation Engine (symptom triage + matching)
    └── index.ts                 stub: feature flag check only (replaces old referral/ module)
```

### A.2 Import Rules (Enforce via ESLint)

```
Rule 1: src/lib/emr/* MUST NOT import from any other src/lib/* module
Rule 2: src/lib/health/* MUST NOT import from src/lib/emr/* or src/lib/care-nav/*
Rule 3: src/lib/care-nav/* MUST NOT import from any other src/lib/* module
Rule 4: src/app/api/v1/* MUST use withErrorHandler wrapper
Rule 5: No raw phone numbers in log statements (use phi-redactor)
Rule 6: No direct DB access in route handlers — go through lib/ functions
Rule 7: health_memory_events.data_encrypted MUST NEVER appear in logs — use phi-redactor
```

---

## SECTION B — DATABASE STRATEGY

### B.1 Database per Phase

| Phase | Tables | Database | Why |
|-------|--------|----------|-----|
| P1-P2 | All current tables + P1 additions | Turso (libSQL) | Fast, serverless, India edge |
| P3 | EMR tables only (new tables) | Neon/Supabase Postgres | Column-level encryption, RLS, PHI perimeter |
| P3 | All P1-P2 tables | Stay in Turso | No migration needed — non-PHI |
| P4 | Referral + insurance data | Separate Postgres schema | Separate BAA perimeter |

**Key decision**: P3 does NOT migrate existing tables. EMR is a brand-new set of tables in a new DB. Drizzle config will have two DB connections at P3: `db` (Turso) and `emrDb` (Postgres).

### B.2 Schema — P1 Tables with Future Stubs

> Nullable stub columns = zero migration needed when P2/P3 activates them.
> All stubs are ignored by application code until feature flag is ON.

#### patients (NEW — P1 required)
```typescript
id, phone_hash, city, device_fp_hash, created_at    ← P1

// P2 stubs (nullable, populated when consent + WhatsApp feature active)
display_name            text nullable       // shown in UI after OTP verify
phone_encrypted         text nullable       // AES-256(phone, ENCRYPTION_KEY)
email_encrypted         text nullable       // AES-256(email, ENCRYPTION_KEY)
preferred_lang          text default 'en'   // en | hi | mr | ta | te | kn
membership_tier         text default 'free' // P2: free | silver | gold
whatsapp_opted_in       boolean default false

// P3 stubs (nullable — never populated until EMR feature flag ON)
date_of_birth           timestamp nullable
gender                  text nullable       // male | female | other | prefer_not_to_say
blood_group             text nullable       // A+ A- B+ B- O+ O- AB+ AB-

// P4 stubs (nullable)
abha_id                 text nullable unique  // ABHA/ABDM health ID
```

#### leads (EXISTING — add stub columns)
```typescript
// Existing P1 columns (keep all)
id, full_name, phone, email, city, country_code, status, source, score,
hospital_id, assigned_user_id, medical_summary, created_at, updated_at

// ADD in P1 migration (nullable stubs for future)
patient_id              text nullable FK patients.id
consent_record_id       text nullable FK consent_records.id

// P2 stubs (nullable)
assigned_doctor_id      text nullable FK doctors.id  // hospital assigns doctor
preferred_slot_date     timestamp nullable            // patient's preferred time
appointment_id          text nullable                 // FK appointments (P2 table)
broadcast_campaign_id   text nullable                 // for P2 attribution
whatsapp_sent           boolean default false
easyheal_owner_id       text nullable FK users.id     // EasyHeals ops manager
easyheal_notes          text nullable                 // NOT visible to hospital
referral_id             text nullable                 // FK referrals (P4 table)
```

#### hospitals (EXISTING — add stub columns)
```typescript
// ADD in P1 migration (P2 stubs)
whatsapp_business_number  text nullable    // P2 WhatsApp Business number
queue_enabled             boolean default false
broadcast_enabled         boolean default false
slot_duration_minutes     integer nullable default 15
max_daily_appointments    integer nullable
razorpay_customer_id      text nullable
```

#### sessions (EXISTING — add sessionType)
```typescript
// ADD session_type column (default 'admin' for all existing rows)
session_type  text not null default 'admin'  // admin | portal
```
Patient sessions are Redis-only. No sessions table row for patients.

**Updated TTLs** (fix existing 7-day TTL to comply with HLD §8.2):
- admin: 4 hours (SESSION_TTL_ADMIN = 4 * 60 * 60 * 1000)
- portal: 8 hours (SESSION_TTL_PORTAL = 8 * 60 * 60 * 1000)

#### consent_records (NEW — P1 critical)
Full schema per HLD §2.1 — see PLAN.md Task 1.1.

#### patients → consent_records link
One patient can have many consent_records (one per purpose).
Purpose enum: `booking_lead | analytics | marketing | ai_health | emr_access | referral`

#### analytics_events (NEW — P1 stub, P2 full)
```typescript
id, event_name, entity_type nullable, entity_id nullable,
patient_id nullable,      // only if consent for analytics granted
session_id,               // Redis patient session token hash
ip_hash,                  // one-way hash
city nullable, lang default 'en',
properties json nullable,
consent_granted boolean,  // true only if analytics consent active
created_at
```
P1: Only write non-PII events (page_view, search). Never write patient_id without analytics consent.

#### payment_transactions (NEW — P2 ready stub, created now)
```typescript
id, entity_type (hospital_subscription|patient_membership|one_time),
entity_id, amount, currency default 'INR',
status (pending|success|failed|refunded),
provider default 'console',  // console | razorpay | stripe
provider_tx_id nullable,
provider_order_id nullable,
metadata json nullable,
created_at, updated_at
```
P1: Table exists but no rows inserted. P2: Razorpay fills it.

#### ingestion_field_confidences (EXISTING — upgrade to full provenance)
Add missing columns per HLD §4.1:
```typescript
// ADD these to existing table
source_type       text  // web_scrape | brochure_pdf | admin_manual | provider_self_service | crowd_contribution
extracted_at      timestamp
review_status     text default 'pending'  // pending | auto_approved | human_approved | rejected
reviewed_by       text nullable FK users.id
reviewed_at       timestamp nullable
last_verified_at  timestamp nullable
conflict_with     text nullable  // FK to another ingestion_field_confidences row
```

**Provenance column strategy decision (HLD §6 cross-check):**
> HLD §6 shows `source_url`, `confidence`, `review_status` on the hospitals/doctors entity rows.
> ARCHITECTURE decision: Keep provenance ONLY in `ingestion_field_confidences` (per-field granularity).
> Do NOT denormalize to hospitals/doctors tables.
> Rationale: Per-field provenance (HLD §4.1) is more valuable than entity-level. Admin moderation queue uses JOINs to show provenance context — no performance issue at current scale.
> If a quick "is this hospital data approved" check is needed, add a computed view or a `review_status` column ONLY on `ingestion_candidates` (the pending-review staging table), not on the live `hospitals` table.

**Staleness detection thresholds (HLD §4.4 — implemented in `/api/cron/staleness-scan`):**
```
last_verified_at > 90 days  → flag record: show "may be outdated" in provider portal
last_verified_at > 180 days → show public warning: "Data last verified 6+ months ago"
Cron schedule: daily at 2 AM UTC (0 2 * * *)
Action: queue flagged records for re-scrape OR send provider verification nudge
Provider self-verify: hospital_admin clicks "Confirm current" → updates last_verified_at
```

---

## SECTION C — PROVIDER INTERFACES

### C.1 NotificationProvider Interface
```typescript
export interface NotificationProvider {
  // P1
  sendOTP(phone: string, otp: string, lang?: string): Promise<void>;
  sendLeadConfirmation(phone: string, hospitalName: string, lang?: string): Promise<void>;

  // P2 (throw NotImplementedError in P1 providers)
  sendWhatsAppTemplate(phone: string, templateName: string, vars: Record<string, string>): Promise<void>;
  sendBroadcast(recipients: string[], templateName: string, vars: Record<string, string>): Promise<BroadcastResult>;

  // P3 (throw NotImplementedError in P1-P2 providers)
  sendPushNotification(deviceToken: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}
```

### C.2 SearchProvider Interface
```typescript
export interface SearchProvider {
  search(query: string, filters: SearchFilters, options?: SearchOptions): Promise<SearchResult[]>;
  suggest(prefix: string, filters: { city?: string }): Promise<SearchSuggestion[]>;
  reindex(entityType: 'hospital' | 'doctor', entityId: string): Promise<void>;
  fullReindex(): Promise<{ indexed: number; failed: number }>;
}

export interface SearchFilters {
  city?: string;
  specialty?: string;
  entityType?: 'hospital' | 'doctor' | 'treatment';
  verified?: boolean;
  isActive?: boolean;
}
```

### C.3 PaymentProvider Interface
```typescript
export interface PaymentProvider {
  createSubscription(params: SubscriptionParams): Promise<{ orderId: string; paymentUrl?: string }>;
  verifyWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refund(transactionId: string, amount?: number): Promise<void>;
}
```

### C.4 AIProvider Interface
```typescript
export interface AIProvider {
  extractSearchIntent(query: string, city?: string): Promise<SearchIntent>;
  generateHealthTips(interests: string[], lang: string): Promise<HealthTip[]>;
  extractFromBrochure(text: string): Promise<ExtractedEntity>;
  translateText(text: string, targetLang: string): Promise<string>;
  // Cost tracking built in — every call logs tokens used
}
```

---

## SECTION D — REDIS KEY NAMESPACE

All keys follow: `{module}:{entity}:{identifier}:{sub}`

```
# Sessions
patient:session:{token}                    → { patientId, phoneHash, city, lang, expiresAt }
patient:session:by_patient:{patientId}     → Set of active tokens (for invalidate-all)

# Rate Limiting (all TTL-based sliding windows)
rate:search:anon:{ipHash}:{windowMinute}   → count (TTL = window end)
rate:search:patient:{patientId}:{window}   → count
rate:otp:{phoneHash}:{window10min}         → count (max 3)
rate:otp:lockout:{phoneHash}               → "1" (TTL = lockout duration)
rate:lead:ip:{ipHash}:{windowHour}         → count
rate:lead:patient:{patientId}:{windowDay}  → count
rate:suggest:{ipHash}:{windowMin}          → count

# Search Cache
search:intent:{sha256(query+city)}         → SearchIntent JSON (TTL 5min)
search:suggest:{prefix}:{city}             → suggestions[] (TTL 60s)

# Config Cache (avoid DB hit on every request)
config:system:{key}                        → value string (TTL 60s)
config:flags:{featureKey}                  → "true"|"false" (TTL 60s)

# Gamification
game:cap:{userId}:{eventType}:{period}     → count (TTL = period end)
game:streak:{userId}                       → { current, longest, lastDate }
leaderboard:{city}:{period}                → Sorted Set (ZADD score=points, member=userId)

# AI Cost Tracking
ai:cost:{model}:{date}                     → total_tokens integer (TTL = 7 days)
ai:circuit:{model}                         → "open"|"closed" (TTL = recovery window)

# P2: Queue Management (not built in P1, namespace reserved)
queue:hospital:{hospitalId}:position       → Sorted Set
queue:hospital:{hospitalId}:next_token     → integer counter

# P2: Broadcast
broadcast:delivery:{campaignId}:status     → Hash { sent, failed, pending }

# Bot / Abuse
bot:blocked:{ipHash}                       → "1" (TTL = block duration)
bot:cadence:{ipHash}                       → last request timestamp (TTL 5s)
bot:fp:{deviceFpHash}:accounts             → Set of patientIds (TTL 24h)
```

---

## SECTION E — FEATURE FLAGS (COMPLETE LIST P1–P5)

### P1 Flags (default ON — these ARE the product)
```
search_ai_intent          ON   // Gemini NLU for search
search_suggest            ON   // autocomplete endpoint
gamification_phase_a      ON   // safe events only
consent_modal             ON   // DPDP P1 gate
lead_submission           ON   // callback request form
health_news_ai            ON   // AI-generated health tips
ingestion_pipeline        ON   // admin ingestion tool
moderation_queue          ON   // admin moderation
multilingual_hi           ON   // Hindi UI
```

### P2 Flags (default OFF — gate checklist must pass first)
```
appointment_booking       OFF  // real slot booking (G11 in compliance gate)
whatsapp_notifications    OFF  // WhatsApp API (G5 in compliance gate)
token_queue               OFF  // live queue display (Redis SSE)
mass_broadcast            OFF  // provider broadcast tool
gamification_phase_b      OFF  // verified events (G12 in compliance gate)
paid_membership_patient   OFF  // patient paid tier (Razorpay)
provider_analytics        OFF  // analytics dashboard for hospitals
crm_webhooks              OFF  // event bus webhook delivery
otp_sms                   OFF  // real SMS (console until DLT approved, G4)
```

### P3 Flags (default OFF — EMR gate checklist must pass)
```
emr_lite                  OFF  // visit records, prescriptions
lab_test_ordering         OFF  // lab test booking
video_consultation        OFF  // telemedicine
typesense_search          OFF  // switch search provider to Typesense
city_demand_intelligence  OFF  // B2B demand analytics
```

### P4 Flags (default OFF — all activated or carried to P5 during P4 build)
```
opd_queue                 OFF  // OPD walk-in queue management
provider_staff_mgmt       OFF  // receptionist + billing sub-users
provider_schedule_mgmt    OFF  // working hours + slot configuration
patient_document_upload   OFF  // patient document upload (Vercel Blob — P5 rework)
document_sharing          OFF  // patient→provider document shares (P5 W2)
```

### P5 Flags (default OFF — see §V6.7 for gate checklists)
```
health_memory             OFF  // health_documents + health_memory_events
ai_health_coach           OFF  // /dashboard/health-coach + SSE
previsit_brief            OFF  // doctor-side brief generation cron
abha_integration          OFF  // ABDM sandbox health ID linking
provider_self_registration OFF // 4-step self-serve onboarding
i18n_hindi                OFF  // Hindi UI strings (next-intl)
rewards_page              OFF  // /dashboard/rewards full gamification
slot_auto_generation      OFF  // on-demand slot generation from schedule config
```

---

## SECTION F — SESSION ARCHITECTURE (FINAL)

### F.1 Session Types

| Session Type | Storage | TTL | Key/Cookie |
|-------------|---------|-----|-----------|
| Admin (owner/admin/advisor/viewer) | Turso sessions table, `session_type='admin'` | 4 hours | `eh_admin_session` cookie |
| Portal (hospital_admin, doctor) | Turso sessions table, `session_type='portal'` | 8 hours | `eh_portal_session` cookie |
| Patient (OTP-verified) | Redis ONLY | 24 hours | `eh_patient_session` cookie → Redis lookup |
| Anonymous | None | N/A | Redis rate counter by IP only |

### F.2 Session Cookie Names (update from single cookie)
```typescript
export const SESSION_COOKIES = {
  admin:   'eh_admin_session',    // was: easyheals_next_session
  portal:  'eh_portal_session',
  patient: 'eh_patient_session',
} as const;
```
> Migration: existing `easyheals_next_session` cookie maps to admin session. Update middleware to check `eh_admin_session` first, then fall back to old cookie for zero-downtime migration.

### F.3 Patient Session Schema (Redis value)
```json
{
  "patientId": "uuid",
  "phoneHash": "sha256hex",
  "displayName": "Priya" | null,
  "city": "Bangalore" | null,
  "lang": "en" | "hi",
  "consentPurposes": ["booking_lead", "analytics"],
  "membershipTier": "free",
  "createdAt": "iso8601",
  "expiresAt": "iso8601"
}
```

---

## SECTION G — ENCRYPTION STRATEGY

### G.1 Phone Encryption (P1 forward)
```
phone_hash:      SHA-256(phone + PHONE_SALT)         → one-way, for dedup
phone_encrypted: AES-256-GCM(phone, ENCRYPTION_KEY)  → reversible, for WhatsApp P2
```
Both stored in `patients` table. P1: populate phone_hash always. phone_encrypted only when patient agrees to be contacted (`booking_lead` consent granted).

Required env vars (add to env.ts):
```
PHONE_SALT          = random 32-byte hex (never changes — changing breaks all patient lookups)
ENCRYPTION_KEY      = random 32-byte hex (rotate every 90 days per HLD §1.3)
ENCRYPTION_KEY_V2   = next key (during rotation window, decrypt with v1, re-encrypt with v2)
ENCRYPTION_KEY_VERSION = "v1" | "v2" (current active version)
```

### G.2 PHI Encryption (P3)
P3 EMR tables use column-level encryption per patient:
- Each patient gets a derived key: `HKDF(masterKey, patientId)`
- Never stored in DB — derived on demand
- Master key in Vercel secrets (not code)
> NOT built in P1/P2. Documented here so P3 design doesn't conflict.

---

## SECTION H — CRM EVENT BUS (OUTBOX PATTERN)

### H.1 P1: Write-only
```typescript
// crm/outbox.ts — P1 implementation
export async function publishEvent(topic: CRMEventTopic, payload: unknown): Promise<void> {
  await db.insert(outboxEvents).values({
    topic,
    payload: JSON.stringify(payload),
    status: 'pending',
    retryCount: 0,
    availableAt: new Date(),
  });
  // P1: no processor — events accumulate for P2
}
```

### H.2 P2: Add Processor (Vercel cron every 30s)
Reads `status='pending'` rows → delivers to Redis pub/sub → marks `status='sent'`.
Dead letter after 3 retries: `status='dead_letter'`.

### H.3 Event Topics (P1 defines all, P2 processes them)
```typescript
export type CRMEventTopic =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.appointment_confirmed'  // P2
  | 'lead.converted'              // P2
  | 'provider.subscription_changed' // P2
  | 'broadcast.sent'              // P2
  | 'patient.consent_granted'     // P1
  | 'patient.consent_revoked'     // P1
  | 'gamification.points_awarded' // P1
  | 'gamification.badge_earned'   // P1
```

---

## SECTION I — MULTI-TENANCY RULES

These must be enforced in every portal API route handler:

```typescript
// RULE: Never trust client-sent IDs for owned resources
// Always derive entity from session, not request body

// Hospital portal — ALWAYS add this check
const hospitalId = session.entityId;  // from portal_session
// NEVER: const hospitalId = req.body.hospitalId

// Doctor portal
const doctorId = session.entityId;

// Admin — can access all, but log it
await writeAuditLog({ actorUserId: session.userId, action: 'ADMIN_ACCESS', entityType, entityId });
```

---

## SECTION J — VERCEL CRON JOBS

Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/leaderboard-refresh",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/staleness-scan",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/outbox-processor",
      "schedule": "*/2 * * * *",
      "comment": "P2 only — returns 200 immediately if crm_webhooks flag is OFF"
    },
    {
      "path": "/api/cron/search-reindex",
      "schedule": "0 2 * * 0",
      "comment": "P3 only — returns 200 immediately if typesense_search flag is OFF"
    }
  ]
}
```
All cron routes check their feature flag first and return `{ ok: true, skipped: true }` if flag is OFF. Zero-cost no-ops in P1.

---

## SECTION K — API VERSIONING RULES

```
/api/v1/*       Patient-facing + partner-facing APIs (versioned, frozen on ship)
/api/admin/*    Internal admin APIs (not versioned — internal use only)
/api/portal/*   Hospital/Doctor portal APIs (not versioned — controlled rollout)
/api/cron/*     Internal cron triggers (not versioned — Vercel-to-app only)
/api/auth/*     Auth flows (not versioned — cookie-based, not API contracts)
/api/health     Health check (not versioned)
```

Breaking changes in `/api/v1/*` require `/api/v2/*`. Non-breaking additions (new optional response fields) allowed within version. The contract to freeze: request shape + required response fields.

**Migration strategy for existing routes (HLD §10 compliance):**
- Existing `/api/book`, `/api/public/*`, `/api/admin/*`, `/api/portal/*` routes stay as-is during P1 build
- New P1 public-contract endpoints (search/intent, leads, consent, gamification, leaderboard, moderation, health-news, auth/otp) go directly under `/api/v1/`
- Old `/api/book` → kept for backward compat; internally delegates to `/api/v1/leads` logic
- No migration of admin/portal routes — they are not external API contracts (HLD §10 only freezes patient/partner-facing routes)

---

## SECTION L — OBSERVABILITY & LOGGING

### L.1 Structured Log Format (all log writes)
```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  code?: ErrorCode;
  traceId: string;           // X-Request-Id header
  userId_hash?: string;      // SHA-256 of userId (never raw)
  patientId_hash?: string;   // SHA-256 of patientId (never raw)
  action?: string;
  entityType?: string;
  entityId?: string;         // OK to log — not PII
  ts: string;
  durationMs?: number;
  // NEVER: phone, name, email, diagnosis, prescription
}
```

### L.2 PHI Fields — NEVER Log These
```
phone, phone_hash (partially identifiable), email, full_name, display_name,
date_of_birth, blood_group, gender, abha_id, diagnosis, prescription,
medical_summary, symptom text, review text (P2)
```
The `phi-redactor.ts` middleware strips these from any object before it reaches a log sink.

### L.3 Sentry Integration
- Non-operational errors (SYS_UNHANDLED): always report
- Operational errors (AppError.isOperational=true): don't report, just log
- PHI-scrub before Sentry send: custom `beforeSend` hook

---

## SECTION M — SECURITY HEADERS (next.config.ts update)

Add to `next.config.ts`:
```typescript
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ],
  },
  {
    source: '/api/(.*)',
    headers: [
      { key: 'Cache-Control', value: 'no-store' },  // never cache API responses
    ],
  },
]
```

---

## SECTION N — MULTILINGUAL ARCHITECTURE

### N.1 i18n Namespace Design
```
src/i18n/locales/
├── en.json      Base language (always complete — extracted P5 W4)
├── hi.json      Hindi — P5 W4 target (full translation)
├── mr.json      Marathi — P6 (stub empty object in P5 W4)
├── ta.json      Tamil — P6 stub
├── te.json      Telugu — P6 stub
├── kn.json      Kannada — P6 stub
├── bn.json      Bengali — P6 stub
└── gu.json      Gujarati — P6 stub
```

### N.2 i18n Implementation (P5 W4)
- **Package**: `next-intl` v3 (Vercel-native, App Router compatible)
- **Locale routing**: Cookie-based for P5 (simpler); locale prefix (`/hi/*`) deferred to P6
- **Coverage**: All portal, dashboard, public, and error pages. Admin UI remains English-only.
- **AI content translation**: Hospital descriptions + doctor bios → Gemini translates on-demand
  - Only if patient lang != 'en' AND content has no existing translation
  - Rate-limited: max 100 AI translations/day per patient (free tier)
  - Cached: 24h per entity per language in Redis (`i18n:translate:{entityId}:{lang}`)
- **Health Coach responses**: Pass `lang` to Gemini system prompt → AI responds in patient's language
- **Admin UI**: English-only permanently (internal tool, no translation needed)

### N.3 Language Detection (Priority Order)
1. Patient session `lang` preference (set via LanguageSwitcher, stored in session + cookie)
2. `Accept-Language` HTTP header
3. Gemini language detection on search query (Hinglish → 'hi')
4. Default: `'en'`
> Note: `lang` query param override removed — session preference is authoritative for authenticated users.

### N.4 Search Transliteration (unchanged from P1)
- Gemini handles all transliteration (Hinglish → specialty)
- FTS5: accepts Devanagari Unicode natively
- Synonym table: `specialty_synonyms` DB table (admin-managed)
  - `{ lang, synonym, canonical_specialty }` — e.g., `{ 'hi', 'दिल', 'cardiology' }`

### N.5 Feature Flag Gate
```
i18n_hindi: OFF → ON after hi.json fully translated and native-speaker reviewed
```
When OFF: app renders in English regardless of patient preference.
When ON: LanguageSwitcher is visible, next-intl middleware activated.

---

## SECTION O — ANALYTICS CONSENT ENFORCEMENT

Every write to `analytics_events` table MUST call:
```typescript
// analytics/track.ts
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  if (event.patientId) {
    const hasConsent = await checkConsent(event.patientId, 'analytics');
    if (!hasConsent) {
      // Drop the event silently — never throw, never block UX
      return;
    }
  }
  await db.insert(analyticsEvents).values(event);
}
```
Anonymous events (no patientId): always written (no consent needed for aggregated anonymous data — DPDP §3(e) exemption for statistical purposes, no individual identification possible).

---

## SECTION P — P2 COMPATIBILITY GATE (What P1 Must NOT Break)

| P2 Feature | P1 Must Do | If P1 Gets This Wrong |
|-----------|-----------|----------------------|
| WhatsApp notifications | Store `phone_encrypted` in patients table | Full phone re-collection needed |
| Real appointment booking | Keep `leads.preferred_slot_date` nullable stub | Only additive migration needed |
| Doctor assignment | Keep `leads.assigned_doctor_id` nullable stub | Only additive migration needed |
| Provider analytics | `analytics_events` table exists from P1 | Can't backfill historical data |
| CRM event bus | outbox_events populated from P1 | Historical events missing |
| Session types | `session_type` column in sessions table | Sessions migration needed |
| Feature flags | P2 flags exist but OFF | No DB migration needed for P2 activation |
| Gamification Phase-B | `phaseRequired` on badges, `proofId` on events | Awards may be retroactive |
| Razorpay payment | `payment_transactions` table exists | Only provider stub swap needed |
| Multilingual P2 langs | All UI strings in i18n files, not hardcoded | UI audit + translation work |

---

## SECTION Q — PACKAGES TO ADD (npm install)

```bash
# P1 required additions
npm install @upstash/redis              # Redis client (Vercel edge-safe)
npm install @upstash/ratelimit          # Redis-based rate limiting helper
npm install firebase-admin             # FCM push notifications (send-only, P1 stub → P3 active)

# These are already in env.ts (MSG91_AUTH_KEY) — stubs ready
# msg91, twilio: install only when NOTIFICATION_PROVIDER switches

# Monitoring (add P1)
npm install @sentry/nextjs              # Error tracking + PHI-scrubbing hook
```

---

## SECTION R — DRIZZLE MIGRATION STRATEGY

### R.1 Migration file naming
```
drizzle/
├── 0000_initial.sql          ← existing (all current tables)
├── 0001_p1_patients.sql      ← Task 1.1: patients, consent_records
├── 0002_p1_gamification.sql  ← Task 1.1: gamification tables
├── 0003_p1_config.sql        ← Task 1.1: system_config, feature_flags
├── 0004_p1_stubs.sql         ← Task 1.1: stub columns on leads, hospitals, sessions
├── 0005_p1_analytics.sql     ← Task 1.1: analytics_events, payment_transactions
└── 0006_p1_provenance.sql    ← Task 1.1: upgrade ingestion_field_confidences
```
Each migration is idempotent. Run `npm run db:migrate` to apply. If stopped mid-task, re-running is safe.

### R.2 Seed Data (run after migration)
```typescript
// drizzle/seed-p1.ts — insert default data
// 1. Default feature flags (all P1 flags ON, P2-P4 OFF)
// 2. Default system_config (rate limits with documented defaults)
// 3. Default gamification_config (point values from HLD §3.1)
// 4. Default badges (PROFILE_COMPLETED, FIRST_LEAD, STREAK_7 etc.)
// 5. Default roles (if not already seeded)
```

---

## APPENDIX — P3/P4/P5 Reference (Don't Build — Just Know)

### P3: EMR Architecture (12-30 months)
- Separate Next.js app at `/emr.easyheals.com` or `/app.easyheals.com/emr`
- Separate Postgres DB with column-level encryption
- Separate BAA perimeter
- Main app → EMR: REST API with JWT issued by main app auth
- Audit log: dedicated EMR audit log in EMR Postgres (not main Turso)

### P4: Referral Engine Architecture
- Separate Node.js service
- Manages referral graph: doctorA → patientX → hospitalB
- Financial tracking: referral fees, conversion attribution
- Never cross-imports from main app

---

## SECTION S — P5: PHARMACY PRESCRIPTION ROUTING
### Phase: 36-54 months | Depends on: P2 (payments) + P3 (EMR e-prescriptions, optional)

> This section is an exploratory design for P5. Full detailed planning happens when P4 ships.
> Architecture decisions here are made now ONLY to ensure P1-P4 schema leaves the right hooks.
>
> **Design philosophy: Prescription routing platform, NOT a pharmacy e-commerce app.**
> EasyHeals connects patients with local pharmacies — pharmacies manage their own stock, billing, and fulfilment.

---

### S.1 Vision & Scope

**Patient flow (simplified):**
1. Patient uploads prescription (photo or PDF)
2. System shows nearby verified pharmacies that can fulfil the prescription
3. Each pharmacy quotes: can supply? → price estimate + ready-by time
4. Patient selects a pharmacy
5. Patient chooses: **self pickup** OR **delivery** (pharmacy's own riders / Porter / Shadowfax)
6. Delivery fee shown upfront (pharmacy-configured)
7. City-to-village: Shadowfax handles tier-2/3/rural delivery

**What P5 is NOT:**
- Not a medicine catalogue/inventory system — EasyHeals does NOT manage stock
- Not a GST billing system — pharmacy handles their own invoices
- No drug interaction checker — out of scope for P5
- Not a competitor to PharmEasy/1mg — differentiated by hospital/doctor-linked prescriptions

---

### S.2 Key Actors & Roles

| Role | DB Table | Description |
|------|---------|-------------|
| `pharmacy_admin` | users (new role) | Pharmacy owner/manager — responds to prescription requests, sets delivery policy |
| Patient (existing) | patients | Uploads prescription, selects pharmacy, chooses pickup or delivery |
| Doctor (existing) | doctors | Issues e-prescriptions (P3) that can auto-route to pharmacy |

---

### S.3 Database Schema (P5 — new tables)

#### pharmacies
```
id, slug, name, license_number (Drug License No.),
address, city, state, pin_code, lat, lng,
phone, email, website, owner_name,
working_hours json,
delivery_radius_km integer,        ← max km for own-rider delivery
own_delivery boolean,              ← pharmacy has their own riders
delivery_fee integer,              ← flat fee in paise
free_delivery_above_amount int,    ← 0 = no free delivery threshold
is_verified boolean, is_active boolean,
created_at, updated_at
```
Indexed by: city, pin_code, lat/lng (for nearby search)

#### prescription_requests
```
id, patient_id FK patients,
prescription_upload_url,           ← R2: prescriptions/{patientId}/{uuid}.jpg|pdf
emr_prescription_id nullable,      ← P3 EMR link
notes text nullable,               ← patient's notes (e.g. "need urgent delivery")
status (open|quoted|accepted|fulfilled|cancelled),
selected_pharmacy_id nullable FK pharmacies,
delivery_type nullable (pickup|delivery),
delivery_address json nullable,
created_at, updated_at
```

#### pharmacy_quotes
```
id, request_id FK prescription_requests,
pharmacy_id FK pharmacies,
can_supply boolean,
estimated_price integer nullable,  ← total estimate in paise
ready_by_hours integer nullable,   ← estimated ready in N hours
delivery_fee integer nullable,
notes text nullable,               ← pharmacy's message to patient
status (pending|accepted|rejected|expired),
expires_at,                        ← quote valid for N hours
created_at, updated_at
```

#### prescriptions (structured prescription data — for analytics & future EMR link)
```
id, patient_id FK patients,
request_id nullable FK prescription_requests,
doctor_id nullable FK doctors,     ← if issued by EasyHeals-network doctor
emr_record_id nullable,            ← P3 EMR link
upload_url,                        ← R2 PDF/image (same as request's upload_url)
prescription_date nullable,
valid_until nullable,              ← typically 30-90 days from issue
medicines_raw json nullable,       ← AI-extracted: [{ name, dosage, duration }] — best-effort OCR
is_ai_extracted boolean,           ← true if AI parsed medicines_raw
is_verified boolean,               ← manual pharmacist verification (future)
verified_by nullable FK users,
verification_notes nullable,
retained_until,                    ← retention policy: prescription_date + 2 years
created_at
```
Note: `medicines_raw` is best-effort AI extraction (Gemini OCR). Not used for clinical decisions.
Used for: analytics, future EMR correlation, patient prescription history.

#### delivery_assignments
```
id, request_id FK prescription_requests,
delivery_provider (own|porter|shadowfax),
provider_order_id nullable,        ← external tracking ID
provider_tracking_url nullable,
status (assigned|picked_up|in_transit|out_for_delivery|delivered|failed),
estimated_delivery_at,
actual_delivery_at nullable,
created_at, updated_at
```

---

### S.4 P1-P4 Schema Hooks (add these stubs NOW)

To avoid migration when P5 activates:

```typescript
// leads table — P5 stub
prescriptionRequestId: text("prescription_request_id"),  // FK prescription_requests (P5)

// patients table — P5 stubs
preferredPharmacyId: text("preferred_pharmacy_id"),      // FK pharmacies (P5)

// payment_transactions — already covers pharmacy payments ✅ (entity_type='prescription_request')
// outbox_events — already covers pharmacy events ✅ (new CRM topics below)
// analytics_events — already covers pharmacy analytics ✅
// prescriptions table — stored for 2-year retention, analytics, future EMR correlation ✅
```

**Prescription data retention policy:**
- All uploaded prescription images → R2 `prescriptions/{patientId}/{uuid}` (permanent until patient deletion)
- `prescriptions` table row → retained for `max(2 years from prescription_date, patient account lifetime)`
- Gemini OCR extracts `medicines_raw` async (P5 cron, best-effort) — enables analytics without manual entry
- DPDP Act 2023: prescription images are sensitive health data → consent_record required before upload

---

### S.5 Delivery Partner Architecture

**DeliveryProvider interface** (add to `src/lib/delivery/provider.interface.ts` at P5):

```typescript
export interface DeliveryProvider {
  createShipment(request: PrescriptionRequest): Promise<ShipmentResult>;
  trackShipment(providerOrderId: string): Promise<TrackingStatus>;
  cancelShipment(providerOrderId: string): Promise<void>;
  getServiceability(fromPinCode: string, toPinCode: string): Promise<{ serviceable: boolean; eta: string; fee: number }>;
}
```

**P5 Providers:**
```
src/lib/delivery/
├── provider.interface.ts
├── own.provider.ts          ← pharmacy manages their own riders
├── porter.provider.ts       ← hyperlocal (city, 2-4h, REST API)
├── shadowfax.provider.ts    ← city + tier-2/3 towns (next day)
└── index.ts                 ← factory: picks provider by pharmacy settings + pin_code serviceability
```

**Routing Logic:**
```
Patient in same city as pharmacy:
  → Try OWN delivery (if pharmacy.own_delivery = true) → Porter fallback
Patient in different city / village:
  → Shadowfax (handles tier-2/3 and rural)
  → Check serviceability first — show ETA before patient confirms
Not serviceable by any partner:
  → Show "Available for pickup only" message
```

**PIN code serviceability cache** (Redis):
```
delivery:serviceability:porter:{pinCode}      → { ok: bool, eta: string } (TTL 24h)
delivery:serviceability:shadowfax:{pinCode}   → { ok: bool, eta: string } (TTL 24h)
```

---

### S.6 Patient UX Flow

```
1. Patient taps "Order Medicines" → uploads prescription photo/PDF
2. System finds verified pharmacies within configurable radius (default 10km)
3. Each pharmacy card shows: name, distance, delivery fee, estimated ready time
   (pharmacies respond async — patient notified via app/WhatsApp when quotes arrive)
4. Patient selects a pharmacy
5. Patient selects: Pickup (free) OR Delivery (shows fee)
6. For delivery: enter address → system checks serviceability
7. Patient confirms → prescription_request.status = 'accepted'
8. Pharmacy fulfils → marks as 'fulfilled'
9. If delivery: delivery_assignment created → tracking shown
```

---

### S.7 Regulatory Compliance for P5

| Requirement | Detail | Owner |
|------------|--------|-------|
| Drug License | Each pharmacy must upload license (Form 20/21) | Legal + Ops |
| Prescription retention | Store uploaded prescriptions for 2 years | Tech (R2 storage) |
| State Drug Controller | Verify pharmacy license (manual P5 onboarding) | Ops |

**Non-negotiable P5 Gate:**
- [ ] Drug license verification workflow live (manual review by EasyHeals ops)
- [ ] Prescription retention policy implemented (R2 storage, 2-year TTL)
- [ ] Shadowfax + Porter APIs integrated and tested for city-to-village delivery
- [ ] Pharmacy quote flow end-to-end tested

---

### S.8 CRM Events for Pharmacy (add to CRM event bus topics)

```typescript
// Add to crm/events.ts at P5
| 'pharmacy.prescription_uploaded'
| 'pharmacy.quote_received'
| 'pharmacy.request_accepted'
| 'pharmacy.request_fulfilled'
| 'pharmacy.delivery_dispatched'
| 'pharmacy.delivery_completed'
```

---

### S.9 Feature Flags (P5)

```
pharmacy_onboarding          OFF   // pharmacies can register and set up profile
prescription_ordering        OFF   // patients can upload prescriptions and request quotes
pharmacy_own_delivery        OFF   // pharmacy's own riders
delivery_porter              OFF   // Porter hyperlocal delivery
delivery_shadowfax           OFF   // Shadowfax city-to-village
emr_prescription_link        OFF   // P3 EMR → prescription_request auto-link
pharmacy_analytics           OFF   // pharmacy activity analytics dashboard
```

---

### S.10 Extraction Timeline for P5

| Module | Where | When extracted |
|--------|-------|---------------|
| `src/lib/pharmacy/` | Main monolith | P5 start |
| `src/lib/delivery/` | Main monolith | P5 start |
| Prescription storage | Cloudflare R2 (existing) | Uses existing R2 setup ✅ |

P5 stays in the monolith. Porter/Shadowfax APIs are stateless REST calls — no separate service needed.

---

---

## SECTION V5 — HLD v5 ARCHITECTURAL DECISIONS (2026-03-18)

> These decisions extend/override prior sections. Read before building P4.

### V5.1 Document Storage — OVERRIDE of P2 Decision

**Prior decision (PLAN.md P2 §INT):**
> "Do NOT build separate S3 in Next.js. Proxy to CRM's AWS S3 / Vercel Blob via CRM_INTERNAL_URL."

**OVERRIDDEN.** Reason: Patient document *sharing* requires:
- Per-share expiry (7d / 30d / until revoked)
- Per-share permission (view-only vs download)
- Per-share audit log (who accessed, when, what action)
- Appointment-scoped access gates
- Revocation by patient at any time

CRM's generic `documents` table has none of these. Building on top of it would require patching CRM's data model — cross-service schema coupling, which violates the CRM isolation principle (ARCHITECTURE.md §A.2).

**New decision:** `src/lib/documents/r2.client.ts` — direct Cloudflare R2 integration in Next.js.
- Upload: presigned PUT URL (client uploads directly, no server bandwidth)
- Read: presigned GET URL (time-limited, generated only after share validation)
- Metadata: `patient_documents` table in Turso (not R2)
- Access control: `document_shares` + `document_access_log` in Turso

**No CRM proxy.** CRM's document table remains for CRM's own prescription uploads.

### V5.2 RBAC Expansion — Receptionist Sub-Role

Current system: `users.role` ∈ {owner, admin, advisor, viewer, hospital_admin, doctor, contributor}

**New role added:** `receptionist`
- Created by: `hospital_admin` (not by EasyHeals admin)
- Scoped to: one provider entity (`provider_staff.provider_id`)
- Access: `/portal/appointments`, `/portal/queue` only
- Cannot: edit provider profile, manage subscriptions, view EMR, access admin panel

**Implementation:**
- `provider_staff` table: maps `user_id → provider_id + sub_role`
- `requireProviderAuth()` in `src/lib/auth/provider.ts` — checks session + entity binding
- `ensureProviderRole()` in `src/lib/rbac.ts` — enforces sub-role within provider context
- proxy.ts: `/portal/*` routes validated against `eh_portal_session` cookie (existing)

### V5.3 Provider Auth — Extended

Current: `/portal/login` → password login → `eh_portal_session` cookie → `requireAuth()`
New: Receptionist login uses same flow but their session includes `providerEntityId` + `sub_role: receptionist`

Session payload extended:
```typescript
interface PortalSession {
  userId: string;
  role: string;            // hospital_admin | doctor | receptionist
  entityId: string;        // hospitalId or doctorId
  entityType: string;      // hospital | doctor
  providerStaffId?: string; // set for receptionist/billing sub-users
}
```

### V5.4 Scheduling Engine Design

**Problem:** `appointment_slots` table (P1 schema stub) is manually populated.
Providers need to define working hours → system auto-generates available slots.

**Solution:** Lazy slot generation (NOT pre-generated).
- `provider_schedules` table: `doctorId`, `dayOfWeek` (0-6), `startTime`, `endTime`, `slotDurationMin`, `capacityPerSlot`
- `provider_schedule_blocks`: date-range blocks (leave, holiday, custom break)
- `buildSlotsForDate(doctorId, date)` → computes slots on-demand from config minus booked minus blocked
- Result cached in Redis for 5 min: `slots:{doctorId}:{date}`
- Cache invalidated on: new booking, new block, schedule config change

**Why lazy?** Pre-generating 15-min slots for 6 months × 100 doctors = 1.75M rows. Lazy = zero storage, always consistent.

### V5.5 Phase Renumbering

| Old | New | Content |
|-----|-----|---------|
| P4  | P5  | Referral engine, ABHA/ABDM, Insurance TPA |
| P5  | P6  | Pharmacy prescription routing |
| –   | P4  | Role-Based Portal (patient dashboard, provider portal, documents, RBAC, scheduling) |

### V5.6 New Feature Flags (P4)

```
patient_document_upload     OFF  // R2 upload flow — enable after R2 configured
document_sharing            OFF  // patient → provider shares
provider_self_registration  OFF  // self-serve onboarding
opd_queue                   OFF  // walk-in token queue
provider_staff_mgmt         OFF  // receptionist/billing sub-users
provider_schedule_mgmt      OFF  // working hours + slot config
```

### V5.7 API Surface Additions (P4)

New route groups (full spec in HLD_v5.md §6):
```
/api/v1/patient/documents/**   — upload, list, delete, share, revoke
/api/v1/provider/documents/**  — view shared docs (gated + logged)
/api/v1/provider/appointments/**  — accept, reject, reschedule, complete
/api/v1/provider/schedule/**   — working hours config, slot generation
/api/v1/provider/queue/**      — OPD walk-in token management
/api/v1/provider/staff/**      — sub-user invite + management
/api/v1/provider/register/**   — self-service provider onboarding
/api/admin/patients/**         — patient account oversight
/api/admin/providers/**        — verification + governance
/api/admin/document-audit/**   — privacy audit logs
```

### V5.8 What Was Missing in HLD v4 / PLAN.md

For the record — gaps identified when writing HLD v5:

| Feature | Status in v4 | Resolution |
|---|---|---|
| Patient dashboard (full) | 1-line API stub | Full spec + UI in HLD v5 §2 |
| Document sharing | Absent | New subsystem in V5.1 |
| Document audit log | Absent | `document_access_log` table + V5.1 |
| Provider appt accept/reject | Absent | V5 §3.4 + P4-Day2 |
| Slot/schedule management | Table stub only | V5.4 scheduling engine |
| OPD walk-in queue | Redis SSE stub | `opd_tokens` table + V5 §3.8 |
| Receptionist sub-role | Absent | V5.2 + `provider_staff` table |
| Provider self-registration | Admin-only assumed | V5 §5 + feature-flagged |
| Provider subscription UI | Payment API only | V5 §3.10 + P4-Day12 |
| Admin: patient management | Absent | V5 §4.2 + P4-Day14 |
| Admin: provider verification | Absent | V5 §4.3 + P4-Day14 |
| Admin: doc audit tab | Absent | V5 §4.4 + P4-Day15 |
| Admin: appointment oversight | Absent | V5 §4.5 + P4-Day15 |
| Video room + patient doc panel | Room only | V5 §3.6 + P4-Day3 |

---

_Last updated: 2026-03-18 (HLD v5) | Review before starting P4_

---

## SECTION V6 — HLD v6 ARCHITECTURAL DECISIONS (2026-03-19)

> Read before starting P5. Extends/overrides prior sections. Full feature list: PLAN.md §P5.

### V6.1 Document Storage — OVERRIDE of V5.1 (R2 → Vercel Blob)

**V5 decision:** Use Cloudflare R2 via `src/lib/documents/r2.client.ts`.

**OVERRIDDEN.** Reason: Vercel Blob is already in use for other uploads, has zero-config SDK,
native Vercel integration (no extra credentials beyond BLOB_READ_WRITE_TOKEN), and free tier
covers P5 volume. R2 adds R2_ACCOUNT_ID + R2_ACCESS_KEY + R2_SECRET_KEY + R2_BUCKET env vars
with no meaningful advantage at P5 scale.

**New decision:** `src/lib/documents/blob.client.ts` — Vercel Blob via `@vercel/blob`.
- `upload(file, metadata)` → returns Blob URL
- `delete(url)` → removes from Blob store
- URLs are public-readable by default; sensitive documents protected by short-lived share tokens
  stored in `document_shares` table (not by URL obscurity)

### V6.2 PHI Encryption Key Separation

Two separate AES-256-GCM encryption keys:
- `ENCRYPTION_KEY` (existing) — encrypts patient phone numbers in `patients.phoneEncrypted`
- `HEALTH_PHI_ENCRYPTION_KEY` (NEW) — encrypts health memory events + AI conversations + pre-visit briefs

Why separate? Key rotation for health data (stricter retention rules) must not affect phone encryption.
Each key independently rotatable. Both 32-byte hex. Stored as Vercel env secrets.

**Modules:**
- `src/lib/security/encryption.ts` — existing: phone encryption (ENCRYPTION_KEY)
- `src/lib/health/encryption.ts` — NEW: health PHI encryption (HEALTH_PHI_ENCRYPTION_KEY)

Never cross-import. Never log either key or any encrypted value.

### V6.3 Health Context is Never Cached

`buildHealthContext(patientId)` — the Gemini system prompt containing decrypted health memory —
MUST be built fresh on every Health Coach request. Never stored in Redis. Never logged.
The only persistent form of health data is `health_memory_events.data_encrypted` (AES-GCM ciphertext).

Rationale: Caching decrypted PHI in Redis (even with TTL) expands the attack surface. The
performance cost of per-request context build (~200 events, indexed query) is acceptable.

### V6.4 Async Document Extraction Pattern

Gemini Vision extraction cannot run synchronously inside the document upload route (Vercel 10s limit).
Pattern: fire-and-forget self-fetch to `/api/internal/extract-document`.

```
POST /api/v1/patients/documents (upload route)
  → 1. Upload to Vercel Blob (fast, <2s)
  → 2. INSERT health_documents (ai_status='pending')
  → 3. fetch('/api/internal/extract-document', { body: { documentId } }) ← NO AWAIT
  → 4. Return 201 immediately with { documentId, ai_status: 'pending' }

POST /api/internal/extract-document (internal, no auth — only callable from within Vercel)
  → 1. Fetch blob URL
  → 2. Gemini Vision extraction (up to 60s allowed for internal routes)
  → 3. writeMemoryEvents(patientId, 'document', events[])
  → 4. UPDATE health_documents SET ai_status='done'
```

INTERNAL_API_KEY header required on `/api/internal/*` routes (same pattern as CRM internal routes).

### V6.5 ABHA Integration Approach

ABDM (Ayushman Bharat Digital Mission) sandbox API used for P5.
- Endpoint: `https://sandbox.abdm.gov.in/api/v3/`
- Auth: client_credentials flow → ABDM_CLIENT_ID + ABDM_CLIENT_SECRET
- Health records pulled in FHIR R4 format → normalized to `health_memory_events` via memory-writer.ts
- Consent gate: `abha_link` purpose required (patient explicitly authorizes ABDM pull)
- ABHA ID stored in `patients.abhaId` (already stubbed in schema)
- Feature flag: `abha_integration` OFF by default

### V6.6 i18n Strategy Decision

**P5 approach**: Cookie-based locale (no URL prefix). Simpler to implement, works with App Router.
- `NEXT_LOCALE` cookie set by LanguageSwitcher
- `next-intl` middleware reads cookie → provides locale to server components
- Patient session `preferredLang` kept in sync (persisted across devices)

**P6 upgrade**: Add URL prefix (`/hi/*`, `/ta/*`) for SEO — Hindi/regional language content
indexed separately by Google. Requires redirect middleware update.

**Admin UI**: Always English, no i18n applied (internal tool). Locale detection bypassed for `/admin/*`.

### V6.7 Feature Flag Additions (P5)

Add to `feature_flags` seeder:

| Key | Default | Description |
|-----|---------|-------------|
| `health_memory` | false | health_documents + health_memory_events active |
| `ai_health_coach` | false | /dashboard/health-coach + SSE endpoint |
| `previsit_brief` | false | Doctor-side brief generation cron |
| `document_sharing` | false | Patient→provider document shares |
| `abha_integration` | false | ABDM sandbox health ID linking |
| `provider_self_registration` | false | 4-step self-serve provider onboarding |
| `i18n_hindi` | false | Hindi UI strings active (next-intl) |
| `rewards_page` | false | /dashboard/rewards full gamification page |
| `slot_auto_generation` | false | On-demand slot generation from schedule config |

### V6.8 P5 Missing Features Reconciliation

The following items were planned in earlier phases but not built. P5 is the resolution phase:

| Was in | Feature | Resolution in P5 |
|--------|---------|-----------------|
| P1 Task 3.11 | `/dashboard/privacy` right-to-erasure UI | P5 W2-9 |
| P2 deferred | `/dashboard/rewards` gamification page | P5 W4-14 |
| P2 Arch §N | i18n / Hindi translation | P5 W4 W4-1 to W4-7 |
| P4c Day 7 | Document upload UI + Blob (CRM proxy was stub) | P5 W1-9 |
| P4c Day 8-9 | Document sharing flow + provider viewer | P5 W2-1 to W2-4 |
| P4b Day 4 | Full `/book/[providerId]` 4-step booking | P5 W4-11 |
| P4b Day 6 | Slot auto-generation from schedule config | P5 W4-12 |
| P4e Day 13-15 | Provider self-registration + admin tabs | P5 W4-8 to W4-13 |
| Old P5 | ABHA/ABDM health ID linking | P5 W2-8 |
| Old P5 | Referral engine | → P6 Care Navigation Engine |
| Old P5 | Insurance TPA | → P6 cost estimation in Care Navigation |
| Old P6 | Pharmacy routing | → P7 Lab/Pharmacy Integration |

_Last updated: 2026-03-19 (HLD v6) | Review before starting P5_
