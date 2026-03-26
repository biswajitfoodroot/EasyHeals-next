# EasyHeals — Phase-by-Phase Build Plan
## Document Version: 1.3 | Updated: 2026-03-17 | Based on: HLD v4.0 + PLAN.md v4.0 + ARCHITECTURE.md v1.2 + INTEGRATION_PLAN.md v1.0

> **Purpose**: Confirmation document. Every phase is summarised below with its goal, scope, and
> dependencies. Review and confirm before implementation begins on each phase.

---

## 🟢 PHASE 1 — COMPLETE (2026-03-17)

| Day | Status | Tasks |
|-----|--------|-------|
| Day 0 | ✅ COMPLETE | 6/6 security hardening tasks |
| Day 1 | ✅ COMPLETE | Tasks 1.1–1.6 (schema, infra, errors, flags, health) |
| Day 2 | ✅ COMPLETE | Tasks 2.1–2.6 (consent, leads, trust, search, moderation) |
| Day 3 | ✅ COMPLETE | Tasks 3.1–3.11 (UI, OTP, admin config, SEO, privacy) |
| Tests | ✅ 11/11 passing | 3 mandatory integration test suites |

**P1 Gate — code-complete items:**
- [x] Consent gate cannot be bypassed — integration test passing
- [x] OTP flood protection — integration test passing
- [x] Right to erasure (DELETE /api/v1/patients/me) — integration test passing
- [x] /api/book rate-limited + Deprecation/Sunset headers
- [x] Twilio provider implemented

**P1 Gate — ops tasks before P2 flags activate:**
- [ ] Twilio account live + test SMS received on real device
- [ ] Consent gate verified in staging with real patient flows
- [ ] Pilot hospitals onboarded and profiles verified

**Next: CRM Integration (Phases A–F) → then Phase 2 review session.**

---

## 🔗 CRM INTEGRATION — IN PROGRESS (~2 dev-days)

> A fully-featured EasyHeals CRM exists at `C:\Biswajit\Antigravity Google\EasyHeals`.
> Both systems use Turso + Drizzle + the same env var names → **one shared DB, two services**.
> Full task breakdown: `PLAN.md §CRM INTEGRATION` and `INTEGRATION_PLAN.md`.

| Phase | Goal | Status |
|-------|------|--------|
| **A — DB Consolidation** | Snapshot DBs, extend CRM schema (hospitals/doctors/leads), apply Next.js migrations, unify .env | ⬜ Not started |
| **B — Lead Bridge** | Patient leads get CRM refId + appear in CRM Kanban automatically | ⬜ Not started |
| **C — WhatsApp** | Replace MSG91 stub with CRM's live Meta WA API for OTP + confirmation | ⬜ Not started |
| **D — Data Unification** | CRM is master for hospitals/doctors; FTS5 triggers auto-sync search index | ⬜ Not started |
| **E — Auth Bridge** | Deferred — keep separate auth for now | 🔒 Deferred |
| **F — Cron + Observability** | Vercel cron processes outbox; unified .env template; smoke test | ⬜ Not started |

**Gate before Phase 2**: INT Phase A–F complete + smoke test F.3 all green.

### CRM Assets Available Immediately (no rebuild needed in P2)
| Asset | P2 Impact |
|-------|-----------|
| `appointments` table (CRM) | Extend with patient_id/type — no new table |
| WhatsApp Meta API (CRM, live) | Appointment confirmations, reminders — replace MSG91 |
| S3 + Vercel Blob (CRM) | Patient doc upload — proxy via CRM internal API |
| Invoice + PDF generation (CRM) | All leads incl. patient-submitted |
| Agent portal (CRM) | Unchanged — agent leads land in shared DB |
| BullMQ task queue (CRM) | Processes Next.js outbox events |
| Provider analytics (CRM, Recharts) | Expose as portal read-only view |

---

## What Already Exists (Do Not Rebuild)

| Area | What's Live |
|------|-------------|
| App shell | Next.js App Router + Drizzle ORM + Turso (SQLite/libSQL) + Tailwind CSS 4 |
| Data | Hospital, doctor, treatment profile pages with ISR + SEO + JSON-LD |
| Admin | Full admin dashboard: ingestion, AI research, brochure, contributions, access tabs |
| Portal | Hospital admin + doctor self-service portal |
| Auth | Admin/portal session auth + Google OAuth for contributors |
| Lead capture | `/api/book` endpoint (raw, unprotected — to be rate-limited in Day 0) |
| AI | Gemini 2.5 Flash: search intent, brochure extraction, research agent |

