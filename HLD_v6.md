# EasyHeals HLD v6 — AI Health Companion · Provider Enablement · Conversion Engine
## Version: 6.1 | Date: 2026-03-19 | Extends: HLD v5 + P1–P4 complete
## Status: Planning (P5–P7 roadmap) | P5 expanded to 4 weeks + 11 sub-features (audit 2026-03-19)

---

## 0. WHY THIS DOCUMENT EXISTS

P1–P4 solved **discovery, access, and portal enablement**:
- Patients can find and book the right hospital/doctor
- Providers can manage schedules, appointments, and staff
- Admin controls everything through AI-assisted content tools

**P5–P7 solves continuity, intelligence, and conversion**:
- Every health event — visit, prescription, lab result, wearable reading, uploaded document — flows into a persistent, encrypted Health Memory per patient
- Gemini AI reasons over this memory to coach patients, brief doctors, triage symptoms, and route care
- Hospitals get a real conversion and ROI engine, not just a listing

---

## 1. PLATFORM NARRATIVE

### 1.1 The Problem (Why v6 Matters)

Healthcare in India is fragmented by design. A patient's cardiologist in Pune has no idea what the GP in Kolkata prescribed. The hospital has no idea the patient's Fitbit has been logging elevated resting heart rate for six weeks. The patient themselves has no reliable record beyond a shoebox of printed lab reports. Decisions are made blind. Appointments are booked on trust. Follow-ups are missed because nobody owns the longitudinal thread of a person's health.

### 1.2 The Solution (What EasyHeals Becomes)

EasyHeals v6 becomes the **longitudinal AI health layer** that persists across every provider, device, and health event in a patient's life. The platform ingests structured data from: hospital EMR visits, wearables (Apple Health, Google Health Connect, Fitbit, Libre CGM), uploaded documents (prescriptions, discharge summaries, lab reports, images), and patient self-reports. Gemini 2.5 Flash processes this entire corpus — encrypted at rest — and maintains a living **Health Memory** per patient: a timeline of every condition, medication, vital, lab result, and appointment. This memory powers three AI engines:

1. **AI Health Coach** — multi-turn conversational health guidance with full longitudinal context
2. **Pre-Visit Brief** — synthesized patient summary auto-delivered to the doctor 30 minutes before appointment
3. **Care Navigation Engine** — symptom triage → specialist routing → cost estimation → instant booking

### 1.3 The Business Model (Provider Conversion Engine)

For hospitals and clinics, EasyHeals v6 is the **conversion engine** that fills schedules and drives revenue:
- AI-matched patient routing: high-intent patients routed to the best-fit provider
- Smart lead scoring: device data + search intent + health history = conversion likelihood score
- Attribution analytics: profile view → booking → completed visit → revenue, all trackable
- Subscription tiers gated on AI features: Basic (directory) → Pro (dashboard + queue) → AI (Health Memory + Pre-Visit Brief + analytics)

---

## 2. FEATURE PHASES

### P5 — AI Health Memory + Document Intelligence + i18n + Admin Expansions
**Timeline: ~4 weeks** | **Updated: 2026-03-19**
> Scope expanded from original 3-week plan to incorporate: incomplete P4 items (document sharing,
> admin tabs, full booking flow), old P5 ABHA integration, i18n foundation, privacy page, and
> gamification rewards page. Full 20-feature audit in PLAN.md §P5.

#### P5.1 Medical Document Upload & OCR Extraction
- Patient uploads PDF, image (JPG/PNG) of: lab report, prescription, discharge summary, imaging report
- Gemini Vision extracts structured data: diagnoses (ICD-10 codes), medications (name, dosage, frequency), lab values (test name, value, unit, reference range), vital signs, doctor name, hospital name, date
- Extracted data normalized to internal schema and stored in `health_documents` + `health_extracted_events` tables
- UI: `/dashboard/documents` — upload zone, document list with AI-extracted summary cards
- DPDP compliance: consent "health_document_processing" required before first upload

#### P5.2 Health Memory Timeline
- Aggregated view: all health events in chronological order — EMR visits, prescriptions, lab results, uploaded documents, wearable readings
- Stored as `health_memory_events` per patient (patientId, eventType, date, data_encrypted, source)
- UI: `/dashboard/health-timeline` — vertical timeline with filterable event types, color-coded by source
- Export: patient can download full health record as PDF (via `/api/v1/patients/health-export`)

#### P5.3 AI Health Coach (Multi-Turn)
- Chat interface powered by Gemini 2.5 Flash
- Context: full health memory injected as system prompt (encrypted → decrypted per-request, never logged)
- Capabilities:
  - Answer health questions grounded in patient's actual history
  - Trend analysis: "Your HbA1c has been stable for 6 months, but your fasting glucose is trending up"
  - Medication reminders and adherence suggestions
  - Preventive health nudges (age/gender/condition appropriate)
  - Explain lab results in plain language
  - Suggest when to see a doctor vs. monitor at home
