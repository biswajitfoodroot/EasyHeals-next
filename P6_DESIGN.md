# EasyHeals P6 — Design Plan

**Goal:** Care Navigation Engine + Wearable Integration + Conversion Analytics
**Builds on:** P5 (AI Health Memory, Health Coach, Gamification, Session Sliding Window)
**Stack:** Next.js App Router, Drizzle/Turso, Gemini AI, existing RBAC + patient session infra

---

## P6 Feature Capsules (flag-gated, plug-in/plug-out)

| Flag | Feature | Default |
|---|---|---|
| `care_nav` | Care Navigation Engine (smart provider match) | OFF |
| `wearable_sync` | Wearable data ingestion (Google Health Connect / Apple Health) | OFF |
| `conversion_analytics` | Funnel analytics dashboard for admins | OFF |
| `smart_reminders` | AI-generated medication + appointment reminders | OFF |
| `referral_engine` | Refer-a-friend with tracked attribution | OFF |
| `provider_insights` | Doctor/hospital analytics portal | OFF |

---

## F1 — Care Navigation Engine (`care_nav`)

**What:** Patients describe symptoms/needs → AI ranks matched providers → patient books directly.
**Why:** Core to EasyHeals becoming a true care navigation platform, not just a directory.

### API
- `POST /api/v1/care-nav/match`
  Body: `{ symptoms: string; preferredCity?: string; budget?: number; appointmentType?: string }`
  Logic: Gemini extracts specialty tags → vector search over hospital specialties + ratings + packages → return ranked `ProviderMatch[]`
  Response: `{ matches: [{ hospitalId, doctorId?, score, matchReason, estimatedFee, nextSlot }] }`

- `GET /api/v1/care-nav/history`
  Patient's past navigation sessions (encrypted)

### DB Tables
```sql
care_nav_sessions (
  id, patient_id, symptoms_enc TEXT,       -- AES encrypted
  matched_provider_ids JSON,               -- [hospitalId, ...]
  selected_provider_id TEXT,               -- did patient book?
  outcome TEXT,                            -- 'booked' | 'abandoned' | 'external'
  created_at TIMESTAMP_MS
)
```

### UI (`/dashboard/care-nav` or as bottom sheet on home)
- **Symptom input** — large textarea + voice (Web Speech API)
- **Quick chips** — "Chest pain", "Fever", "Knee pain", "Eye checkup", "Dental"
- **Match cards** — hospital name, specialty match reason, estimated fee, distance, "Book Now" CTA
- **Animated thinking state** — "Finding best providers for you..."
- **Feature-gated** — `FeatureGate flagKey="care_nav"` wraps the whole section

---

## F2 — Wearable Integration (`wearable_sync`)

**What:** Pull step count, heart rate, glucose readings from Google Health Connect (Android) / Apple Health (iOS) via Web APIs or deep link.
**Why:** Enriches AI Health Memory with continuous passive data; powers smarter coach responses.

### Architecture
- **Phase A (P6):** Manual import via JSON export (Google Takeout or Apple Health export). Patient uploads file → server parses → stores as `device_reading` health memory events.
- **Phase B (P7, React Native):** Native `@react-native-health` + `react-native-health-connect` for live sync.

### API
- `POST /api/v1/patients/wearable-import`
  Accepts multipart JSON file (Google Health Connect export or Apple Health XML)
  Flag: `wearable_sync`
  Parses: steps, heart_rate, blood_glucose, weight, sleep — maps to `healthMemoryEvents` with `source: "device"`
  Awards: `+20 pts` via gamification event `WEARABLE_SYNC`

- `GET /api/v1/patients/wearable-summary`
  Returns last 30 days of device readings aggregated by type

### UI (new tab in Health Hub or section in Timeline)
- **Import button** — "Connect Wearable Data" → file picker (JSON/XML)
- **Sync status card** — last sync time, total readings imported
- **Trend charts** — 7-day sparklines for steps, heart rate, glucose (inline SVG, RN-ready)
- **"Pair Device" placeholder** for Phase B (shows "Coming via mobile app")