---

---

## DAY 0 — Pre-Sprint: Fix Live Vulnerabilities

> **Goal**: Harden the existing codebase before writing any new feature code.
> These are live issues that must be resolved first — they affect production security and DPDP compliance.

| Task | Problem | Fix |
|------|---------|-----|
| 0.1 | Session tokens stored as plain UUID in DB — a DB leak exposes all active sessions | Store SHA-256 hash in DB; send raw token to client only |
| 0.2 | Middleware only checks cookie existence, not validity | Document as redirect-only guard; actual auth stays in route handlers |
| 0.3 | `/api/book` is public, no rate limit, no consent, stores raw phone | Add IP rate limiting (5/hour); add deprecation headers |
| 0.4 | Audit log writes raw phone numbers — violates ARCHITECTURE.md §L.2 | `phiSafeChanges()` helper redacts phone/name before any `writeAuditLog()` call |
| 0.5 | Old leads store raw phone; new patients table uses phone_hash — two identity systems | One-time migration script: hash all existing `leads.phone` → create/link `patients` rows |
| 0.6 | Gemini client instantiated 12 times with no timeout — one hung call = dead request | Singleton `getGeminiClient()` + `generateWithTimeout(8000ms)` + in-memory token counter |

**Output**: Safe, hardened codebase ready for new feature development.

---

---

## PHASE 1 (P1) — DPDP-Compliant Lead Platform

> **Goal**: Launch a legally compliant, consent-first healthcare lead platform.
> No patient PII is captured without explicit consent. Every lead is linked to a verified patient.
> The platform is audit-ready for DPDP Act 2023.

**Timeframe**: 3 development days (after Day 0 completes)

---

### DAY 1 — Schema + Infrastructure Foundation

> Build the complete database schema for all phases upfront (add-only approach prevents future
> breaking migrations). Build the error/flag/health/infra layer that every API depends on.

| Task | What Gets Built |
|------|----------------|
| 1.1 | **14 new DB tables**: `patients`, `consent_records`, `user_points`, `point_events`, `badges`, `user_badges`, `streaks`, `gamification_config`, `abuse_flags`, `system_config`, `feature_flags`, `analytics_events`, `payment_transactions`, `specialty_synonyms` + **FTS5 virtual tables** (`hospitals_fts`, `doctors_fts`) + stub columns on existing `leads`, `hospitals`, `sessions` tables |
| 1.2 | Run 6 migration files + seed: feature flags (P1 ON / P2-P5 OFF), rate limits, point values, default badges, all 7 RBAC roles |
| 1.2b | Refactor existing `gemini.ts`, `session.ts`, `rbac.ts`, `audit.ts` → `src/lib/*` module structure. All 12 Gemini call sites migrate to `getGeminiClient()` singleton |
| 1.3 | `AppError` class + 40 typed error codes (14 prefixes: AUTH, CONSENT, SEARCH, LEAD, BOOK, AI, NOTIFY, PHI, GAME, INGEST, CRM, RATE, DB, SYS) + `withErrorHandler()` wrapper + Sentry PHI-safe reporting |
| 1.4 | Feature flag system: DB → Redis cache (60s TTL) → hardcoded defaults fallback. All P2/P3/P4/P5 flags default OFF |
| 1.5 | `GET /api/health`: db status + redis status + ai status + active features + AI token usage stats |
| 1.6 | Core modules: Redis singleton (Upstash), AES-256-GCM phone encryption, OTP (generate/hash/verify), CRM outbox, PHI-safe structured logger, FTS5 search provider |

---

### DAY 2 — Core APIs: Consent + Lead Gate + Trust + Search

> Make the platform DPDP-compliant end-to-end. Add trust signals that help patients choose hospitals.