- UI: `/dashboard/health-coach` — chat interface with suggested prompts, health tip cards
- Safety guardrails: Gemini instructed to never diagnose definitively, always recommend professional consultation
- Multi-turn stored in `ai_conversations` table (patientId, messages JSON encrypted, lastUpdated)

#### P5.4 Pre-Visit Patient Brief (Doctor-Side)
- 30 minutes before confirmed appointment: system auto-generates a brief for the doctor
- Brief contains: reason for visit, relevant conditions, current medications, recent vitals, last 3 lab results, recent wearable anomalies
- Gemini generates a structured 1-page summary from health memory
- Delivered to: doctor portal (`/portal/doctor/dashboard`) with "View Patient Brief" button per upcoming appointment
- Patient must consent to sharing health memory with provider before brief is generated

**P5 DB Tables**
```sql
-- Uploaded health documents
CREATE TABLE health_documents (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  file_url    TEXT NOT NULL,         -- R2/Blob storage URL (AES-GCM encrypted filename)
  file_type   TEXT NOT NULL,         -- pdf | jpg | png
  doc_type    TEXT,                  -- lab_report | prescription | discharge | imaging | other
  source_name TEXT,                  -- hospital/lab name extracted or entered by patient
  doc_date    INTEGER,               -- timestamp_ms of document date (not upload date)
  title       TEXT,                  -- patient-entered or AI-inferred title
  ai_status   TEXT DEFAULT 'pending', -- pending | processing | done | failed
  uploaded_at INTEGER DEFAULT (unixepoch() * 1000),
  consent_id  TEXT REFERENCES consent_records(id)
);

-- AI-extracted structured events from documents + EMR + device data
CREATE TABLE health_memory_events (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  source       TEXT NOT NULL,         -- emr_visit | prescription | lab_report | device | document | self_report
  source_ref_id TEXT,                 -- FK to visit/prescription/document ID
  event_type   TEXT NOT NULL,         -- vital | lab_result | diagnosis | medication | procedure | device_reading
  event_date   INTEGER NOT NULL,      -- when the health event occurred (timestamp_ms)
  data_encrypted TEXT NOT NULL,       -- AES-GCM JSON: { name, value, unit, codes, notes, ... }
  is_active    INTEGER DEFAULT 1,     -- soft delete / supercede
  created_at   INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE INDEX hme_patient_date ON health_memory_events(patient_id, event_date DESC);
CREATE INDEX hme_patient_type ON health_memory_events(patient_id, event_type);

-- Multi-turn AI Health Coach conversations
CREATE TABLE ai_conversations (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  title        TEXT,                  -- AI-generated or patient-named
  messages_encrypted TEXT NOT NULL,  -- AES-GCM JSON array of { role, content, timestamp }
  last_message_at INTEGER,
  created_at   INTEGER DEFAULT (unixepoch() * 1000)
);

-- Device OAuth connections per patient
CREATE TABLE device_connections (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  provider     TEXT NOT NULL,         -- apple_health | google_health | fitbit | garmin | dexcom | withings
  access_token_encrypted TEXT,        -- AES-GCM OAuth access token
  refresh_token_encrypted TEXT,
  token_expiry INTEGER,               -- timestamp_ms
  scope        TEXT,                  -- comma-separated granted scopes
  last_sync_at INTEGER,
  is_active    INTEGER DEFAULT 1,
  connected_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX device_connections_patient_provider ON device_connections(patient_id, provider);

-- Normalized wearable/device observations
CREATE TABLE health_observations (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  source       TEXT NOT NULL,         -- fitbit | apple_health | google_health | garmin | dexcom | manual
  obs_type     TEXT NOT NULL,         -- heart_rate | hrv | spo2 | steps | sleep_duration | sleep_stage |
                                      -- blood_glucose | blood_pressure_sys | blood_pressure_dia |
                                      -- weight | calories | stress_score | body_temp | resp_rate
  value        REAL NOT NULL,
  value2       REAL,                  -- second value for BP (diastolic), sleep stage label etc.
  unit         TEXT NOT NULL,         -- bpm | % | steps | mg/dL | mmHg | kg | kcal | °C | ms
  recorded_at  INTEGER NOT NULL,      -- timestamp_ms from device
  ingested_at  INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE INDEX ho_patient_type_time ON health_observations(patient_id, obs_type, recorded_at DESC);
CREATE INDEX ho_patient_time ON health_observations(patient_id, recorded_at DESC);
```