### New gamification event
Add `WEARABLE_SYNC` to `PhaseAEventType` in `award.ts` — 20pts, once per week.

---

## F3 — Conversion Analytics (`conversion_analytics`)

**What:** Admin dashboard showing full funnel: search → profile view → booking → completion → review.
**Why:** Business intelligence for growth team; identifies drop-off points.

### DB Tables
```sql
funnel_events (
  id, session_id TEXT,                  -- anonymous browser session
  patient_id TEXT,                      -- nullable (pre-auth events)
  event_type TEXT NOT NULL,             -- 'search' | 'profile_view' | 'cta_click' | 'booking_start' | 'booking_complete' | 'review_submitted'
  entity_type TEXT,                     -- 'hospital' | 'doctor' | 'treatment'
  entity_id TEXT,
  metadata JSON,                        -- search query, UTM params, etc.
  created_at TIMESTAMP_MS
)
```

### API
- `POST /api/public/track` — anonymous event ingestion (no auth, rate-limited by IP)
  Body: `{ event, entityType?, entityId?, sessionId, metadata? }`
- `GET /api/admin/analytics/funnel` — admin-only, aggregated funnel data with time range filter
- `GET /api/admin/analytics/top-performers` — hospitals/doctors with best booking conversion

### Admin UI (new "Analytics" tab in AdminDashboardClient)
- **Funnel chart** — horizontal bar showing conversion at each stage (SVG inline)
- **Date range picker** — last 7d / 30d / 90d / custom
- **Top hospitals table** — sorted by conversion rate
- **Real-time visitor count** (SSE from `/api/admin/analytics/live`)

### Client-side tracking
- Tiny `track()` helper in `src/lib/analytics/track.ts` — batches events, fires on idle
- Add to: hospital profile page (profile_view), search results (search), booking modal (booking_start, booking_complete)

---

## F4 — Smart Reminders (`smart_reminders`)

**What:** AI-generated push/WhatsApp reminders for medications (from health memory) and upcoming appointments. Adapts timing based on patient behavior signals.

### API
- `GET /api/v1/patients/reminders` — list active reminders
- `POST /api/v1/patients/reminders` — create/update reminder preference
- `POST /api/cron/smart-reminders` — daily cron: generates WhatsApp messages via existing notification infra

### DB
```sql
patient_reminders (
  id, patient_id, reminder_type TEXT,  -- 'medication' | 'appointment' | 'checkin' | 'lab_followup'
  title TEXT, body_enc TEXT,            -- AES encrypted
  schedule_cron TEXT,                   -- cron expression e.g. "0 8 * * *"
  channel TEXT,                         -- 'whatsapp' | 'push' | 'both'
  is_active BOOLEAN,
  last_sent_at TIMESTAMP_MS,
  created_at TIMESTAMP_MS
)
```

### AI Component
- Weekly synthesis job reads patient's `healthMemoryEvents` for active medications → auto-creates reminders
- Personalized timing: if patient checks in at 8am daily → schedule medication reminders at 7:55am
- `POST /api/cron/synthesize-reminders` (runs weekly)

### UI (new "Reminders" section in Profile or Health Hub)
- **Active reminders list** — medication name, schedule, channel badge (WhatsApp/Push)
- **Toggle active/inactive** — one tap
- **AI-suggested reminders** — "We noticed Metformin in your prescriptions. Add a reminder?"
- **Time picker** — accessible, mobile-first wheel picker

---

## F5 — Referral Engine (`referral_engine`)

**What:** Patients get a unique referral link → referred friend gets 1 free week of Health+ → referrer earns 200 pts + commission credit.

### API
- `POST /api/v1/patients/referral/generate` — create unique code, store in DB
- `GET /api/v1/patients/referral/stats` — referral count, points earned, conversions
- `GET /api/public/r/[code]` — public redirect with UTM + attribution tracking
  Sets `ref_code` cookie → captured on registration