| Task | API / Component | What It Does |
|------|----------------|--------------|
| 2.1 | `POST /api/v1/consent` | Creates consent records per purpose. Requires verified patientId (OTP must come first). Purposes: booking_lead, analytics, marketing, ai_health, emr_access |
| 2.2 | `POST /api/v1/leads` | New consent-gated lead API. Flow: hash phone → find/create patient → check consent → check duplicate → check hospital active → insert lead. Replaces `/api/book` |
| 2.3a | `TrustBadges.tsx` + Admin form + FTS7 | **Accreditation field already exists in DB.** Admin form gets multi-select (NABH/NABL/JCI/ISO 9001 etc.). Hospital portal can also update accreditations. FTS5 expanded to 7 fields (name, city, description, specialties, facilities, **accreditations**, address) so "NABH hospital Bangalore" searches work. `TrustBadges.tsx` renders badges on hospital + doctor profiles. |
| 2.5 | `POST /api/v1/search/intent` + `GET /api/v1/search/suggest` | Full NLU pipeline: language detection → Gemini intent extraction → FTS5 query → ranked results. Redis cache (5min). Rate limited. Hindi/English support |
| 2.6 | `POST /api/v1/moderation/:id/approve\|reject` | Ingestion provenance review queue. Admin/Advisor only. Applies approved value to live DB. Logs to audit trail |

> **Gamification schema** (tables + `actorId`/`actorType` pattern) is created in Task 1.1 as
> cheap DDL to prevent future breaking migrations. **Gamification APIs are deferred to P2** —
> the feature will be validated as a user acquisition driver before investing in the full engine.

---

### DAY 3 — UI + Patient Flow + Admin + SEO + Privacy

> Build the complete patient-facing experience and harden everything for launch.

| Task | What Gets Built |
|------|----------------|
| 3.1 | **ConsentModal** — DPDP-compliant. Cannot be dismissed without a choice. Analytics checkbox unchecked by default (DPDP rule). Mobile: full-screen bottom sheet |
| 3.2 | **RequestCallbackModal** — 5-step flow: Consent → OTP → Request Details → Submit → Confirmation (+points nudge). Replaces existing AppointmentModal |
| 3.3 | **Patient OTP flow** — `POST /api/v1/auth/otp/send` + `POST /api/v1/auth/otp/verify`. Creates patient by phone hash. Redis session (24h TTL). **Real SMS via Twilio in P1** (no DLT needed). MSG91 activated in P2 after DLT registration. |
| 3.4 | **Home page: trust section + gamification placeholder** — "Why EasyHeals?" stats + recently verified hospitals (live) + `RewardsTeaser` card (visible, locked, teases P2 rewards). Feature-flagged: teaser shown when `gamification_phase_a=OFF`. |
| 3.5 | **Admin config tab** — Feature flags toggle + P2 compliance gate checklist (12 items from HLD §9.1) |
| 3.6 | **Notification providers** — Console (dev). **Twilio fully implemented in P1** (real SMS). MSG91 stub implemented, activates in P2 after DLT registration. |
| 3.7 | **SEO enhancements** — OpenGraph + Twitter cards, FAQ schema, ItemList JSON-LD, canonical, hreflang (en-IN + hi-IN) on all pages |
| 3.8 | **AI search enhancements** — Hindi transliteration, zero-results Gemini suggestion ("No cardiac surgeons in Mysore — try Bangalore 45km away"), search suggestions endpoint |
| 3.9 | **Middleware upgrade** — IP rate limiting (configurable via system_config), bot guard (honeypot + UA check), `X-Request-Id` header for tracing |
| 3.10 | **Location-aware home** — Browser geolocation → Vercel city header fallback. **AI health news** (`GET /api/v1/health-news`) — Gemini Flash tips, Redis cache 4h, consent-gated personalisation |
| 3.11 | **Patient privacy page** + `DELETE /api/v1/patients/me` (soft-delete). Hard purge cron: weekly, deletes soft-deleted patients older than 30 days |
| Tests | 3 mandatory integration tests (vitest + real SQLite in-memory): (1) Consent gate cannot be bypassed, (2) OTP flood protection, (3) Right to erasure |

**P1 Gate — before any P2 flags can activate (HLD §9.1):**
- All 3 integration tests passing
- `DELETE /api/v1/patients/me` tested end-to-end
- Twilio account live + test SMS received on real device
- Consent gate verified in staging with real flows
- `/api/book` rate-limited and deprecation headers live

---

---

## PHASE 2 (P2) — Active Healthcare Coordination

> **Goal**: Transform EasyHeals from a directory into a live coordination platform.
> Patients book real appointments. Hospitals and doctors manage their CRM. Communication moves to WhatsApp.
> Consultation Room scaffold built here (activated fully in P3).

**Dependency**: P1 compliance gate passes (12 items from HLD §9.1) + TOTP mandatory for all admin accounts.