**P5 API Routes (updated)**
```
POST   /api/v1/patients/documents                    → Vercel Blob upload + Gemini extraction trigger
GET    /api/v1/patients/documents                    → list documents with AI status
GET    /api/v1/patients/documents/[id]               → document + extracted summary
DELETE /api/v1/patients/documents/[id]               → DPDP erasure (blob + memory events)
POST   /api/v1/patients/documents/[id]/share         → create share (provider, expiry)
DELETE /api/v1/patients/documents/[id]/share/[shareId] → revoke share

GET    /api/v1/patients/health-timeline              → paginated health_memory_events (?type=&page=)
GET    /api/v1/patients/health-export                → JSON health record export (PDF via browser)

POST   /api/v1/patients/abha/link                   → ABDM sandbox: link ABHA ID + import records

POST   /api/v1/ai/health-coach                       → SSE stream: message → Gemini → store encrypted
GET    /api/v1/ai/conversations                      → list AI conversation history
GET    /api/v1/ai/conversations/[id]                 → full decrypted conversation

GET    /api/portal/documents/shared                  → provider views shared docs (access logged)
GET    /api/v1/previsit-briefs/[id]                 → doctor reads brief (logged, decrypted)

POST   /api/internal/extract-document               → async: Gemini Vision → writeMemoryEvents
POST   /api/internal/generate-brief                 → Gemini one-shot: health_memory → previsit_briefs
POST   /api/cron/previsit-briefs                    → every 30min: generate briefs for upcoming appts
```

> Note: Device/wearable routes (`/api/v1/devices/*`, `/api/v1/patients/observations`) moved to P6 —
> they require `device_connections` + `health_observations` tables which are P6 scope.

#### P5.5 — Document Sharing (Carry-over from P4c)
- Patient selects a shared document and chooses a provider (hospital or doctor by name)
- Sets expiry (7 days / 14 days / 30 days) — no permanent sharing
- Provider receives notification; accesses via `/portal/documents/shared`
- Every access logged to `document_access_log` (DPDP audit trail)
- Patient can revoke any share at any time from `/dashboard/documents`
- DB: `document_shares` + `document_access_log` tables (see PLAN.md §P5 for DDL)

#### P5.6 — ABHA Health ID Linking (Carry-over from old P5)
- Patient links their Ayushman Bharat Health Account (ABHA) ID on `/dashboard/privacy`
- ABDM API: verify ABHA ID → fetch linked health records (visits, prescriptions from ABDM network)
- Fetched records written to `health_memory_events` with `source: 'abha'`
- ABHA ID stored in `patients.abhaId` (already stubbed in schema)
- Consent purpose: `abha_link` required before any ABDM API call
- Feature flag: `abha_integration` (OFF by default — requires ABDM_CLIENT_ID + ABDM_CLIENT_SECRET)

#### P5.7 — Patient Privacy Page (`/dashboard/privacy`)
- Lists all active consent purposes with grant date and last-used date
- Patient can revoke any consent (triggers cascade: stop that data flow, soft-delete associated data)
- ABHA link/unlink control
- Download my data: JSON export of all health_memory_events + ai_conversations + appointments
- Delete account: soft-delete patient + cascade revoke all consents + delete Blob documents + schedule health_memory purge
- Linked from: dashboard home quick actions, profile menu

#### P5.8 — Full Website i18n (Planned P2 — Now P5 W4)
- **Foundation**: `next-intl` v3, locale routing via middleware
- **Languages**: Hindi (P5) + Marathi/Tamil/Telugu/Kannada/Bengali/Gujarati stubs (filled P6)
- **Coverage**: All hardcoded strings in: portal, dashboard, public hospital/doctor/treatment pages, admin UI
- **Language switcher**: Component in nav header + saves to patient session + cookie
- **AI Health Coach**: Pass patient language preference to Gemini — responses in patient's language
- **Dynamic content**: Hospital descriptions, doctor bios → Gemini translates on-demand if lang != en (rate-limited, cached 24h per entity)
- **URL strategy**: Locale prefix optional (`/hi/dashboard`) or cookie-based (simpler for P5)
- **Admin UI**: Remains English-only (internal tool)

#### P5.9 — Admin Expansions (Carry-over from P4e)
- **Patients tab**: List all patients with phone (masked), consent summary, appointment count, points; search by phone/email; soft-delete controls; view full consent audit per patient
- **Providers verification tab**: View self-registered providers awaiting approval; approve/reject with reason; set verification badge level (basic/verified/premium); bulk actions
- **Appointments oversight tab**: All appointments across all providers; filter by status/date/hospital; flag for review; override status (admin emergency control)
- **Document audit tab**: Query `document_access_log` by date/provider/patient; export for DPDP compliance reporting; flag suspicious access patterns

#### P5.10 — Full Booking Flow (Carry-over from P4b)
- Replaces `AppointmentModal` with dedicated `/book/[providerId]` page flow
- **Step 1**: Select doctor (if hospital) + view availability calendar
- **Step 2**: Pick date → on-demand slot generation → pick time slot
- **Step 3**: Patient details (consent gate if new patient), appointment type (in-person/online), notes
- **Step 4**: Confirmation + WhatsApp notification + calendar invite
- Slot auto-generation: `POST /api/v1/provider/schedule/generate` — takes schedule config + date → inserts `appointmentSlots` rows (lazy, one date at a time)