### DB
```sql
referral_codes (
  id, patient_id, code TEXT UNIQUE,
  total_clicks INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  points_awarded INT DEFAULT 0,
  created_at TIMESTAMP_MS
)

referral_conversions (
  id, code_id, referred_patient_id, converted_at TIMESTAMP_MS
)
```

### UI (Rewards tab in Health Hub — RewardsTab.tsx)
- Referral card below leaderboard: "Refer a Friend — earn 200 pts"
- Shareable link with copy button + WhatsApp share deep link
- Conversion stats: "3 friends joined · 600 pts earned"

---

## F6 — Provider Insights Portal (`provider_insights`)

**What:** Hospital/doctor admin can see their own analytics: profile views, booking conversion, rating trends, appointment completion rate.

### API
- `GET /api/portal/insights/hospital` — hospital_admin role, own hospital stats
- `GET /api/portal/insights/doctor` — doctor role, own profile stats

### DB (extend existing funnel_events)
- Filter by `entity_id` = hospitalId/doctorId

### UI (Hospital Portal + Doctor Portal)
- **Metrics row** — Profile Views | Booking Rate | Avg Rating | Completion Rate
- **30-day trend sparkline** — views and bookings over time
- **Recent bookings table** — anonymized (no patient PII shown to providers)

---

## P6 DB Migration Summary

New tables to add to `schema.ts`:
1. `care_nav_sessions` — care navigation match history
2. `funnel_events` — anonymous + authenticated conversion events
3. `patient_reminders` — smart reminder schedules
4. `referral_codes` — referral programme
5. `referral_conversions` — attribution tracking

New columns:
- `patients.referralCodeId` (FK to referral_codes)
- `userPoints` add `WEARABLE_SYNC` event to gamification config

New feature flags (add to `P5_FLAGS` → rename to `ALL_FLAGS`):
```typescript
"care_nav", "wearable_sync", "conversion_analytics",
"smart_reminders", "referral_engine", "provider_insights"
```

---

## P6 Implementation Order

### Week 1 — Foundation
1. Add P6 feature flags to `feature-flags.ts`
2. Add P6 DB tables to `schema.ts`
3. Build Care Navigation Engine API + basic UI (highest user value)
4. Add `track()` helper + instrument key pages

### Week 2 — Engagement
5. Build Referral Engine API + RewardsTab referral card
6. Build Smart Reminders cron + preferences UI
7. Build Wearable import (JSON file ingestion)

### Week 3 — Analytics + Portal
8. Build Conversion Analytics admin tab
9. Build Provider Insights portal pages
10. Wearable Phase A charts in Health Hub

---

## Key Architectural Decisions

**1. Care Nav uses existing vector infrastructure**
`vectorSearch()` from P5 queries hospital specialty embeddings. Hospital descriptions get embedded on ingestion (add to `extractStructuredFromSources`). No new embedding infra needed.

**2. Funnel events are anonymous-first**
`session_id` (UUID in localStorage/cookie) bridges pre-auth and post-auth events. Patient ID populated retroactively on login/OTP via `UPDATE funnel_events SET patient_id = $1 WHERE session_id = $2`.

**3. Smart Reminders use cron + outbox pattern**
Cron writes to `outbox_events` table → existing outbox processor delivers via WhatsApp/push. No direct API calls from cron.

**4. Referral code is short alphanumeric**
`nanoid(8)` — e.g. `RJWX4P2K`. Validated on registration, sets `ref_code` cookie for 30 days. Conversion recorded on first appointment booking.

**5. Wearable data is stored as `device_reading` health memory events**
Same schema, same RAG pipeline. Coach automatically gets wearable context. No new AI plumbing.

---

## Success Metrics (P6)

| Metric | Target |
|---|---|
| Care Nav match accuracy | > 80% specialty match (manual review) |
| Wearable import adoption | > 15% of Health+ users import at least once |
| Referral conversion rate | > 20% of referred users complete first appointment |
| Funnel visibility | Admin can see all 6 stages with < 2h delay |
| Reminder open rate | > 60% (WhatsApp has 98% open rate baseline) |