| Area | What Gets Built |
|------|----------------|
| **Appointment Booking** | Patient books in-person or online-consultation slot for doctor or hospital. `POST /api/v1/appointments`. Slot conflict detection, confirmation flow |
| **Doctor CRM Dashboard** | Doctor portal: pending/confirmed appointments, confirm/reschedule/cancel. Configurable patient history visibility — doctor sets consent scope (e.g. last 3 visits only vs full history) |
| **Hospital CRM Dashboard** | Hospital portal: cross-doctor appointment view, daily schedule, queue management |
| **Patient Dashboard** | "My Appointments" — upcoming, past, status tracking, cancel/reschedule request |
| **Consultation Room (Placeholder)** | Schema + config locked. `consultation_room_configs` allows per-hospital/doctor setup: provider (Daily.co/Whereby/Jitsi), max participants, allowed participant types (patient/doctor/specialist/coordinator/family/interpreter), recording toggle, waiting room. UI shows locked `ConsultationRoomCard` on appointment page — "Video consultation — coming soon". Feature-flagged `consultation_room=OFF` |
| **Async Text Messaging** | Pre/post appointment notes exchange between patient and doctor. Consent-gated — doctor can only read after booking consent |
| Notifications | WhatsApp Business API (MSG91 activation after DLT). Appointment confirmations, reminders, OTP |
| Queue | Token queue live display via Redis SSE |
| Broadcast | Mass broadcast tool for hospitals |
| Gamification | **Phase-A**: `POST /api/v1/gamification/event`, `GET /api/v1/leaderboard/:city`, `LeaderboardWidget.tsx`, `StreakBadge.tsx` |
| Gamification | **Phase-B**: Verified appointment events (APPOINTMENT_BOOKED, REVIEW_SUBMITTED) |
| CRM | Event bus + webhook delivery. Outbox processor → Redis pub/sub or external CRM |
| Payments | Razorpay — patient paid membership, hospital subscription plans |
| Analytics | Provider analytics dashboard — leads, conversions, response times |
| Security | TOTP (Google Authenticator) for all admin/owner accounts |

**New P2 tables** (stubs added to Task 1.1 so no breaking migration needed):
`appointments`, `appointment_slots`, `consultation_messages`, `consultation_room_configs`, `consultation_sessions` (stub), `consultation_participants` (stub)

---

---

## PHASE 3 (P3) — Clinical Continuity + Consultation Room

> **Goal**: Extend EasyHeals from coordination into clinical continuity and live consultation.
> Patients have a longitudinal health record. Consultation Room activated — multi-participant video with configurable tiers.

**Dependency**: P3 EMR compliance gate (HLD §9.2) — data localisation, clinical data security audit, ABDM sandbox certification.

| Area | What Gets Built |
|------|----------------|
| EMR-lite | Visit records, prescriptions, vitals (weight, BP, blood sugar) — consent-gated access |
| Lab ordering | Lab test ordering + result upload. Consent required for lab to access records |
| E-prescriptions | Digital prescriptions from doctor portal → feeds into P5 pharmacy routing |
| **Consultation Room (Free Tier)** | `consultation_room_free=ON`. WebRTC via Jitsi embed. Up to 4 participants. Waiting room. No recording. Linked to appointment + EMR visit |
| **Consultation Room (Paid Tier)** | `consultation_room_paid=ON` (requires active Razorpay subscription). Provider: Daily.co or Whereby (per hospital config). Up to 10 participants. HD video + screen sharing + recording (consent per participant, R2 storage 2yr) + AI session summary (opt-in) |
| **Multi-Participant Flow** | Doctor creates session → system generates room URL → invitations sent to all participants by type: patient (required), primary doctor (required), specialist (doctor-invited), hospital coordinator (auto if enabled), family member/caregiver (patient invites up to 2), medical interpreter (hospital-assigned). Waiting room: doctor admits each participant individually |
| **Consultation Config** | Per-hospital/doctor: provider, maxParticipants, allowedParticipantTypes, recordingEnabled, waitingRoomEnabled, autoAdmit, sessionTimeoutMinutes, aiSummaryEnabled |
| Search | Typesense migration (replaces FTS5). Better relevance ranking, typo tolerance, faceted filters |
| Architecture | Turborepo monorepo migration (optional). Extract `packages/ai`, `packages/db` |

**New P3 tables**: `consultation_sessions` (full DDL), `consultation_participants` (full DDL), `consultation_recordings`

**Consultation Room Feature Flags**: `consultation_room`, `consultation_room_free`, `consultation_room_paid`, `consultation_recording`, `consultation_ai_summary`

---

---

## PHASE 4 (P4) — Network-Level Features