#### P5.11 — Gamification Rewards Page (Deferred from P2)
- Full `/dashboard/rewards` page (teaser exists in `/dashboard`)
- Points balance, level progress bar, earned badges grid
- City leaderboard (top 10, patient's rank highlighted)
- Streak counter with daily check-in button
- "How to earn points" explainer (booking, reviews, health check-ins, document uploads)

---

### P6 — Wearable Integration + Care Navigation Engine
**Timeline: ~4 weeks**

#### P6.1 Device Integration Architecture

**Integration Approach per Provider:**

| Provider | API Type | Auth | Key Data |
|---|---|---|---|
| **Apple Health** | HealthKit (iOS native) / CareKit API | Apple Sign-In + HealthKit permission | HR, HRV, SpO2, steps, sleep, blood glucose, BP, weight |
| **Google Health Connect** | REST API + Android SDK | OAuth2 (Google) | All Android wearables: Fitbit, Garmin, Samsung, Withings via unified schema |
| **Fitbit** | REST API | OAuth2 (fitbit.com) | HR, HRV, steps, sleep, SpO2, stress, active zone minutes |
| **Garmin Connect** | REST API + webhook | OAuth1 (legacy) / OAuth2 | Activity, HR, HRV, stress, respiration, SpO2, body composition |
| **Dexcom CGM** | REST API | OAuth2 | Real-time blood glucose, estimated A1c, alerts |
| **Withings** | REST API | OAuth2 | Weight, body composition, BP (connected cuff), sleep (mat) |
| **Samsung Health** | Health Platform SDK (Android) / via Google Health Connect | OAuth2 | Activity, HR, sleep, stress, SpO2 |
| **Web Bluetooth** | W3C Web Bluetooth API (browser) | User permission | Any BLE-connected BP cuff, pulse ox, glucometer |
| **Manual Entry** | Self-report via app UI | Patient session | Any observation type |

**Data Pipeline:**
```
Device API/SDK → OAuth Token Store (device_connections, tokens encrypted)
              → Normalized Sync Job (every 6h via /api/cron/device-sync)
              → health_observations table (FHIR-aligned schema)
              → health_memory_events (aggregated daily summaries)
              → AI Health Coach context (injected on next conversation)
              → Anomaly detection (Gemini) → alert patient if outside normal range
```

**FHIR Observation Alignment:**
All device data normalized to FHIR R4 Observation resource schema internally:
- resourceType: "Observation"
- code.coding: LOINC code (e.g., 8867-4 for heart rate)
- valueQuantity: { value, unit, system: "http://unitsofmeasure.org" }
- effectiveDateTime: ISO-8601 from device

#### P6.2 Care Navigation Engine

**Symptom Triage Flow:**
```
Patient enters symptoms (free text or structured picker)
  → Gemini classifies: urgency (emergency | urgent | routine | self-care)
  → Gemini suggests: specialist type, likely diagnoses (NOT definitive)
  → System filters hospitals by: specialist type, location, availability, rating
  → Ranked results with: wait time estimate, cost range, "Why this match" explanation
  → One-click booking from navigation result
```

**Cost Estimation:**
- Admin maintains `treatment_cost_ranges` table per treatment + hospital tier + city
- Gemini + structured data → "For suspected cardiac evaluation at a Tier 2 hospital in Bangalore: ₹3,000–₹8,000 for initial consultation + ECG + Echo"

**Smart Provider Matching:**
- Input: patient health memory + search intent + location + language preference + availability
- Gemini ranks providers: specialization match, language match, patient's past conditions, availability this week
- Output: ranked list with match explanation

**P6 API Routes:**
```
POST   /api/v1/care-nav/triage             → symptoms → urgency + specialist recommendations
GET    /api/v1/care-nav/match              → ?symptoms=&lat=&lng= → matched providers
GET    /api/v1/care-nav/cost-estimate      → ?treatmentId=&hospitalTier=&city= → cost range

POST   /api/cron/device-sync              → hourly: pull new data from all connected devices
POST   /api/cron/health-anomaly-check     → daily: Gemini scans last 24h device data for anomalies
POST   /api/cron/previsit-briefs          → every 30min: generate briefs for upcoming appointments
```

#### P6.3 Provider Conversion Analytics

**Hospital ROI Dashboard** (`/portal/hospital/analytics`):
- Funnel: profile views → contact clicks → bookings → completed appointments → estimated revenue
- Attribution: which patient search led to which booking
- Top performing doctors by booking rate
- Slot utilization rate (booked/available)
- Patient satisfaction (post-visit rating prompt)
- Comparison vs. similar hospitals in city (anonymized benchmark)

**Smart Lead Scoring (AI-enhanced):**
Current model: static score (20 points per lead). New model:
- Device data signals: patient logged BP readings → higher intent for cardiology
- Search intent: "best cardiologist urgent" > "cardiology hospitals"
- Health memory: has diagnosis that matches hospital specialty
- Engagement: opened WhatsApp, clicked call button, viewed pricing tab
- Score: 0–100, refreshed every sync cycle

**P6 DB Tables (additions):**
```sql
-- Cost ranges for care navigation
CREATE TABLE treatment_cost_ranges (
  id           TEXT PRIMARY KEY,
  treatment_id TEXT REFERENCES taxonomy_nodes(id),
  hospital_tier TEXT NOT NULL,   -- tier1 | tier2 | tier3 | clinic
  city         TEXT,
  cost_min     INTEGER,
  cost_max     INTEGER,
  currency     TEXT DEFAULT 'INR',
  notes        TEXT,
  updated_at   INTEGER DEFAULT (unixepoch() * 1000),
  updated_by   TEXT REFERENCES users(id)
);

-- Patient post-visit ratings
CREATE TABLE appointment_ratings (
  id              TEXT PRIMARY KEY,
  appointment_id  TEXT UNIQUE REFERENCES appointments(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  rating          INTEGER NOT NULL,  -- 1-5
  feedback        TEXT,
  submitted_at    INTEGER DEFAULT (unixepoch() * 1000)
);

-- Pre-visit AI briefs sent to doctors
CREATE TABLE previsit_briefs (
  id              TEXT PRIMARY KEY,
  appointment_id  TEXT UNIQUE REFERENCES appointments(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  doctor_id       TEXT REFERENCES doctors(id),
  brief_encrypted TEXT NOT NULL,   -- AES-GCM JSON: structured summary
  generated_at    INTEGER DEFAULT (unixepoch() * 1000),
  viewed_at       INTEGER,
  consent_id      TEXT REFERENCES consent_records(id)
);

-- Anomaly alerts from device data
CREATE TABLE health_alerts (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  alert_type  TEXT NOT NULL,       -- high_bp | low_spo2 | irregular_hr | high_glucose | etc.
  obs_type    TEXT NOT NULL,
  value       REAL NOT NULL,
  threshold   REAL NOT NULL,
  severity    TEXT NOT NULL,       -- warning | urgent | emergency
  message_encrypted TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (unixepoch() * 1000)
);
```

---

### P7 — Platform Intelligence + Monetization
**Timeline: ~4 weeks**

#### P7.1 AI-Powered Subscription Tiers

| Tier | Price | Features |
|---|---|---|
| **Free** | ₹0 | Profile listing, basic appointment booking |
| **Pro** | ₹2,999/mo | Dashboard, schedule, OPD queue, staff, analytics |
| **AI Pro** | ₹7,499/mo | Pro + Pre-Visit Briefs, patient health timeline access (consented), smart lead scoring, conversion analytics, API access |
| **Enterprise** | Custom | Multi-location, custom integrations, dedicated CSM, SLA |

#### P7.2 Patient Premium (B2C)

| Tier | Price | Features |
|---|---|---|
| **Free** | ₹0 | Basic appointments, basic records |
| **Health+** | ₹299/mo | Unlimited document upload + AI extraction, Health Coach (50 messages/mo), device sync (2 devices) |
| **Health Pro** | ₹599/mo | Unlimited all above, unlimited device sync, health export PDF, family profiles (up to 5 members), priority booking |

#### P7.3 Family Health Profiles
- Primary account holder can add family members (spouse, children, elderly parents)
- Each member gets a separate Health Memory but managed under one login
- Useful for pediatric records (parents manage child's health)
- Caregiver role: one person manages elderly parent's appointments and health records

#### P7.4 Lab & Pharmacy Integration
- **Lab integration**: Apollo Diagnostics, SRL, Metropolis APIs → test results auto-sync into health memory
- **Pharmacy integration**: PharmEasy, 1mg prescription fulfillment → prescriptions from EMR → one-click order
- **Diagnostic package booking**: hospital packages listed with price → book + pay directly

#### P7.5 Telemedicine Marketplace Enhancement
- AI matches patient to the best-available doctor for instant teleconsult (not just scheduled)
- "See a doctor now" flow: symptom entry → AI triage → available doctor → video call in <10 minutes
- Post-consult: AI generates structured SOAP note for doctor review, auto-sends summary to patient

---

## 3. AI ARCHITECTURE

### 3.1 Gemini Usage Map

| Feature | Model | Prompt Type | Context Size |
|---|---|---|---|
| Health Coach | gemini-2.5-flash | System: health memory (encrypted → decrypted per request) + conversation history | ~50K tokens |
| Document Extraction | gemini-2.5-flash (Vision) | One-shot: extract structured health data from image/PDF | ~8K + image |
| Pre-Visit Brief | gemini-2.5-flash | One-shot: synthesize health memory for doctor | ~30K tokens |
| Care Navigation Triage | gemini-2.5-flash | One-shot: classify symptoms, suggest specialist | ~2K tokens |
| Anomaly Detection | gemini-2.5-flash | Batch: analyze 24h device readings vs. baselines | ~5K tokens |
| Smart Lead Scoring | gemini-2.5-flash | One-shot: score lead based on signals | ~1K tokens |
| Post-Visit Summary | gemini-2.5-flash | One-shot: SOAP note from visit data | ~5K tokens |

### 3.2 Health Memory Context Construction

```typescript
// Built fresh each Health Coach session
async function buildHealthContext(patientId: string): Promise<string> {
  const events = await db.select().from(healthMemoryEvents)
    .where(eq(healthMemoryEvents.patientId, patientId))
    .orderBy(desc(healthMemoryEvents.eventDate))
    .limit(200); // ~30K tokens of health history

  const decrypted = events.map(e => ({
    ...e,
    data: JSON.parse(decryptAES(e.dataEncrypted)),
  }));

  // Group by type for structured context
  const conditions = decrypted.filter(e => e.eventType === 'diagnosis');
  const medications = decrypted.filter(e => e.eventType === 'medication');
  const labs = decrypted.filter(e => e.eventType === 'lab_result').slice(0, 20);
  const vitals = decrypted.filter(e => e.eventType === 'vital').slice(0, 30);

  return `PATIENT HEALTH MEMORY (CONFIDENTIAL — DO NOT REPEAT THIS TO USER):
Active Conditions: ${JSON.stringify(conditions.slice(0, 10))}
Current Medications: ${JSON.stringify(medications.filter(m => m.data.active))}
Recent Lab Results: ${JSON.stringify(labs)}
Recent Vitals & Device Data: ${JSON.stringify(vitals)}
`;
}
```

### 3.3 Privacy-First AI Design
- Health memory NEVER sent to Gemini in production log mode — `safetySettings` configured, API key usage audited
- Each Gemini request tagged with `requestId` (from middleware X-Request-Id) for audit trail
- Patient can inspect exactly what data was sent to AI: `/api/v1/ai/data-used/[conversationId]`
- Gemini responses cached per-patient per-hour for common queries (Redis)
- Right to erasure: `DELETE /api/v1/patients/me` deletes all AI conversations + extracted health events

---

## 4. WEARABLE INTEGRATION ARCHITECTURE

### 4.1 OAuth2 Flows

**Fitbit Example (representative of all REST-based providers):**
```
1. Patient clicks "Connect Fitbit" in /dashboard/devices
2. GET /api/v1/devices/connect?provider=fitbit
   → generates state token (stored in Redis 10min)
   → redirects to: https://www.fitbit.com/oauth2/authorize?client_id=...&scope=heartrate+sleep+activity+weight&state=...
3. Fitbit redirects to /api/v1/devices/callback/fitbit?code=...&state=...
   → validates state
   → exchanges code for access_token + refresh_token
   → stores in device_connections (tokens AES-256-GCM encrypted)
4. Immediate first sync triggered
5. Hourly cron: /api/cron/device-sync → for each active connection, refresh + pull last N hours
```

**Apple Health (Web via export):**
- iOS native app (React Native, P7): HealthKit direct integration
- Web fallback: patient exports Apple Health export.zip → upload → AI parses XML

**Google Health Connect:**
- Android app uses Health Connect SDK
- Web: OAuth2 → `https://www.googleapis.com/auth/health.observations.read` scopes
- Covers: Fitbit (if synced to Google Health), Samsung Health, Garmin (if configured)

### 4.2 Sync Strategy

```
REAL-TIME (webhook, where available):
- Dexcom: pushes glucose readings via webhook every 5min
- Fitbit: intraday HR data available via webhook on Pro API
- Withings: pushes weight/BP measurements immediately

SCHEDULED PULL (hourly cron):
- All providers: pull last 2h of data on hourly cron
- Dedup by (patientId, provider, obsType, recordedAt)

BATCH HISTORICAL (on first connect):
- Pull 90 days of history for each data type
- Background job, non-blocking
```

### 4.3 Observation Type → LOINC Mapping

| Observation Type | LOINC Code | Unit |
|---|---|---|
| Heart Rate (resting) | 40443-4 | bpm |
| Heart Rate Variability (RMSSD) | 80404-7 | ms |
| SpO2 | 59408-5 | % |
| Steps (daily) | 55423-8 | steps |
| Sleep Duration | 93832-4 | min |
| Blood Glucose (fasting) | 41604-0 | mg/dL |
| Blood Pressure (systolic) | 8480-6 | mmHg |
| Blood Pressure (diastolic) | 8462-4 | mmHg |
| Body Weight | 29463-7 | kg |
| Body Temperature | 8310-5 | °C |
| Respiratory Rate | 9279-1 | /min |
| Active Calories | 41981-2 | kcal |
| Stress Score (Garmin/Fitbit proprietary) | N/A (custom) | 0-100 |

---

## 5. PATIENT DASHBOARD — V6 SCREENS

### 5.1 Health Summary Home (`/dashboard`)
```
┌────────────────────────────────────────────────────────────┐
│  Good morning, Rahul          Today: Tue 18 Mar 2026       │
├────────────────────────────────────────────────────────────┤
│  ❤️ 68 bpm (resting)  🩸 98% SpO2  👣 4,823 steps today  │
│  From: Fitbit Charge 6 · synced 12 min ago                 │
├────────────────────────────────────────────────────────────┤
│  ⚠️  Health Alert: Your resting HR has been elevated       │
│     for 3 days (avg 82 bpm vs. your baseline 68 bpm)       │
│     [View Trend]  [Ask Health Coach]                        │
├────────────────────────────────────────────────────────────┤
│  Next Appointment: Dr. Anjali Mehta · Thu 20 Mar · 10am    │
│  Cardiology · Max Hospital Bangalore                        │
│  [Get Pre-Visit Brief]  [Join Video Call]                   │
├────────────────────────────────────────────────────────────┤
│  Quick Actions:                                             │
│  [🤖 Ask Health Coach]  [📋 Health Timeline]               │
│  [📄 Upload Report]     [🔗 Connect Device]                 │
│  [📅 Book Appointment]  [💊 My Medications]                 │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Health Coach (`/dashboard/health-coach`)
```
┌────────────────────────────────────────────────────────────┐
│  🤖 EasyHeals Health Coach           [New Chat]  [History] │
├────────────────────────────────────────────────────────────┤
│  Context: ● Fitbit ● 3 lab reports ● 2 clinic visits       │
│                                                             │
│  Coach: Based on your health history, you have Type 2      │
│         diabetes (diagnosed Jan 2025) and are currently     │
│         on Metformin 500mg. Your last HbA1c (15 Feb)       │
│         was 7.2% — within target range.                     │
│                                                             │
│         Your fasting glucose readings from your CGM         │
│         this week average 138 mg/dL. That's slightly        │
│         above your target of <130 mg/dL. Want me to         │
│         suggest some dietary adjustments?                   │
│                                                             │
│  You:  [ _________________________________ ] [Send ▶]       │
│                                                             │
│  Suggested: "Explain my last HbA1c result"                  │
│             "What should I watch before my cardiologist?"   │
│             "Show my BP trend last 30 days"                 │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Health Timeline (`/dashboard/health-timeline`)
```
┌────────────────────────────────────────────────────────────┐
│  Health Timeline                [Filter ▼]  [Export PDF]   │
├────────────────────────────────────────────────────────────┤
│  📍 Mar 15, 2026  Lab Report (uploaded)                     │
│     CBC + Lipid Panel · Path Lab, Bangalore                 │
│     LDL: 142 mg/dL ⚠️  Triglycerides: 180 mg/dL           │
│     [View Full Report]                                      │
│                                                             │
│  🏥 Feb 28, 2026  EMR Visit — Dr. Mehta                    │
│     Chief Complaint: Chest tightness                        │
│     Diagnosis: Hypertension (I10)                           │
│     Prescribed: Amlodipine 5mg                              │
│                                                             │
│  ⌚ Feb 2026   Device Readings (Fitbit)                     │
│     Avg HR: 74 bpm · Avg Sleep: 6h 12min · 7,234 steps/day │
│     [View All Readings]                                     │
│                                                             │
│  💊 Jan 10, 2026  Prescription (uploaded)                   │
│     Metformin 500mg BD · Atorvastatin 10mg OD              │
│     Dr. S. Roy · Fortis Hospital                            │
└────────────────────────────────────────────────────────────┘
```

### 5.4 Devices (`/dashboard/devices`)
```
┌────────────────────────────────────────────────────────────┐
│  Connected Devices                     [+ Connect Device]  │
├────────────────────────────────────────────────────────────┤
│  ✅ Fitbit Charge 6 · Last sync: 12 min ago                │
│     Syncing: HR, HRV, Sleep, Steps, SpO2, Stress           │
│     [Sync Now]  [Disconnect]                                │
│                                                             │
│  ✅ Libre CGM · Last reading: 5 min ago                    │
│     Glucose: 124 mg/dL (within range)                       │
│     [View Trends]  [Disconnect]                             │
│                                                             │
│  ○ Apple Health  — [Connect →]                              │
│  ○ Google Health — [Connect →]                              │
│  ○ Garmin        — [Connect →]                              │
│  ○ Withings      — [Connect →]                              │
│  ○ Manual Entry  — [Add Reading]                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. PROVIDER DASHBOARD V6 ADDITIONS

### 6.1 Pre-Visit Brief Panel (Doctor Dashboard)
```
┌────────────────────────────────────────────────────────────┐
│  Today's Schedule                                           │
├────────────────────────────────────────────────────────────┤
│  10:00 AM  Rahul Sharma  (Online)  ✅ Confirmed            │
│  🤖 AI Brief Ready                                          │
│  ─────────────────────────────────────────────────────     │
│  PATIENT BRIEF — Rahul Sharma, 45M                         │
│  Reason: Follow-up cardiac evaluation                       │
│  Active Conditions: T2DM (Jan 2025), HTN (Feb 2026)        │
│  Current Meds: Metformin 500mg, Amlodipine 5mg             │
│  Last Visit: Feb 28 — noted chest tightness, started       │
│              Amlodipine                                      │
│  Recent Labs: LDL 142 ⚠️, Triglycerides 180 ⚠️ (Mar 15)  │
│  Device Data: Fitbit — avg resting HR 82 bpm last 3 days   │
│               (elevated vs. 68 bpm baseline) ⚠️            │
│  ─────────────────────────────────────────────────────     │
│  [Start Call]  [Open EMR]  [Add Notes]                      │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Conversion Analytics (`/portal/hospital/analytics`)
```
Metrics (last 30 days):
  Profile Views: 1,247  →  Appointment Clicks: 312 (25%)
  Bookings: 89  →  Completed: 71 (80%)
  Est. Revenue Attributed: ₹3,55,000

  Top Search Terms Leading to Profile: cardiology, heart specialist, chest pain
  Avg Patient Rating: 4.6/5 (from 23 ratings)

  Lead Score Distribution: 34 high (>70), 41 medium, 14 low
```

---

## 7. DATA GOVERNANCE & DPDP COMPLIANCE

### 7.1 New Consent Purposes (v6)
```
health_document_processing  — Process uploaded documents with AI
health_memory_storage       — Store longitudinal health events
ai_health_coach             — Use health data for AI conversations
device_data_sync            — Sync and store wearable/device data
provider_previsit_brief     — Share health summary with booked doctor
health_data_export          — Generate and download health record PDF
family_health_management    — Manage another person's health records
```

### 7.2 Data Minimization
- Device data: only sync types patient explicitly enables per device
- Health Memory: patient can exclude specific document types from AI context
- Pre-Visit Brief: patient explicitly approves each brief (opt-in per appointment)
- Coach context: patient can clear memory or start fresh conversation anytime

### 7.3 Retention Schedules
| Data Type | Retention | Basis |
|---|---|---|
| Health observations | 7 years from recording | DPDP Schedule 1 (medical records) |
| AI conversations | 1 year, then patient-controlled | User preference |
| Documents | Indefinite until patient deletes | Patient-owned |
| Device OAuth tokens | Until disconnected | Operational necessity |
| Pre-visit briefs | 7 years (part of medical record) | Medical record obligation |

---

## 8. FEATURE FLAGS (P5–P7)

```typescript
// New flags (OFF by default, enable per pilot)
health_document_upload      // P5.1 — document OCR + extraction
health_memory               // P5.2 — timeline aggregation
ai_health_coach             // P5.3 — Gemini conversation
previsit_briefs             // P5.4 — doctor pre-visit brief generation
device_fitbit               // P6.1 — Fitbit OAuth + sync
device_google_health        // P6.1 — Google Health Connect
device_apple_health         // P6.1 — Apple Health (app only)
device_dexcom               // P6.1 — Dexcom CGM
care_navigation             // P6.2 — symptom triage + matching
conversion_analytics        // P6.3 — hospital ROI dashboard
smart_lead_scoring          // P6.3 — AI lead scoring
patient_premium             // P7.2 — patient Health+ subscription
family_profiles             // P7.3 — family health management
lab_integration             // P7.4 — Apollo/SRL/Metropolis lab sync
instant_teleconsult         // P7.5 — "see a doctor now" flow
```

---

## 9. IMPLEMENTATION PRIORITY ORDER

```
P5 (3 weeks):
  Week 1: DB schema + health_memory_events + document upload API + R2/Blob storage
  Week 2: Gemini document extraction + health timeline UI + Health Coach API
  Week 3: Pre-visit brief generation + Doctor dashboard integration + consent gates

P6 (4 weeks):
  Week 1: Device connection OAuth + Fitbit + Google Health Connect
  Week 2: Device sync cron + health_observations + anomaly detection
  Week 3: Care Navigation Engine (triage API + provider matching + cost ranges)
  Week 4: Conversion analytics dashboard + smart lead scoring

P7 (4 weeks):
  Week 1: Patient premium subscription (Razorpay recurring) + family profiles
  Week 2: Lab integration (Apollo Diagnostics API) + pharmacy fulfillment
  Week 3: Instant teleconsult marketplace + AI SOAP note generation
  Week 4: Native mobile app shell (React Native) + HealthKit integration
```

---

## 10. TECHNICAL DECISIONS & TRADE-OFFS

| Decision | Choice | Rationale |
|---|---|---|
| Health observations storage | SQLite/Turso main DB | Keeps stack simple; optimize to TimescaleDB (Neon) in P7 if >100M rows |
| Device OAuth token storage | AES-256-GCM in SQLite | Same pattern as phone encryption; no new infra |
| AI context injection | Build fresh per request | Ensures latest data; no stale cache risk for medical context |
| Document storage | Cloudflare R2 (presigned URLs) | Consistent with existing file storage pattern |
| Apple Health web | Export upload (P5), native SDK (P7) | Web Bluetooth doesn't cover HealthKit; native app needed for real-time |
| FHIR alignment | Observation schema only, not full FHIR server | Good enough for interoperability without HAPI FHIR complexity |
| AI conversation storage | Encrypted messages in SQLite | Consistent with EMR encryption pattern; no separate vector DB yet |
| Gemini token limits | 200 events max in health context (~30K tokens) | Fits in 1M token window with room for conversation history |

---

*This document should be updated after each P5/P6/P7 sprint with actual implementation notes.*
*Next review: after P5 Week 1 implementation begins.*
