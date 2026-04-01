# P5 Detailed Design Document
## EasyHeals — AI Health Memory + Document Intelligence + Adaptive AI

**Version:** 1.0
**Date:** 2026-03-31
**Status:** Design Complete — Ready for Implementation
**Preceding phases:** P1 (Auth/Search) ✅ P2 (Appointments) ✅ P3 (EMR) ✅ P4 (Portals) ✅

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Design Principles](#2-design-principles)
3. [Session Architecture — Smooth Transitions](#3-session-architecture--smooth-transitions)
4. [Plugin / Plug-out Module Architecture](#4-plugin--plug-out-module-architecture)
5. [Database Schema](#5-database-schema)
6. [AI Learning Architecture — RAG + Adaptive Memory](#6-ai-learning-architecture--rag--adaptive-memory)
7. [Feature Designs — UX + Technical](#7-feature-designs--ux--technical)
   - F1: Document Upload & OCR
   - F2: Health Memory Timeline
   - F3: AI Health Coach (Adaptive)
   - F4: Pre-Visit Brief
   - F5: Document Sharing
   - F6: ABHA Health ID
   - F7: Privacy & Consent Dashboard
   - F8: Full Booking Flow V2
   - F9: Gamification Rewards
8. [Navigation & Mobile Shell](#8-navigation--mobile-shell)
9. [API Reference](#9-api-reference)
10. [Environment Variables](#10-environment-variables)
11. [Implementation Phases — Week by Week](#11-implementation-phases--week-by-week)
12. [Open Decisions](#12-open-decisions)

---

## 1. Vision & Goals

### Platform Vision
Transform EasyHeals from a hospital discovery tool into a **lifelong AI health companion** — a system that knows the patient's full health history, learns from every interaction, and gets progressively more useful over time.

### P5 Core Goals
| Goal | Metric |
|------|--------|
| Patients can upload and understand their medical documents | OCR accuracy ≥ 90% on printed lab reports |
| AI Health Coach answers get better with each conversation | Profile confidence score increases measurably per session |
| Doctors receive a useful patient summary before appointments | Pre-visit brief generated ≥ 30 min before appointment |
| AI learns patient preferences, not just stores data | Communication style adapted within 3 sessions |
| All features independently deployable | Any feature flag OFF causes zero runtime errors |

### What Makes This Different
Standard LLM chatbots start from scratch every session. EasyHeals AI builds a **growing patient model** — the more a patient uses it, the more personalized and clinically relevant the responses become. This is achieved through:
- **RAG (Retrieval Augmented Generation)** — retrieve relevant past context before every response
- **Accumulated embeddings** — every health event, document, and conversation is vectorized and stored
- **Behavioral feedback loops** — implicit signals (did they book an appointment?) teach the AI what works
- **Profile synthesis** — background AI job synthesizes a patient model from accumulated data

---

## 2. Design Principles

### 2.1 Plug-in / Plug-out (Most Critical)
Every P5 feature is a **self-contained capsule** that can be:
- Turned ON/OFF via a single feature flag in the DB
- Deployed or rolled back independently
- Tested in isolation without affecting other features
- Removed completely without leaving orphaned code paths

**Rule:** If `feature_flags['health_coach']` is `false`, the chat button does not render, the API route returns `{ error: "Feature not available", code: "FEATURE_DISABLED", status: 423 }`, and no DB queries are attempted. Zero fallout.

### 2.2 Mobile-First
Every screen is designed at **375px viewport first**. Desktop is an enhancement.
- Bottom sheets instead of centered modals
- Floating Action Buttons in thumb zone (bottom-right)
- Swipe gestures for navigation
- Camera capture for document upload
- Voice input for chat and booking notes
- Touch targets minimum 44×44px

### 2.3 Future Tech Compatibility
- **FHIR R4-aligned** data model — schema fields map 1:1 to FHIR resources
- **LOINC codes** for all lab observations and vitals
- **ICD-10 codes** for diagnoses
- **SNOMED CT** for procedures
- **ABDM-compatible** health record format for ABHA integration
- **HL7 v2 import** stub — fields exist even if import pipeline is P6
- React Native ready — all components use RN-compatible patterns (no DOM-specific APIs in shared logic)

### 2.4 Privacy by Design
- All health content (document text, conversation turns, health events): **AES-256-GCM encrypted at rest**
- Embedding vectors (F32_BLOB) are NOT encrypted — mathematical vectors are not interpretable as text
- No health data in logs, ever (phiSafeChanges pattern extended to all P5 routes)
- Every P5 feature requires explicit patient consent before activation
- Retention: medical records 7 years, AI conversations 1 year, embeddings 2 years

### 2.5 Adaptive AI (Learn Over Time)
The AI is not static. It builds a richer model of each patient through:
1. **Within-patient learning** — every interaction enriches the patient's AI profile
2. **Outcome learning** — implicit signals (appointment booked, doc uploaded after AI suggestion) teach what advice works
3. **System-level learning** — anonymized cross-patient patterns improve default responses for new patients
4. **Explicit feedback** — thumbs up/down directly shapes future response style

---

## 3. Session Architecture — Smooth Transitions

### 3.1 Problem
Current implementation: fixed-TTL session. Expiry → middleware redirects to `/login` → patient loses all context, chat draft, scroll position. For the AI Health Coach, losing a conversation mid-session is a critical UX failure.

### 3.2 Sliding Window Sessions

**DB Change:**
```sql
ALTER TABLE sessions ADD COLUMN last_active_at TIMESTAMP;
ALTER TABLE sessions ADD COLUMN extended_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN max_ttl_hours INTEGER DEFAULT 168; -- 7 days
```

**Server behavior:**
- `requireAuth()` updated to: on each valid request, extend `expires_at` by +24h (up to max 7 days from `last_active_at`)
- Idle sessions (no requests for 24h) expire naturally
- `extended_count` tracks how many times session was extended (analytics, abuse detection)

### 3.3 Client-Side Session Monitor

New hook `useSessionHealth()`:
```typescript
// Polls /api/v1/auth/session-status every 4 minutes
// Returns: { expiresAt, minutesRemaining, isExpiring, isExpired }
// When minutesRemaining < 10: show "Session expiring" banner
// When expired: show re-auth modal (NO page redirect)
```

**New API:** `GET /api/v1/auth/session-status`
```json
{ "valid": true, "expiresAt": "2026-04-01T10:00:00Z", "minutesRemaining": 1380 }
```

### 3.4 Re-Auth Modal (Not Redirect)

When session expires:
1. **Blurred overlay** appears over current content — patient can see what they had
2. Modal: "Your session expired. Enter your OTP to continue."
3. OTP sent to phone automatically
4. On success: modal closes, patient is exactly where they were
5. No page reload — React state preserved, chat conversation intact

**State Preservation:**
```typescript
// Before any auth redirect (fallback only):
sessionStorage.setItem('easyheals:return', JSON.stringify({
  pathname: window.location.pathname,
  scrollY: window.scrollY,
  timestamp: Date.now()
}))

// Health Coach specific:
localStorage.setItem('easyheals:chat:draft', currentMessage)
localStorage.setItem('easyheals:chat:history', JSON.stringify(last20Turns))
```

### 3.5 Cross-Tab Session Sync

```typescript
const channel = new BroadcastChannel('easyheals-session')

// On login: broadcast to all tabs
channel.postMessage({ type: 'SESSION_CREATED' })

// On logout: all tabs show re-auth modal simultaneously
channel.postMessage({ type: 'SESSION_EXPIRED' })

// No health data ever passes through BroadcastChannel — only session state signals
```

### 3.6 Session UX States

| State | UX |
|-------|-----|
| Active (>60 min remaining) | Normal UI, no indication |
| Expiring (10–60 min) | Subtle amber dot on profile avatar |
| Critical (<10 min) | "Stay logged in?" banner (dismissible, 1 click extends) |
| Expired | Blurred overlay + re-auth modal |
| Network lost | "You're offline" banner, chat queued for retry |

---

## 4. Plugin / Plug-out Module Architecture

### 4.1 Feature Flag Keys (extend existing system)

```typescript
// Add to feature_flags table seeds:
'health_documents'    // Document upload + OCR pipeline
'health_timeline'     // Health Memory Timeline view
'health_coach'        // AI Health Coach chat
'previsit_brief'      // Pre-visit brief for doctors
'doc_sharing'         // Share documents with providers
'abha_integration'    // ABHA Health ID linking
'ai_learning'         // RAG + profile synthesis (can disable independently)
'booking_v2'          // Full booking flow (/book/[id])
'gamification_ui'     // Rewards page
'session_sliding'     // Sliding window sessions
```

### 4.2 Capsule File Structure

```
src/
  features/
    health-documents/
      components/
        DocumentUploader.tsx       ← Mobile-first camera + file input
        DocumentCard.tsx           ← Compact list item
        OcrReviewSheet.tsx         ← Bottom sheet: confirm extracted events
        DocumentDetailSheet.tsx    ← Full document detail + events
      api/
        upload.ts                  ← POST handler
        list.ts                    ← GET handler
        reprocess.ts               ← Re-run OCR
      hooks/
        useDocuments.ts
        useOcrStatus.ts
      schema.ts                    ← health_documents Drizzle table
      migrations/
        0020_health_documents.sql
      flag.ts                      ← export const FLAG = 'health_documents'

    health-timeline/
      components/
        HealthTimeline.tsx
        TimelineEventCard.tsx
        TimelineFilters.tsx
        ManualEventForm.tsx
      api/
        events.ts
        export.ts
      hooks/
        useTimeline.ts
      schema.ts                    ← health_memory_events Drizzle table
      migrations/
        0021_health_timeline.sql
      flag.ts

    health-coach/
      components/
        CoachEntryButton.tsx       ← Floating button, bottom-right
        CoachDrawer.tsx            ← Full-screen mobile, right panel desktop
        ChatBubble.tsx
        ContextChips.tsx           ← "Explain my last lab" quick prompts
        LanguageSwitch.tsx
      api/
        chat.ts                    ← SSE streaming
        history.ts
      hooks/
        useHealthCoach.ts
        useSessionHealth.ts        ← Re-auth modal trigger
      lib/
        context-assembler.ts       ← buildHealthCoachContext()
        rag-retriever.ts           ← Vector search + context injection
        profile-synthesizer.ts     ← Nightly patient profile synthesis
      schema.ts                    ← ai_conversations, ai_embeddings, ai_patient_profiles
      migrations/
        0022_ai_learning.sql
      flag.ts

    previsit-brief/
      components/
        BriefPanel.tsx             ← Doctor portal side panel
        ConsentToggle.tsx          ← Patient consent for brief sharing
      api/
        generate.ts                ← Cron-triggered generation
        deliver.ts                 ← Push to doctor portal
      schema.ts                    ← previsit_briefs
      migrations/
        0023_previsit_brief.sql
      flag.ts

    document-sharing/
      components/
        ShareDocumentSheet.tsx
        ActiveSharesCard.tsx
      api/
        share.ts
        revoke.ts
        access.ts                  ← Provider access endpoint
      schema.ts                    ← document_shares, document_access_log
      migrations/
        0024_document_sharing.sql
      flag.ts

    abha-integration/
      components/
        AbhaLinkCard.tsx
        AbhaSyncStatus.tsx
      api/
        oauth.ts                   ← ABDM OAuth initiation
        callback.ts
        sync.ts                    ← Fetch linked records
      flag.ts                      ← Off by default until ABDM credentials ready

    booking-v2/
      components/
        BookingFlow.tsx            ← 4-step wizard
        DoctorSelector.tsx
        DateTimePicker.tsx
        PatientDetailsStep.tsx
        BookingConfirmation.tsx
      api/
        availability.ts
        confirm.ts
      flag.ts

    gamification/
      components/
        RewardsPage.tsx
        PointsCard.tsx
        Leaderboard.tsx
        StreakCard.tsx
      api/
        balance.ts
        leaderboard.ts
        checkin.ts
      flag.ts
```

### 4.3 Feature Guard Pattern

Every API route in a capsule starts with:
```typescript
import { requireFeatureFlag } from '@/lib/config/feature-flags'

export async function POST(req: NextRequest) {
  const flagCheck = await requireFeatureFlag('health_documents')
  if (flagCheck) return flagCheck  // Returns 423 with FEATURE_DISABLED

  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  // ...
}
```

Every UI component that wraps a feature:
```tsx
<FeatureGate flag="health_coach" fallback={<ComingSoonCard feature="AI Health Coach" />}>
  <CoachEntryButton />
</FeatureGate>
```

---

## 5. Database Schema

### 5.1 `health_documents`

```sql
CREATE TABLE health_documents (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  patient_id          TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_name           TEXT NOT NULL,
  mime_type           TEXT NOT NULL,                  -- 'application/pdf', 'image/jpeg', 'image/png'
  storage_url_enc     TEXT NOT NULL,                  -- AES-256-GCM encrypted Vercel Blob URL
  file_size_bytes     INTEGER,
  document_type       TEXT NOT NULL DEFAULT 'other',
    -- 'prescription' | 'lab_report' | 'discharge_summary' | 'scan_report'
    -- 'vaccination' | 'insurance' | 'other'
  document_date       TEXT,                           -- Date on the document (ISO 8601)
  ocr_status          TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
  ocr_model           TEXT,                           -- 'gemini-2.5-flash-vision'
  ocr_started_at      INTEGER,                        -- timestamp_ms
  ocr_completed_at    INTEGER,
  extracted_data_enc  TEXT,                           -- AES encrypted JSON of Gemini Vision output
  event_count         INTEGER DEFAULT 0,              -- number of health_memory_events created
  is_confirmed        INTEGER NOT NULL DEFAULT 0,     -- 1 = patient confirmed extracted events
  is_deleted          INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_health_docs_patient ON health_documents(patient_id, created_at DESC);
CREATE INDEX idx_health_docs_ocr ON health_documents(ocr_status) WHERE is_deleted = 0;
```

### 5.2 `health_memory_events`

FHIR R4-aligned. Maps to FHIR Observation, Condition, MedicationStatement, Immunization resources.

```sql
CREATE TABLE health_memory_events (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  patient_id            TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Classification
  event_type            TEXT NOT NULL,
    -- 'diagnosis' | 'medication' | 'lab_result' | 'vital_sign' | 'procedure'
    -- 'vaccination' | 'allergy' | 'observation' | 'note'
  event_date            TEXT,                         -- ISO 8601 date of the event
  event_end_date        TEXT,                         -- For ongoing conditions

  -- Source tracking
  source                TEXT NOT NULL DEFAULT 'manual',
    -- 'uploaded_document' | 'abha' | 'wearable' | 'manual' | 'provider' | 'ai_inferred'
  source_document_id    TEXT REFERENCES health_documents(id),
  source_appointment_id TEXT REFERENCES appointments(id),

  -- FHIR-aligned identifiers
  loinc_code            TEXT,                         -- e.g. "718-7" for Hemoglobin
  icd10_code            TEXT,                         -- e.g. "E11.9" for Type 2 Diabetes
  snomed_code           TEXT,                         -- e.g. "27658006" for Amoxicillin

  -- Human-readable display
  display_name          TEXT NOT NULL,                -- "Hemoglobin", "Type 2 Diabetes"
  display_category      TEXT,                         -- "Blood Test", "Chronic Condition"

  -- Value (for measurements)
  value_quantity        REAL,                         -- Numeric: 8.2
  value_unit            TEXT,                         -- "g/dL", "mmHg", "mg/dL", "%"
  value_text_enc        TEXT,                         -- AES encrypted: qualitative text value
  reference_range_low   REAL,
  reference_range_high  REAL,
  is_abnormal           INTEGER DEFAULT 0,            -- 1 = outside reference range

  -- Status
  status                TEXT DEFAULT 'active',
    -- 'active' | 'resolved' | 'inactive' | 'entered_in_error'
  severity              TEXT,                         -- 'mild' | 'moderate' | 'severe' (for conditions)
  is_confirmed          INTEGER NOT NULL DEFAULT 0,   -- 1 = patient confirmed
  is_deleted            INTEGER NOT NULL DEFAULT 0,

  -- Encrypted details
  notes_enc             TEXT,                         -- AES encrypted free-text notes

  created_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_hme_patient_date ON health_memory_events(patient_id, event_date DESC);
CREATE INDEX idx_hme_type ON health_memory_events(patient_id, event_type);
CREATE INDEX idx_hme_source ON health_memory_events(source_document_id);
CREATE INDEX idx_hme_abnormal ON health_memory_events(patient_id, is_abnormal) WHERE is_abnormal = 1;
```

### 5.3 `ai_conversations`

```sql
CREATE TABLE ai_conversations (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  is_active       INTEGER NOT NULL DEFAULT 1,
  language_code   TEXT NOT NULL DEFAULT 'en',         -- 'en' | 'hi' | 'mr' | 'ta' | 'te'
  title_enc       TEXT,                               -- AES encrypted: AI-generated title after 2+ turns
  context_snapshot_hash TEXT,                         -- SHA-256 of health context at conversation start
  turn_count      INTEGER NOT NULL DEFAULT 0,
  token_count_total INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE ai_conversation_turns (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id     TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  patient_id          TEXT NOT NULL,
  role                TEXT NOT NULL,                  -- 'user' | 'assistant'
  content_enc         TEXT NOT NULL,                  -- AES-256-GCM encrypted message
  token_count         INTEGER,
  model_id            TEXT,                           -- 'gemini-2.5-flash'
  latency_ms          INTEGER,                        -- response generation time
  created_at          INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_convs_patient ON ai_conversations(patient_id, created_at DESC);
CREATE INDEX idx_turns_conv ON ai_conversation_turns(conversation_id, created_at ASC);
```

### 5.4 `ai_embeddings` — Core Vector Store

```sql
CREATE TABLE ai_embeddings (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  patient_id      TEXT,                               -- NULL for system knowledge base entries
  source_type     TEXT NOT NULL,
    -- 'health_event' | 'conversation_turn' | 'document_summary' | 'knowledge_article' | 'patient_profile'
  source_id       TEXT,                               -- FK to originating row
  content_text_enc TEXT NOT NULL,                     -- AES encrypted: the text that was embedded
  embedding       F32_BLOB(768),                      -- Gemini text-embedding-004 output
  specialty_tags  TEXT,                               -- JSON array: ["cardiology","diabetes"]
  language_code   TEXT DEFAULT 'en',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  -- Usage tracking for learning
  retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved_at INTEGER
);

-- Turso vector index for cosine similarity search
CREATE INDEX idx_embeddings_patient ON ai_embeddings(patient_id, source_type);
CREATE INDEX idx_embeddings_system ON ai_embeddings(source_type) WHERE patient_id IS NULL;
```

### 5.5 `ai_patient_profiles` — Learned Patient Model

```sql
CREATE TABLE ai_patient_profiles (
  patient_id                TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,

  -- Learned communication preferences
  communication_style       TEXT,
    -- 'detailed' | 'brief' | 'technical' | 'simple' | NULL (not yet learned)
  preferred_response_format TEXT DEFAULT 'conversational',
    -- 'bullet' | 'paragraph' | 'conversational'
  preferred_language        TEXT DEFAULT 'en',

  -- Learned health model (all AES encrypted JSON)
  health_goals_enc          TEXT,                     -- ["manage diabetes", "lose weight", "track BP"]
  known_concerns_enc        TEXT,                     -- recurring topics detected across sessions
  active_conditions_enc     TEXT,                     -- synthesized from health events
  current_medications_enc   TEXT,                     -- synthesized from documents
  risk_factors_enc          TEXT,                     -- AI-inferred from health data

  -- Learning metrics
  interaction_count         INTEGER NOT NULL DEFAULT 0,
  conversation_count        INTEGER NOT NULL DEFAULT 0,
  document_count            INTEGER NOT NULL DEFAULT 0,
  profile_confidence        REAL NOT NULL DEFAULT 0.0, -- 0.0 → 1.0, grows with interactions
    -- <0.3: barely known  0.3-0.6: learning  0.6-0.8: good model  >0.8: highly personalized

  last_synthesized_at       INTEGER,                  -- last time background job ran
  synthesis_version         INTEGER NOT NULL DEFAULT 0,
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

### 5.6 `ai_response_feedback` — Learning Signal Store

```sql
CREATE TABLE ai_response_feedback (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_turn_id  TEXT NOT NULL REFERENCES ai_conversation_turns(id),
  patient_id            TEXT NOT NULL,

  -- Explicit feedback
  explicit_rating       TEXT,                         -- 'thumbs_up' | 'thumbs_down' | NULL

  -- Implicit behavioral signals (most valuable)
  implicit_signal       TEXT,
    -- 'appointment_booked'    ← patient booked after this AI turn
    -- 'document_uploaded'     ← patient uploaded doc after AI suggestion
    -- 'dismissed_quickly'     ← patient closed within 5 seconds (negative)
    -- 'reread'                ← patient scrolled back to this response
    -- 'shared'                ← patient shared this response
    -- 'question_followup'     ← patient asked a clarifying question (neutral/engaged)

  -- Context for learning
  response_length_chars INTEGER,
  response_format       TEXT,                         -- 'bullet' | 'paragraph' | 'conversational'
  topic_tags            TEXT,                         -- JSON: ["diabetes","medication"]
  led_to_action         INTEGER NOT NULL DEFAULT 0,   -- 1 if implicit_signal is a positive action

  created_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_feedback_patient ON ai_response_feedback(patient_id, created_at DESC);
CREATE INDEX idx_feedback_positive ON ai_response_feedback(led_to_action, topic_tags);
```

### 5.7 `ai_knowledge_base` — Seeded + Learned Medical Knowledge

```sql
CREATE TABLE ai_knowledge_base (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  topic                   TEXT NOT NULL,              -- "HbA1c interpretation", "Metformin side effects"
  content_enc             TEXT NOT NULL,              -- AES encrypted article content
  source_type             TEXT NOT NULL DEFAULT 'seeded',
    -- 'seeded' | 'learned' | 'guideline' | 'drug_info'
  source_url              TEXT,
  specialty_tags          TEXT,                       -- JSON: ["endocrinology", "diabetes"]
  language_code           TEXT DEFAULT 'en',
  embedding               F32_BLOB(768),

  -- Learning metrics
  usage_count             INTEGER NOT NULL DEFAULT 0,
  positive_feedback_count INTEGER NOT NULL DEFAULT 0,
  negative_feedback_count INTEGER NOT NULL DEFAULT 0,
  relevance_score         REAL NOT NULL DEFAULT 0.5,  -- updated by usage signals

  is_active               INTEGER NOT NULL DEFAULT 1,
  created_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_updated            INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

### 5.8 `document_shares`

```sql
CREATE TABLE document_shares (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id             TEXT NOT NULL REFERENCES health_documents(id),
  shared_by_patient_id    TEXT NOT NULL REFERENCES patients(id),
  shared_with_type        TEXT NOT NULL,              -- 'hospital' | 'doctor'
  shared_with_id          TEXT NOT NULL,              -- hospital_id or doctor_id
  shared_with_name        TEXT NOT NULL,              -- display name
  expires_at              INTEGER NOT NULL,           -- timestamp_ms
  access_token_hash       TEXT NOT NULL UNIQUE,       -- SHA-256 of one-time token
  access_count            INTEGER NOT NULL DEFAULT 0,
  last_accessed_at        INTEGER,
  is_revoked              INTEGER NOT NULL DEFAULT 0,
  created_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE document_access_log (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  share_id        TEXT NOT NULL REFERENCES document_shares(id),
  accessed_by     TEXT,                               -- provider user ID
  ip_hash         TEXT,
  accessed_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

### 5.9 `previsit_briefs`

```sql
CREATE TABLE previsit_briefs (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  appointment_id          TEXT NOT NULL REFERENCES appointments(id),
  patient_id              TEXT NOT NULL REFERENCES patients(id),
  provider_id             TEXT NOT NULL,              -- doctor_id or hospital_id
  patient_consent_granted INTEGER NOT NULL DEFAULT 0, -- MUST be 1 before generation
  brief_content_enc       TEXT,                       -- AES encrypted Gemini-generated brief
  generation_status       TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'generating' | 'ready' | 'failed' | 'no_consent'
  generated_at            INTEGER,
  delivered_at            INTEGER,
  doctor_viewed_at        INTEGER,
  doctor_notes_enc        TEXT,                       -- Doctor's pre-visit notes (encrypted)
  created_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

### 5.10 Session Table Additions

```sql
ALTER TABLE sessions ADD COLUMN last_active_at INTEGER;
ALTER TABLE sessions ADD COLUMN extended_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN max_ttl_hours INTEGER NOT NULL DEFAULT 168;
```

---

## 6. AI Learning Architecture — RAG + Adaptive Memory

### 6.1 Three Learning Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Patient Memory (Personal)                              │
│  → health_memory_events (FHIR-aligned)                          │
│  → ai_conversation_turns (encrypted)                            │
│  → ai_patient_profiles (synthesized model)                      │
│  Gets richer every interaction. 100% patient-specific.           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Outcome Signals (Behavioral)                           │
│  → ai_response_feedback (explicit + implicit)                   │
│  → Implicit: appointment_booked, document_uploaded, dismissed   │
│  Teaches AI what advice actually produces real-world actions.    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: System Knowledge (Medical)                             │
│  → ai_knowledge_base (seeded + learned)                         │
│  → Anonymized cross-patient behavioral patterns                  │
│  Benefits new patients from day one. No PII ever.               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Embedding Infrastructure

**Model:** Gemini `text-embedding-004` (768 dimensions, 2048 token input)

**`embedAsync()` helper — core utility:**
```typescript
// src/lib/ai/embeddings.ts
async function embedAsync(params: {
  text: string
  patientId: string | null
  sourceType: EmbeddingSourceType
  sourceId: string
  specialtyTags?: string[]
  languageCode?: string
}): Promise<void>
// Encrypts text → calls Gemini embedding API → stores in ai_embeddings
// Always async/background — never blocks user-facing requests
// Deduplicates by content hash to avoid duplicate vectors
```

**`vectorSearch()` helper — retrieval:**
```typescript
async function vectorSearch(params: {
  queryEmbedding: number[]       // 768-dim vector of the query
  patientId: string | null
  sourceTypes: EmbeddingSourceType[]
  topK: number
  specialtyFilter?: string
}): Promise<EmbeddingSearchResult[]>
// Uses Turso vector_top_k() for cosine similarity search
// Returns decrypted content_text for context injection
```

### 6.3 RAG Query Pipeline — Per Health Coach Message

```
Patient sends: "Why am I always feeling tired?"
                        │
                        ▼
            1. EMBED QUERY (768-dim vector)
               embedQuery("Why am I always feeling tired?")
                        │
                        ▼
            2. PARALLEL VECTOR SEARCHES
               ┌─────────────────────────────────────────┐
               │ a. Patient health events (top 5)        │
               │    → Hemoglobin 8.2 (Feb), Iron def.   │
               │    → Hypothyroid (Mar), Ferritin low   │
               ├─────────────────────────────────────────┤
               │ b. Patient conversations (top 3)        │
               │    → "last month you mentioned fatigue" │
               │    → "you asked about anemia before"   │
               ├─────────────────────────────────────────┤
               │ c. Knowledge base (top 3)               │
               │    → "Iron deficiency & fatigue"        │
               │    → "Hypothyroidism symptoms"          │
               └─────────────────────────────────────────┘
                        │
                        ▼
            3. LOAD PATIENT PROFILE
               communication_style: 'brief'
               known_concerns: ["fatigue", "anemia"]
               health_goals: ["increase energy levels"]
               profile_confidence: 0.72 (high)
                        │
                        ▼
            4. ASSEMBLE DYNAMIC SYSTEM PROMPT
               "You are the patient's personal health coach.
                Patient profile: [profile]
                Recent relevant health data: [RAG results]
                Past relevant conversations: [RAG results]
                Medical context: [knowledge base]
                Respond in: brief bullet style (learned preference)
                Language: English"
                        │
                        ▼
            5. GENERATE (Gemini 2.5 Flash — SSE streaming)
               Response references their actual data:
               "Your Feb lab showed low Hemoglobin (8.2 g/dL)
                and your March thyroid test showed borderline
                hypothyroidism — both commonly cause fatigue.
                These three steps can help: ..."
                        │
                        ▼
            6. POST-RESPONSE (async, non-blocking)
               → Embed the response turn
               → Increment knowledge_base usage_count
               → Update patient interaction_count
               → Check: did patient book appointment within 4h? (feedback signal)
```

### 6.4 Profile Synthesis — Nightly Background Job

Runs every night for all patients who had interactions in the last 7 days.

```typescript
async function synthesizePatientProfile(patientId: string): Promise<void> {
  // 1. Load: all health events (last 90 days), last 50 conversation turns,
  //          all feedback signals (last 30 days)
  // 2. Build synthesis prompt (decrypted data, never logged)
  // 3. Call Gemini:
  //    "Based on this patient's health data and conversations:
  //     1. What are their likely health goals?
  //     2. What recurring concerns do they have?
  //     3. What communication style do they prefer? (brief/detailed/technical/simple)
  //     4. What response format worked best for them?
  //     5. List current active conditions and medications.
  //     Return JSON: { health_goals, known_concerns, communication_style, ... }"
  // 4. Update ai_patient_profiles (encrypted)
  // 5. Update profile_confidence:
  //    confidence = min(1.0, 0.1 + (interactions * 0.05) + (positive_signals * 0.1))
}
```

**Profile confidence meaning:**
| Score | Meaning | AI Behavior |
|-------|---------|-------------|
| 0.0 – 0.2 | First sessions | Generic responses, asks clarifying questions |
| 0.2 – 0.4 | Learning phase | Starts referencing their documents |
| 0.4 – 0.6 | Developing model | Adapts tone, remembers concerns |
| 0.6 – 0.8 | Good model | Proactively connects dots across health data |
| 0.8 – 1.0 | High fidelity | Feels like a personal doctor who knows you |

### 6.5 System-Level Learning (Anonymized)

Weekly background job — **no PII ever leaves this process**:

```typescript
async function learnSystemPatterns(): Promise<void> {
  // 1. Fetch all positive feedback signals (last 7 days)
  //    SELECT topic_tags, response_format, response_length_chars, implicit_signal
  //    FROM ai_response_feedback WHERE led_to_action = 1

  // 2. Cluster by: health_topic + profile_type (anonymous segment)
  //    e.g., "patients with diabetes concerns + brief style preference"

  // 3. Call Gemini:
  //    "Given these successful response patterns for [topic] queries,
  //     what response strategy most often led to patient action?
  //     Write a concise guidance note for the AI system."

  // 4. Write to ai_knowledge_base (source_type: 'learned')
  //    e.g., "For diabetes fatigue questions: bullet format + doctor referral
  //           suggestion has 3x higher appointment-booking rate"

  // 5. New patients with similar profiles benefit immediately — no PII shared
}
```

### 6.6 Knowledge Base Seeding

Pre-seed on first deploy with ~200 articles covering most common Indian health conditions:

```
Categories to seed:
  Cardiovascular:   Hypertension, CAD, Heart failure, ECG interpretation
  Metabolic:        Type 2 Diabetes, Hypothyroidism, Obesity, Vitamin D deficiency
  Hematology:       Anemia, Iron deficiency, Thalassemia, Sickle cell (regional)
  Gastrointestinal: GERD, IBS, Liver function tests, H. pylori
  Respiratory:      Asthma, COPD, TB screening, Pulse oximetry
  Women's Health:   PCOS, Thyroid in pregnancy, Iron in pregnancy, Menopause
  Common Labs:      CBC interpretation, Lipid panel, HbA1c, Kidney function (eGFR)
  Common Drugs:     Metformin, Amlodipine, Atorvastatin, Levothyroxine, Pantoprazole

Source: WHO guidelines, ICMR guidelines, NIN reference ranges (Indian population)
```

---

## 7. Feature Designs — UX + Technical

### F1 — Document Upload & OCR

**Mobile-First UX Flow:**

```
Dashboard → Health tab → FAB "+" (bottom-right, thumb zone)
  ↓
Bottom sheet slides up (spring animation, 300ms):
  ┌─────────────────────────────────┐
  │  📷  Take Photo                 │  ← Opens camera with crop guide
  │  🖼️  Choose from Gallery        │
  │  📄  Upload File (PDF/Image)    │
  └─────────────────────────────────┘
  ↓
Preview screen:
  - Auto-detected type shown: "Looks like a Lab Report 🧪"
  - User can tap to change type
  - "Confirm & Upload" CTA
  ↓
Upload progress:
  - Circular progress on thumbnail (non-blocking — patient can navigate away)
  - Status: "Reading your document..." → skeleton
  ↓
OCR Complete notification:
  - Inline banner: "Found 4 health events in your report"
  - Tap → OcrReviewSheet (bottom sheet)
  ↓
Review Sheet (swipeable):
  - Each extracted event as a card with confirm/dismiss
  - "Hemoglobin: 8.2 g/dL (Feb 12) — ⚠ Below normal"   [✓ Confirm] [✕ Dismiss]
  - "Confirm All" button at bottom
  ↓
Timeline updated immediately on confirm
```

**OCR Gemini Prompt:**
```
Extract ALL medical data from this document. Return JSON:
{
  "document_type": "lab_report|prescription|discharge|scan|vaccination|other",
  "document_date": "YYYY-MM-DD",
  "patient_name": "string|null",
  "events": [
    {
      "event_type": "lab_result|vital_sign|diagnosis|medication|procedure|vaccination",
      "display_name": "Hemoglobin",
      "loinc_code": "718-7",
      "icd10_code": null,
      "value_quantity": 8.2,
      "value_unit": "g/dL",
      "reference_range_low": 12.0,
      "reference_range_high": 16.0,
      "is_abnormal": true,
      "notes": "string|null"
    }
  ]
}
Indian lab normal ranges apply. Convert all units to standard SI.
```

**Plug-out:** Flag OFF → FAB hidden, /api/v1/patients/documents returns 423.

---

### F2 — Health Memory Timeline

**UX:**
```
/dashboard/health  (Health tab)

[All] [Lab Results] [Medications] [Conditions] [Vitals] [Scans]  ← sticky filter chips

│ March 2026
│
├─ ⚠ Hemoglobin Low — 8.2 g/dL             Mar 12  ← amber dot = abnormal
│   Tap → expand: reference range, source doc, LOINC: 718-7
│
├─ 💊 Started Ferrous Sulfate 200mg          Mar 10
│   Tap → expand: prescribed by Dr. X, document link
│
│ February 2026
│
├─ 🔬 CBC Report — 5 results                 Feb 12  ← expandable group
│   Tap → shows all CBC values inline
│
└─ 🏥 Discharge — Apollo Hospital            Feb 3
    Tap → full discharge summary card
```

**Export:**
- "Download Health Summary" → PDF generation → auto-download
- Contents: patient demographics, active conditions, medications, last 12 months of lab results, vaccinations
- Watermarked: "Generated by EasyHeals — For personal use"

---

### F3 — AI Health Coach

**Entry Points:**
1. **Health tab FAB** — persistent floating button (teal, pulse once on first visit)
2. **Post-document OCR** — "Ask AI about this result" button
3. **Timeline event card** — "Ask AI" micro-button on abnormal values
4. **Pre-booking** — "Have questions before your appointment?"

**Chat Interface:**
```
Mobile (full-screen overlay):
┌─────────────────────────────────────────┐
│ ← Health Coach           EN | हिं        │  ← language switch
├─────────────────────────────────────────┤
│                                         │
│         AI bubble (left, white)         │
│  "Hi Rahul! I've reviewed your          │
│   health records. Your recent labs      │
│   show low iron. How can I help?"       │
│                                         │
│                    User bubble (right)  │
│                 "Why am I always tired" │
│                                         │
│         AI bubble — streaming...        │
│  "Based on your Feb lab showing         │  ← text appears word-by-word
│   Hemoglobin 8.2 and your March..."     │
│                                         │
├─────────────────────────────────────────┤
│ [Explain last lab] [Is my BP ok?] [+]  │  ← context chips
├─────────────────────────────────────────┤
│ 🎤  Type a message...           [Send]  │  ← voice input + text
└─────────────────────────────────────────┘
```

**Feedback UI:**
- After each AI response: 👍 👎 (subtle, below message, tap to rate)
- On thumbs down: optional "What was wrong?" chip selection (Too long / Didn't answer / Not relevant)
- On thumbs up: no follow-up needed, just record signal

**Session Safety:**
- Every 4 minutes: background session check (no UI)
- On session expiry: chat input disabled, blurred overlay, re-auth modal appears
- Draft message preserved in localStorage during re-auth
- On re-auth success: overlay dismissed, chat resumes, draft restored

**Streaming API:** `POST /api/v1/ai/health-coach` returns `text/event-stream`
```
data: {"type":"token","content":"Based"}
data: {"type":"token","content":" on"}
data: {"type":"done","turnId":"abc123","tokenCount":145}
```

---

### F4 — Pre-Visit Brief

**Generation Cron** (`/api/cron/previsit-briefs` — Vercel cron every 15 min):
```
1. Find appointments: starts_at BETWEEN now+15min AND now+60min
2. Filter: patient_consent_granted = 1 AND brief not yet generated
3. For each: buildPreVisitContext(patientId) — decrypted, ephemeral
4. Gemini generates structured brief:
   - Chief complaint (from appointment notes)
   - Active conditions (from health_memory_events)
   - Current medications (from latest documents)
   - Recent abnormal labs (last 90 days)
   - Upcoming concerns patient has mentioned to AI coach
5. Store encrypted in previsit_briefs
6. Push SSE event to doctor portal: { type: 'BRIEF_READY', appointmentId }
```

**Doctor Portal — Brief Panel:**
```
Appointment card gains: [📋 Pre-Visit Brief] button (appears when brief ready)

Tapping opens right-side panel:
┌──────────────────────────────────┐
│ Pre-Visit Brief — Rahul Sharma   │
│ ✓ Patient consented to share     │
├──────────────────────────────────┤
│ Chief Complaint                  │
│ Follow-up for fatigue, anemia    │
├──────────────────────────────────┤
│ Active Conditions                │
│ • Iron deficiency anemia (Mar)   │
│ • Borderline hypothyroid         │
├──────────────────────────────────┤
│ Current Medications              │
│ • Ferrous Sulfate 200mg OD       │
│ • Levothyroxine 25mcg (?recent) │
├──────────────────────────────────┤
│ Recent Labs ⚠                    │
│ • Hb: 8.2 (Feb 12) — LOW        │
│ • TSH: 6.1 (Mar 5) — HIGH       │
├──────────────────────────────────┤
│ Doctor Notes                     │
│ [                              ] │
│              [Save Notes]        │
└──────────────────────────────────┘
```

---

### F5 — Document Sharing

**Patient Flow:**
```
Document detail → [Share with Provider] button
  ↓
Search: "Apollo Chennai" or "Dr. Sharma"
  ↓
Select expiry: 7 days / 30 days / Until appointment date
  ↓
Confirm: "Dr. Meera Sharma at Apollo Chennai will be able to view
          this document until April 15."
  ↓
Share created — provider notified via portal
```

**Revocation from Privacy page:**
```
Active Shares:
  📄 CBC Report → Dr. Meera Sharma (Apollo)   Expires Apr 15   [Revoke]
  📄 Discharge Summary → SIMS Hospital        Expires Apr 30   [Revoke]
```

**Provider Access:**
- One-time secure token sent to provider
- Provider accesses via portal (no new login) — token verified against `access_token_hash`
- Every access logged to `document_access_log`

---

### F6 — ABHA Health ID

**Status: Stub in P5, Full integration in P6**

**P5 implementation:**
- UI card on `/dashboard/profile`: "Link your ABHA Health ID"
- Tapping → modal explaining benefits
- "Link ABHA" button → placeholder state: "Coming soon — we're integrating with ABDM"
- DB: `abha_id` column on patients table (nullable) + feature flag `abha_integration` = false
- Code structure: full ABDM OAuth flow implemented but behind flag

**P6 when flag ON:**
- ABDM OAuth in modal (not new tab)
- Fetches linked health records (visits, prescriptions, lab reports)
- Writes to `health_memory_events` with `source: 'abha'`

---

### F7 — Privacy & Consent Dashboard

```
/dashboard/privacy

Active Consents
  ✓ Health Coach — AI can read my health records      Granted Mar 1   [Revoke]
  ✓ Pre-Visit Briefs — Share with my doctors          Granted Mar 10  [Revoke]
  ✗ Marketing communications                          Not granted     [Grant]

Document Shares
  (see F5 Active Shares section)

ABHA Health ID
  [Link ABHA ID]  ← P5 stub, P6 full

Data & Privacy
  [Download My Data as JSON]
  [Delete My Account]   ← requires OTP confirmation, soft-delete
```

---

### F8 — Full Booking Flow V2

**4-Step Wizard (`/book/[providerId]`):**

```
Step 1: Select Doctor
  Hospital selected → doctor grid (photo, name, specialty, rating, next slot, fee)
  "Any available doctor" at top
  Filter: by specialty
  → Select → Step 2

Step 2: Date & Time
  Month calendar (swipe to next month)
  Tap date → time slots appear as chips below
  Slot chips: [9:00 AM] [9:20 AM] [10:00 AM ⚡ Fast] [11:00 AM]
  "Fast" = within 24h
  → Select slot → Step 3

Step 3: Your Details
  Pre-filled: name, phone (from session)
  Visit type: [First Visit] [Follow-up] [Emergency]
  Notes: text area + 🎤 voice input button
  Health summary toggle: "Share my health summary with the doctor" ← P5 new
  → Confirm → Step 4

Step 4: Confirmation
  Appointment card (doctor, hospital, date, time, fee)
  [Add to Calendar] → .ics download
  WhatsApp confirmation sent automatically
  CTA: "Upload documents for your visit" (links to document upload)
```

---

### F9 — Gamification Rewards

```
/dashboard/rewards

┌─────────────────────────────────────────┐
│  🏆 Level 4 — Health Champion           │
│  ████████░░  850 / 1000 pts             │
│  150 points to Level 5                  │
├─────────────────────────────────────────┤
│  🔥 7-day streak! Keep it going         │
│  [✓ Daily Check-in — +10 pts]           │
├─────────────────────────────────────────┤
│  🏙 Chennai Leaderboard                  │
│  1. Priya M.          1240 pts          │
│  2. Arjun K.          980 pts           │
│  → YOU: #8            850 pts  ←       │
│  ...                                    │
├─────────────────────────────────────────┤
│  How to earn points                     │
│  📋 Complete profile          +50 pts   │
│  📄 Upload a document         +30 pts   │
│  📅 Book appointment          +20 pts   │
│  💬 Use Health Coach          +10 pts   │
│  👥 Refer a friend           +200 pts   │
└─────────────────────────────────────────┘
```

---

## 8. Navigation & Mobile Shell

### Updated MobileBottomNav (5 tabs)

```
🏠 Home  |  🔍 Find  |  ❤️ Health  |  📅 Bookings  |  👤 Profile
```

**Health tab** is the P5 hub. Sub-navigation inside:
```
Health tab selected →

[Timeline] [Chat] [Documents] [Rewards]   ← horizontal chips below nav

Each chip is hidden if its feature flag is OFF.
If all chips hidden: Health tab shows "Coming Soon" card.
```

### Bottom Sheet System (replaces all modals on mobile)
All P5 overlays use a consistent `<BottomSheet>` component:
- Spring animation (300ms ease-out)
- Drag handle at top
- Swipe down to dismiss
- Background scroll locked when open
- On desktop: same component renders as a right-side drawer (640px+)

---

## 9. API Reference

### Session
```
GET  /api/v1/auth/session-status      → { valid, expiresAt, minutesRemaining }
POST /api/v1/auth/extend              → Extends session TTL (called by useSessionHealth)
```

### Documents
```
POST   /api/v1/patients/documents              → Upload (multipart/form-data)
GET    /api/v1/patients/documents              → List (paginated, 20/page)
GET    /api/v1/patients/documents/[id]         → Detail + extracted events
DELETE /api/v1/patients/documents/[id]         → Soft-delete
POST   /api/v1/patients/documents/[id]/confirm → Confirm all OCR events
POST   /api/v1/patients/documents/[id]/reprocess → Re-run OCR
```

### Health Timeline
```
GET    /api/v1/patients/health-events              → List (filter by type, date range)
POST   /api/v1/patients/health-events              → Manual entry
PATCH  /api/v1/patients/health-events/[id]         → Update / confirm
DELETE /api/v1/patients/health-events/[id]         → Soft-delete
GET    /api/v1/patients/health-export              → PDF export (streaming)
```

### AI Health Coach
```
POST   /api/v1/ai/health-coach                → Send message (SSE streaming)
GET    /api/v1/ai/health-coach/history         → List conversations
GET    /api/v1/ai/health-coach/[convId]        → Conversation turns
DELETE /api/v1/ai/health-coach/[convId]        → Delete conversation
POST   /api/v1/ai/health-coach/feedback        → Submit turn feedback
```

### Document Sharing
```
POST   /api/v1/patients/documents/[id]/share   → Create share
GET    /api/v1/patients/documents/shares       → List active shares
DELETE /api/v1/patients/documents/shares/[id]  → Revoke share
GET    /api/v1/provider/documents/[token]      → Provider access (token-gated)
```

### Pre-Visit Brief
```
GET    /api/v1/provider/appointments/[id]/brief → Doctor fetches brief
PATCH  /api/v1/provider/appointments/[id]/brief → Doctor adds notes
POST   /api/cron/previsit-briefs               → Cron trigger (Vercel)
```

### Booking V2
```
GET    /api/v1/providers/[id]/availability     → Available slots (date range)
POST   /api/v1/appointments                    → Create appointment (replaces /api/book)
GET    /api/v1/appointments/[id]/ics           → Calendar invite (.ics)
```

---

## 10. Environment Variables

```env
# P5 additions (add to .env.local)

# Health document storage (Vercel Blob — already configured for P3)
BLOB_READ_WRITE_TOKEN=                  # Already exists

# Health data encryption (separate key from PHONE_ENCRYPTION_KEY)
HEALTH_PHI_ENCRYPTION_KEY=             # 32-byte hex, MUST be separate from phone key

# AI Learning
GEMINI_EMBEDDING_MODEL=text-embedding-004    # For vector embeddings
AI_LEARNING_ENABLED=true                     # Master switch for embedding pipeline

# ABHA (P5 stub — leave empty until P6)
ABDM_CLIENT_ID=
ABDM_CLIENT_SECRET=
ABDM_SANDBOX=true

# Pre-visit brief cron
PREVISIT_BRIEF_CRON_SECRET=            # Secret for /api/cron/previsit-briefs
```

---

## 11. Implementation Phases — Week by Week

### Week 1 — Foundation + Session (Days 1–7)

**Day 1–2: Session smooth transitions**
- [ ] Add `last_active_at`, `extended_count`, `max_ttl_hours` to sessions table
- [ ] Update `requireAuth()` to extend TTL on each call
- [ ] `GET /api/v1/auth/session-status` endpoint
- [ ] `useSessionHealth()` hook (polls every 4 min)
- [ ] Re-auth modal component (OTP flow, no page redirect)
- [ ] State preservation: localStorage draft, sessionStorage return URL
- [ ] BroadcastChannel cross-tab sync

**Day 3–5: Database + Feature Flags**
- [ ] All P5 migrations (health_documents, health_memory_events, ai_conversations, ai_conversation_turns, ai_embeddings, ai_patient_profiles, ai_response_feedback, ai_knowledge_base, document_shares, document_access_log, previsit_briefs)
- [ ] Seed all P5 feature flags (all OFF by default)
- [ ] `requireFeatureFlag()` helper
- [ ] `FeatureGate` React component
- [ ] `embedAsync()` helper (queue-based, non-blocking)
- [ ] `vectorSearch()` helper (Turso vector_top_k)

**Day 6–7: Navigation + Shell**
- [ ] 5-tab MobileBottomNav (add Health tab)
- [ ] `BottomSheet` shared component (spring animation, swipe dismiss)
- [ ] `/dashboard/health` page (empty state with feature-gated sub-nav)
- [ ] Seed knowledge base (200 articles, all embedded)

---

### Week 2 — Document Intelligence (Days 8–14)

**Day 8–10: Upload + OCR**
- [ ] `POST /api/v1/patients/documents` — multipart upload to Vercel Blob (URL encrypted)
- [ ] `DocumentUploader` component (camera + gallery + file, mobile-first)
- [ ] OCR pipeline: Gemini Vision prompt → parse events → write to health_memory_events (unconfirmed)
- [ ] Embed each health event async after OCR

**Day 11–12: Review + Timeline**
- [ ] `OcrReviewSheet` (bottom sheet, confirm/dismiss each event)
- [ ] `GET /api/v1/patients/health-events` with filters
- [ ] `HealthTimeline` component (vertical, color-coded, collapsible groups)
- [ ] `TimelineFilters` (sticky horizontal chips)
- [ ] Manual event entry form

**Day 13–14: Export + Polish**
- [ ] PDF health export endpoint
- [ ] `DocumentCard` and `DocumentDetailSheet`
- [ ] Abnormal value flagging (amber indicators)
- [ ] Document type detection + user correction flow

---

### Week 3 — AI Health Coach (Days 15–21)

**Day 15–17: RAG Pipeline**
- [ ] `buildHealthCoachContext()` — pulls from health events, past conversations, patient profile
- [ ] RAG retrieval: 3 parallel vector searches (health events + conversations + knowledge base)
- [ ] Dynamic system prompt assembly (incorporates communication_style from profile)
- [ ] `POST /api/v1/ai/health-coach` — SSE streaming endpoint

**Day 18–19: Chat UI**
- [ ] `CoachDrawer` (full-screen mobile, right panel desktop)
- [ ] `ChatBubble` with streaming text animation
- [ ] `ContextChips` (quick prompts based on recent health events)
- [ ] Language switch (EN/HI toggle)
- [ ] Voice input button (Web Speech API, mobile-first)
- [ ] Feedback UI (thumbs up/down, subtle placement)

**Day 20–21: Session Continuity + Learning**
- [ ] Draft preservation (localStorage during re-auth)
- [ ] Conversation history sync (localStorage ↔ DB)
- [ ] `GET/DELETE /api/v1/ai/health-coach/*` endpoints
- [ ] Profile synthesis cron (`/api/cron/synthesize-profiles`)
- [ ] Implicit feedback capture (appointment booking signal)

---

### Week 4 — Provider Integrations + Booking V2 (Days 22–28)

**Day 22–23: Pre-Visit Brief**
- [ ] `buildPreVisitContext()` — doctor-optimized context (different from coach context)
- [ ] `/api/cron/previsit-briefs` cron (every 15 min)
- [ ] `BriefPanel` in doctor portal
- [ ] Patient consent toggle on booking confirmation
- [ ] SSE push to doctor portal when brief is ready

**Day 24–25: Document Sharing + Privacy Page**
- [ ] `ShareDocumentSheet` component
- [ ] Share API (create, list, revoke)
- [ ] Provider document access (token-gated endpoint)
- [ ] `/dashboard/privacy` page (consents, shares, data export, delete account)
- [ ] Download data as JSON endpoint

**Day 26–27: Booking V2**
- [ ] `/book/[providerId]` 4-step wizard
- [ ] Availability API (slot generation from provider_schedules)
- [ ] Calendar invite (.ics generation)
- [ ] Health summary sharing consent toggle in step 3

**Day 28: Gamification + ABHA Stub + Final QA**
- [ ] `/dashboard/rewards` page
- [ ] Gamification API (balance, leaderboard, check-in)
- [ ] ABHA UI placeholder (behind disabled flag)
- [ ] End-to-end testing: upload doc → view timeline → chat about it → book appointment
- [ ] Performance: embedding pipeline doesn't slow down any user-facing request

---

## 12. Open Decisions

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Profile synthesis frequency | Nightly for all active patients vs. triggered per interaction | **Nightly** — richer model, acceptable token cost |
| 2 | Knowledge base seed | Pre-seed 200 articles vs. start empty | **Pre-seed** — immediate value for new patients |
| 3 | Cross-patient learning | Enable anonymized pattern extraction | **Enable** — no PII risk, significant quality improvement |
| 4 | Feedback UI placement | After every message vs. end of conversation | **After every message** — more granular signal |
| 5 | Session max TTL | 7 days vs. 30 days | **7 days** — balance security and convenience |
| 6 | ABHA P5 | Full OAuth vs. UI stub only | **UI stub** — ABDM credentials take time to get approved |
| 7 | Booking V2 | Replace modal vs. run parallel | **Parallel** — modal for quick booking, /book for full flow |
| 8 | Health Coach model | Gemini 2.5 Flash vs. more powerful | **Flash** — fast enough for conversational UX, cost-effective |
| 9 | i18n scope | All pages vs. Health Coach only in P5 | **Health Coach + Health tab only** — full i18n in P6 |

---

*Document maintained by: EasyHeals Engineering*
*Next review: After Week 2 completion*
*Related documents: HLD_v6.md, ARCHITECTURE.md, PLAN.md*