> **Goal**: Enable cross-hospital referrals, national health ID, and insurance integrations.
> These require data at scale and stable P3 clinical records.

**Dependency**: P3 stable in production for 3+ months.

| Area | What Gets Built |
|------|----------------|
| Referrals | Cross-hospital referral engine. Doctor A refers patient to Doctor B at another hospital with shared consent |
| ABHA/ABDM | National health ID (ABHA) integration. Patients link their ABHA ID to EasyHeals profile |
| Insurance | TPA cashless eligibility check — verify insurance coverage before appointment |

---

---

## PHASE 5 (P5) — Pharmacy Prescription Routing

> **Goal**: Connect patients with verified local pharmacies.
> EasyHeals is the routing layer only — pharmacies manage their own stock, billing, and fulfilment.
> EasyHeals does NOT hold inventory or handle GST billing.

**Dependency**: P2 (payments), P3 (e-prescriptions, optional link). Timeline: 36–54 months from P1 launch.

### Core Flow
```
Patient uploads prescription (photo/PDF)
    ↓
System finds nearby verified pharmacies (GPS / PIN radius)
    ↓
Each pharmacy reviews: can supply? price estimate? ready by when?
    ↓
Patient selects pharmacy + chooses pickup or delivery
    ↓
Delivery cascade:
  City    → Pharmacy own riders (first choice)
  City    → Porter API (fallback)
  Rural   → Shadowfax API
    ↓
Prescription data retained 2 years (DPDP compliance + analytics)
```

| Area | What Gets Built |
|------|----------------|
| Onboarding | Pharmacy registration + drug licence verification workflow (manual ops review) |
| Prescription | Upload flow (R2 storage) + Gemini OCR extracts `medicines_raw` (best-effort, non-clinical) |
| Quoting | Pharmacy quote interface — can supply / price / ready-by time |
| Delivery | Porter API + Shadowfax API integration. Serviceability check before confirmation |
| New tables | `pharmacies`, `prescription_requests`, `prescriptions`, `pharmacy_quotes`, `delivery_assignments` |
| New role | `pharmacy_admin` |
| Feature flags | All OFF from P1: `pharmacy_onboarding`, `prescription_ordering`, `pharmacy_own_delivery`, `delivery_porter`, `delivery_shadowfax`, `emr_prescription_link`, `pharmacy_analytics` |

**P5 Gate Checklist** (before any flag turns ON):
- [ ] Drug licence verification workflow live (manual ops)
- [ ] Prescription retention policy confirmed (R2, 2-year, DPDP consent)
- [ ] Porter + Shadowfax APIs tested end-to-end
- [ ] Pharmacy quote → accept → fulfilment flow tested

---

---

## Confirmed Decisions (2026-03-14)

| # | Question | Decision |
|---|---------|---------|
| 1 | Accreditation data populated? | `hospitals.accreditations` field already exists in schema. **Not yet populated** — admin hospital add/edit form will get a multi-select (NABH/NABL/JCI/ISO 9001 etc.) in Task 2.3a. Hospital portal also updated. FTS5 expanded to 7 fields including accreditations + address + facilities. |
| 2 | Gamification APIs P1 or P2? | **Schema in P1, APIs in P2.** UI placeholder (`RewardsTeaser` component) ships in P1 — visible but locked, teases the feature. Live `LeaderboardWidget` + `StreakBadge` in P2, feature-flagged. |
| 3 | Real SMS OTP in P1? | **Yes — Twilio in P1.** MSG91 requires Indian DLT registration (2–4 weeks). Twilio activated immediately, no DLT needed. P2 migrates to MSG91 (cheaper) after DLT registration completes — one env var change. Pre-launch gate: Twilio account + test SMS verified. |
| 4 | Right to erasure priority? | **Confirmed P1.** `DELETE /api/v1/patients/me` + soft-delete + 30-day purge cron ships in Task 3.11. Integration test mandatory before P2 flags activate. |
| 5 | P1 launch type? | **Soft launch (pilot hospitals only).** Not a full public launch. Allows controlled testing with known hospitals before open rollout. |

---

## Open Questions

5. ~~**P1 launch definition**~~ — **Confirmed: Soft launch (pilot hospitals only).** No load testing required before P1 ship. Integration tests still mandatory (consent gate, OTP flood, right to erasure).

---

*Document version 1.1 | Updated: 2026-03-14*
*Source: PLAN.md v4.0 + ARCHITECTURE.md v1.2 + HLD v4.0 + technical_design_review.md*
