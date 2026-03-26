# EasyHeals P1 Implementation Plan
## Version: 4.0 | Created: 2026-03-13 | Updated: 2026-03-13 | HLD Ref: v4.0
## Cross-phase compatibility verified against P1/P2/P3/P4/P5. Full HLD §0–§12 cross-check applied.
## v4.0: Technical design review applied — pre-sprint security tasks added (B1/B2/B3/B4), gamification
## APIs deferred to P2, actorId/actorType replaces dual-FK pattern, FTS5 DDL added, consent
## circular dependency fixed, leaderboard_cache removed (Redis-only), testing requirements added.

> **Two documents:**
> - `PLAN.md` (this file) — WHAT to build, in what order, with checkpoints
> - `ARCHITECTURE.md` — WHY, module boundaries, provider interfaces, Redis namespace, encryption

---

## ⚡ CURRENT STATUS
```
PHASE: PHASE 5 — COMPLETE ✅ (2026-03-19). HLD v6 written (2026-03-18).
LAST COMPLETED TASK: P5 — AI Health Memory, Document Intelligence, Booking Flow, i18n, Admin expansions, Rewards
NEXT TASK: P6-W1 — Wearable Integration (Fitbit OAuth, Google Health Connect, Apple Health)
PHASE RENUMBERING (HLD v6, 2026-03-19):
  P1  = Discovery + Auth + Consent + Search + Gamification foundation                        ✅ COMPLETE
  P2  = Appointments + WhatsApp + Payments + Gamification activation                         ✅ COMPLETE
  P3  = EMR + Video Consultation + Lab Orders + FCM + Typesense                              ✅ COMPLETE
  P4  = Role-Based Portal (dashboards, schedule, queue, staff, subscription)                 ✅ COMPLETE
  P5  = AI Health Memory + Document Intelligence + i18n + Admin expansions + Booking         ✅ COMPLETE
  P6  = Wearable Integration + Care Navigation + Conversion Analytics                        (HLD v6 §P6)
  P7  = Patient Premium + Family Profiles + Lab/Pharmacy + Teleconsult                       (HLD v6 §P7)
  OLD P5 (Referral/ABHA/Insurance) → ABHA absorbed into P5; Referral/Insurance → P6 Care Navigation
  OLD P6 (Pharmacy routing)        → deferred to P7 (now Lab/Pharmacy integration §P7.4)

P5 COMPLETED ITEMS (2026-03-19):
  W1: Schema (health_documents, health_memory_events, ai_conversations, document_shares, document_access_log)
      Documents upload/delete/list API, Gemini Vision extraction (async), DocumentsClient UI
  W2: Health Timeline page + API, ABHA linking (ABDM sandbox), Document sharing (patient→provider),
      Portal shared docs view, Privacy & Consent page (6 DPDP toggles), health-export JSON download
  W3: AI Health Coach (SSE streaming, Gemini, conversation history), Pre-Visit Brief (cron + internal API)
      Pre-Visit Brief patient page, Admin tabs (patients, appointments, providers)
  W4: Rewards page + API, Full booking flow /book/[providerId] (4-step), Slot generation API,
      i18n catalogs (en.json + hi.json), LanguageSwitcher component (cookie-based, flag-gated)
  FIXES: blobFetch() abstraction (no @vercel/blob static import), extract.ts uses blobFetch()

PENDING (carry to P6 prep):
  - npm install next-intl + middleware integration (URL prefix /hi/*)
  - Provider self-registration (flag-gated, W4-13)
  - AWS S3 ap-south-1 for production data residency (DPDP compliance)

ENV SETUP:
  EMR:          Set NEON_DATABASE_URL + EMR_ENCRYPTION_KEY, run: npx tsx drizzle/emr/apply-migration.ts
  VIDEO:        Set video_consultation flag ON. Optional: JITSI_APP_ID + JITSI_APP_SECRET for JWT rooms.
  PAYMENT:      Set PAYMENT_PROVIDER=razorpay + RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET, enable paid_membership flag.
  NOTIFICATION: Set NOTIFICATION_PROVIDER=msg91 + NEXT_PUBLIC_MSG91_HELLO_WIDGET_TOKEN after DLT.
  FCM:          Set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, enable push_notifications flag.
  SEARCH:       Set SEARCH_PROVIDER=typesense + TYPESENSE_HOST + TYPESENSE_API_KEY; defaults to FTS5.
  HEALTH PHI:   Set HEALTH_PHI_ENCRYPTION_KEY (32-byte hex) for health_memory_events AES-256-GCM encryption.
  BLOB:         Set BLOB_READ_WRITE_TOKEN (Vercel Blob) for patient document uploads. npm install @vercel/blob.
  ABHA:         Set ABDM_CLIENT_ID + ABDM_CLIENT_SECRET for ABHA health ID linking.
  I18N:         Enable i18n_hindi feature flag in admin. npm install next-intl for URL prefix routing (P6).
UPDATED: 2026-03-19
```

### Phase 3 Day 4 Checklist (all done ✅)
- [x] `src/app/api/v1/emr/lab-orders/route.ts` — POST (doctor creates lab order, tests array) + GET (patient reads own orders, ?status filter)
- [x] `src/app/api/v1/emr/lab-orders/[id]/result/route.ts` — PATCH: hospital staff uploads resultUrl, marks status=completed
- [x] `src/lib/search/typesense.provider.ts` — Pure fetch REST client: `searchTypesense()`, `upsertDocument()`, `deleteDocument()`, 3s timeout
- [x] `src/lib/search/index.ts` — Search factory: SEARCH_PROVIDER=typesense|fts5, graceful fallback to FTS5 on Typesense error
- [x] `src/lib/notifications/fcm.provider.ts` — RS256 service-account JWT → OAuth2 token → FCM v1 REST; `sendPushNotification()`, `sendMulticast()`
- [x] `src/lib/notifications/index.ts` — Added FCM exports: `getFCMProvider`, `FCMProvider`, `isFcmConfigured`
- [x] `src/app/api/v1/patients/device-token/route.ts` — POST (register FCM token, Redis JSON array, max 5, TTL 30d) + DELETE (unregister)

### Phase 3 Day 3 Checklist (all done ✅)
- [x] `src/lib/consultations/jitsi.ts` — HS256 JWT generator, `generateRoomName()`, `buildParticipantJoinUrl()`, `buildJoinUrl()`
- [x] `src/app/api/v1/consultations/[appointmentId]/start/route.ts` — POST: creates session + participants + returns doctor join URL
- [x] `src/app/api/v1/consultations/[sessionId]/join/route.ts` — GET: patient/staff join; waiting room gate; activates session on first join
- [x] `src/app/api/v1/consultations/[sessionId]/end/route.ts` — POST: ends session, marks participants left, completes appointment, optional EMR note
- [x] `src/app/api/v1/consultations/[sessionId]/invite/route.ts` — POST: doctor invites specialist/family/interpreter/coordinator
- [x] `src/app/api/v1/consultations/[sessionId]/admit/[participantId]/route.ts` — PATCH: admit from waiting room
- [x] `src/app/consultation/[sessionId]/page.tsx` — Server page shell
- [x] `src/app/consultation/[sessionId]/ConsultationRoom.tsx` — Client room: loading/waiting/active/ended states, Jitsi iframe, end dialog + post-visit notes
- [x] `src/components/ConsultationRoomCard.tsx` — UPGRADED: session-aware (start/join/waiting/live/ended), role-based CTA

### Phase 3 Day 2 Checklist (all done ✅)
- [x] `src/app/api/v1/emr/visits/route.ts` — POST (doctor creates, PHI encrypted) + GET (patient reads, PHI decrypted)
- [x] `src/app/api/v1/emr/prescriptions/route.ts` — POST (doctor writes medicines/instructions encrypted) + GET (patient reads)
- [x] `src/app/api/v1/emr/vitals/route.ts` — POST (patient self-report or staff, BMI computed) + GET (patient history)

### Phase 3 Day 1 Checklist (all done ✅)
- [x] `npm install @neondatabase/serverless` — Neon Postgres driver installed
- [x] `src/db/emr-client.ts` — `emrDb` singleton (Neon + Drizzle), gracefully returns null if NEON_DATABASE_URL unset
- [x] `src/db/emr-schema.ts` — Postgres schema: `visitRecords`, `prescriptions`, `vitals`, `labOrders` (stub)
- [x] `drizzle/emr/0001_p3_emr.sql` — Full DDL with PHI column comments + RLS scaffold (commented)
- [x] `drizzle/emr/apply-migration.ts` — `npx tsx drizzle/emr/apply-migration.ts` to apply against Neon
- [x] `src/lib/emr/index.ts` — Isolated module: `emrEncrypt/Decrypt/Safe()`, `isEmrConfigured()`, re-exports schema
- [x] `src/db/schema.ts` — Added P3 patient stubs: `dateOfBirth`, `gender`, `bloodGroup` (nullable)
- [x] `drizzle/fix-missing-columns.ts` — Added P3 patient column ALTER statements
- [x] `src/lib/env.ts` — Added: `NEON_DATABASE_URL`, `EMR_ENCRYPTION_KEY`, `JITSI_*`, `FIREBASE_*`, `PAYMENT_PROVIDER`
- [x] `.env.integration.example` — Added P2 Payments + P3 EMR/Jitsi/Firebase sections with comments

### Phase 2 Day 4 Checklist (all done ✅)
- [x] `src/lib/payments/provider.interface.ts` — OrderCreator, PaymentVerifier, SubscriptionManager interfaces
- [x] `src/lib/payments/razorpay.provider.ts` — Razorpay REST (no SDK): createOrder, verifyPayment (constant-time HMAC), createSubscription, cancelSubscription
- [x] `src/lib/payments/console.provider.ts` — dev stub: logs intent, always passes verify, no charge
- [x] `src/lib/payments/index.ts` — factory: PAYMENT_PROVIDER=razorpay|console (default: console)
- [x] `src/app/api/v1/payments/membership/create-order/route.ts` — consent+session gate, duplicate order check, Razorpay order, DB record
- [x] `src/app/api/v1/payments/membership/verify/route.ts` — HMAC verify, mark paid, publish membership.activated outbox event
- [x] `src/app/api/portal/analytics/route.ts` — GET: appointments by status/type/day + leads by status/source + top doctors + slot utilisation; gated by provider_analytics flag
- [x] `src/app/api/admin/broadcast/route.ts` — POST: consent-filtered recipients (marketing purpose), WA or SMS, preview mode, audit log; GET: broadcast history
- [x] `src/components/BroadcastPanel.tsx` — admin UI: compose + preview + DPDP consent confirmation + send + history table

### Phase 2 Day 3 Checklist (all done ✅)
- [x] `src/lib/config/feature-flags.ts` — added `getFeatureFlag` alias for `isFeatureEnabled` (used by route handlers)
- [x] `src/lib/gamification/award.ts` — `awardPoints()`: idempotent, capped, abuse-checked, streak-aware, milestone badges
- [x] `src/app/api/v1/gamification/event/route.ts` — POST: patient session auth, Phase-A events, proofId ownership check
- [x] `src/app/api/v1/leaderboard/[city]/route.ts` — GET: city leaderboard, Redis-cached 1h, leaderboardOptOut respected
- [x] `src/components/LeaderboardWidget.tsx` — client component: ranked list with medals, alias-highlight for viewer
- [x] `src/components/StreakBadge.tsx` — compact + card variants: flame streak, points, level, check-in button
- [x] `src/app/api/v1/patients/documents/route.ts` — POST: proxies to CRM S3/Blob, consent-gated (emr_access), 10MB limit
- [x] `src/components/ConsultationRoomCard.tsx` — locked placeholder (isEnabled=false by default, P3 flag: consultation_room)

### Phase 2 Day 2 Checklist (all done ✅)
- [x] `src/app/api/v1/auth/otp/route.ts` — encrypts phone at OTP verify → stores in patients.phoneEncrypted + Redis session
- [x] `src/app/api/v1/appointments/route.ts` — non-blocking WA confirmation after booking (feature-flagged whatsapp_notifications)
- [x] `src/app/api/v1/portal/appointments/route.ts` — doctor sees own appointments (no PII exposed); admin/advisor can filter
- [x] `src/app/api/cron/appointment-reminders/route.ts` — daily 08:30 IST cron: finds T+20h–28h appointments, decrypts phones, sendBroadcast()
- [x] `vercel.json` — added appointment-reminders cron: "0 3 * * *" (03:00 UTC = 08:30 IST)
- [x] `src/app/api/v1/hospitals/[hospitalId]/queue/route.ts` — SSE token queue: Redis-backed, 5s poll, 15s heartbeat, 5min auto-close

### Phase 2 Day 1 Checklist (all done ✅)
- [x] `src/db/schema.ts` — TOTP columns: users (totpSecret, totpEnabled, totpRecoveryCodes) + sessions (totpVerifiedAt)
- [x] `src/db/schema.ts` — appointments extended: consentRecordId, sourcePlatform, slotId, patientNotes
- [x] `drizzle/0008_p2_totp_appointments.sql` — migration for all above
- [x] `src/lib/totp.ts` — RFC 6238 TOTP (pure Node.js: generateSecret, generateUri, verifyToken, recoveryCodes)
- [x] `src/lib/errors/app-error.ts` — added AUTH_TOTP_REQUIRED, AUTH_TOTP_INVALID, AUTH_TOTP_NOT_SETUP
- [x] `src/lib/auth.ts` — TOTP gate in requireAuth (owner/admin gated); requireAuthNoTOTP for setup routes
- [x] `src/app/api/auth/login/route.ts` — returns { requiresTOTP: true } for enrolled owner/admin
- [x] `src/app/api/auth/totp/validate/route.ts` — sets sessions.totpVerifiedAt; accepts TOTP or recovery code
- [x] `src/app/api/admin/auth/totp/setup/route.ts` — generates secret + otpauth:// URI
- [x] `src/app/api/admin/auth/totp/enroll/route.ts` — confirms first code + enables TOTP + returns recovery codes
- [x] `src/app/api/v1/appointments/route.ts` — POST (consent-gated booking) + GET (patient list)
- [x] `packages/api/src/db/migrations/0002_p2_appointments.sql` — CRM appointments extension

### CRM Integration Code Checklist (all done ✅)
- [x] INT-A.2-A.4: `0001_nextjs_integration.sql` — extends CRM tables + creates P1 tables + FTS5 triggers
- [x] INT-A.7: `src/db/schema.ts` — CRM mirror fields added (hospitals, doctors, leads bridge columns)
- [x] INT-B.1: `src/app/api/v1/leads/route.ts` — `generateCrmRefId()` + CRM-compatible lead insert
- [x] INT-B.2: `apps/crm/src/pages/Leads.jsx` — Platform/Agent source badge
- [x] INT-B.4: `packages/api/src/routes/internal.js` — CRM outbox consumer (POST /v1/internal/outbox/process)
- [x] INT-C.2-C.3: `src/lib/notifications/msg91.provider.ts` — real MSG91 SMS + WA impl; factory updated (msg91 first)
- [x] INT-D.1: `packages/api/src/routes/masters.js` — slug auto-generated on hospital/doctor create
- [x] INT-F.1: `.env.integration.example` — unified env template with checklist
- [x] INT-F.2: `src/app/api/cron/outbox/route.ts` + `vercel.json` cron config (every 1 min)

### Pre-P2 MSG91 Expansion (all done ✅ — 2026-03-17)
- [x] `src/lib/notifications/provider.interface.ts` — added `SMSBroadcastSender` interface
- [x] `src/lib/notifications/msg91.provider.ts` — added `sendWhatsAppTemplate()`, `sendBroadcast()` (bulk WA), `sendSMSCampaign()` (bulk SMS)
- [x] `src/components/MSG91HelloChat.tsx` — MSG91 Hello live chat widget (client component)
- [x] `src/app/layout.tsx` — `<MSG91HelloChat />` added to root layout
- [x] `.env.integration.example` — `NEXT_PUBLIC_MSG91_HELLO_WIDGET_TOKEN` + campaign template IDs added

### Remaining ops tasks (cannot be automated):
- [ ] INT-A.1: Check row counts in both DBs → identify primary
- [ ] Take DB snapshots before migration
- [ ] Run `0001_nextjs_integration.sql` against primary DB
- [ ] Update BOTH .env files to point to primary DB (same TURSO_DATABASE_URL)
- [ ] Restart both services; verify `/v1/health` + `/api/health` → `db: ok`
- [ ] Register MSG91 DLT templates (OTP + lead confirmation) → set NOTIFICATION_PROVIDER=msg91

### Phase 1 Completion Summary (2026-03-17)
- **Day 0** — COMPLETE (6/6 security hardening tasks)
- **Day 1** — COMPLETE (Tasks 1.1–1.6: schema, migrations, seed, error framework, feature flags, health endpoint, infra libs)
- **Day 2** — COMPLETE (Tasks 2.1–2.6: consent API, consent-gated leads, trust badges, search intent/suggest, moderation)
- **Day 3** — COMPLETE (Tasks 3.1–3.11: ConsentModal, RequestCallbackModal, OTP auth, RewardsTeaser, admin config tab, notifications, SEO, search AI, middleware, geolocation, privacy/erasure)
- **Tests** — 11 integration tests across 3 mandatory suites: all passing ✅

### P1 Gate Status (HLD §9.1)
- [x] Consent gate cannot be bypassed (integration test passing)
- [x] OTP flood protection (integration test passing)
- [x] Right to erasure tested end-to-end (integration test passing)
- [x] DELETE /api/v1/patients/me implemented (soft-delete + consent revocation)
- [x] Twilio notification provider implemented (real SMS)
- [x] /api/book rate-limited with Deprecation/Sunset headers
- [ ] Twilio account live + test SMS received on real device ← **ops task before P2**
- [ ] Consent gate verified in staging with real flows ← **ops task before P2**

> **HOW TO RESUME**: Read this file, find CURRENT STATUS above, jump to that task.
> Every task has a `[CHECKPOINT]` marker — means it was committed to git and is safe to stop after.

---

---

## 🔗 CRM INTEGRATION — Phases A–F
> **Context**: A fully-featured EasyHeals CRM exists at `C:\Biswajit\Antigravity Google\EasyHeals`
> (Express.js + Drizzle + Turso). Both services already use identical env var names
> (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). Integration strategy: **one Turso DB, two services**.
> No webhooks or sync needed for core data — both read/write the same tables.
>
> Full rationale and architecture diagram: see `INTEGRATION_PLAN.md`

### CRM Stack (for reference)
```
Backend  : Express.js v5, JWT auth, BullMQ task queue, Redis (ioredis)
Frontend : Vite + React 19, Zustand, React Query, Recharts
Storage  : AWS S3 (prescriptions) + Vercel Blob (docs)
WhatsApp : Meta Business API (live — WA_ACCESS_TOKEN in CRM .env)
Email    : Nodemailer SMTP
AI       : Gemini 2.5 Flash + Anthropic SDK
DB       : Turso (libSQL) + Drizzle ORM — same as Next.js
Tables   : users, hospitals, departments, doctors, agents, leads (47 cols),
           attendants, documents, appointments, activities, invoices,
           waTemplates, auditLog (13 tables)
```

### What CRM Already Has (do not rebuild in Next.js)
| CRM Asset | Reuse path |
|-----------|-----------|
| Lead pipeline — Kanban, assignment, invoicing | Patient leads in shared DB appear in CRM automatically |
| Appointments table | P2 extends CRM's `appointments` table — no new table needed |
| WhatsApp Meta API | Replace Next.js MSG91 stub — call CRM's sendWhatsAppTemplate |
| AWS S3 document service | Call from Next.js for prescription uploads |
| Agent portal | Unchanged — agent leads land in the same shared DB |
| Invoice generation + PDF | CRM generates invoices for all leads incl. patient-submitted |
| BullMQ task queue | Process Next.js outbox events — CRM polls shared `outbox` table |
| Department taxonomy | `departments` table — Next.js reads directly |
| Activity audit trail | `activities` table — append from Next.js via internal API |
| Email notifications | CRM Nodemailer service — callable from Next.js outbox consumer |

---

### INT Phase A — Database Consolidation
> **Goal**: Both services point to one Turso DB. Schema conflicts resolved.
> **Risk**: Run all migrations against a DB snapshot first. Never migrate production cold.

#### INT-A.1 — Identify Primary DB + Take Snapshots [CHECKPOINT]
```
1. Check row counts in both DBs:
   CRM DB:     SELECT COUNT(*) FROM hospitals; SELECT COUNT(*) FROM leads;
   Next.js DB: SELECT COUNT(*) FROM hospitals; SELECT COUNT(*) FROM leads;
2. The DB with more hospitals/leads = PRIMARY
3. Export both DBs:
   turso db shell <crm-db-name>    ".dump" > crm_backup_YYYYMMDD.sql
   turso db shell <nextjs-db-name> ".dump" > nextjs_backup_YYYYMMDD.sql
4. Store backups safely before any migration
```

#### INT-A.2 — Extend CRM `hospitals` Table
**File**: `packages/api/src/db/migrations/XXXX_add_nextjs_columns.sql` (CRM repo)
```sql
ALTER TABLE hospitals ADD COLUMN slug TEXT;
ALTER TABLE hospitals ADD COLUMN specialties TEXT DEFAULT '[]';
ALTER TABLE hospitals ADD COLUMN facilities TEXT DEFAULT '[]';
ALTER TABLE hospitals ADD COLUMN accreditations TEXT DEFAULT '[]';
ALTER TABLE hospitals ADD COLUMN rating REAL DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN verified_at INTEGER;
ALTER TABLE hospitals ADD COLUMN description TEXT;
ALTER TABLE hospitals ADD COLUMN packages TEXT DEFAULT '[]';
ALTER TABLE hospitals ADD COLUMN latitude REAL;
ALTER TABLE hospitals ADD COLUMN longitude REAL;

-- Backfill slug from existing name+city
UPDATE hospitals
  SET slug = lower(replace(replace(name,' ','-'),'.',''))
           || '-' || lower(replace(city,' ','-'))
  WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hospitals_slug_idx ON hospitals(slug);
```

#### INT-A.3 — Extend CRM `doctors` Table
```sql
ALTER TABLE doctors ADD COLUMN slug TEXT;
ALTER TABLE doctors ADD COLUMN bio TEXT;
ALTER TABLE doctors ADD COLUMN languages TEXT DEFAULT '[]';
ALTER TABLE doctors ADD COLUMN fees TEXT DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE doctors ADD COLUMN rating REAL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE doctors ADD COLUMN consultation_fee INTEGER;

UPDATE doctors
  SET slug = lower(replace(name,' ','-')) || '-' || id
  WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS doctors_slug_idx ON doctors(slug);
```

#### INT-A.4 — Extend CRM `leads` Table (DPDP bridge columns)
```sql
-- Nullable — legacy CRM leads keep NULL; patient-submitted leads have values
ALTER TABLE leads ADD COLUMN patient_id TEXT REFERENCES patients(id);
ALTER TABLE leads ADD COLUMN consent_record_id TEXT REFERENCES consent_records(id);
ALTER TABLE leads ADD COLUMN phone_hash TEXT;
ALTER TABLE leads ADD COLUMN source_platform TEXT DEFAULT 'crm';
-- source_platform values: 'crm' | 'easyheals_platform' | 'agent_portal'
```

#### INT-A.5 — Apply Next.js P1 Migrations to Primary DB
```bash
# In easyheals-next — point .env.local to the primary (CRM) DB
TURSO_DATABASE_URL=<primary-db-url>
TURSO_AUTH_TOKEN=<primary-db-token>

npm run db:migrate   # runs all 8 Next.js migrations (creates 51 Next.js-only tables)
npm run db:seed:p1   # seeds feature flags, gamification config, badges
```

#### INT-A.6 — Update Both Services to Same Turso DB [CHECKPOINT]
```
CRM .env:
  TURSO_DATABASE_URL=<primary-db-url>   ← same value
  TURSO_AUTH_TOKEN=<primary-db-token>   ← same value

Next.js .env.local:
  TURSO_DATABASE_URL=<primary-db-url>   ← same value
  TURSO_AUTH_TOKEN=<primary-db-token>   ← same value
```
Verify: restart both services. `CRM /v1/health` and Next.js `/api/health` both return `db: ok`.

#### INT-A.7 — Update Next.js Schema to Reflect Merged Columns
**File**: `src/db/schema.ts`

Add CRM-only fields to Next.js `hospitals` and `doctors` table definitions (so Drizzle doesn't
drop them on select). Also add bridge columns to `leads`:
```typescript
// hospitals — add alongside existing fields:
contactPerson: text("contact_person"),
contactPhone:  text("contact_phone"),
contactEmail:  text("contact_email"),
emailIds: text("email_ids", { mode: "json" }).$type<string[]>().default(sql`'[]'`),

// doctors — add:
specialization:  text("specialization"),
experienceYears: integer("experience_years"),

// leads — add:
sourcePlatform: text("source_platform").default("crm"),
phoneHash:      text("phone_hash"),
```

---

### INT Phase B — Lead Pipeline Bridge
> **Goal**: Patient-submitted leads (Next.js) appear in CRM pipeline automatically.
> Since both services share the DB, writing to `leads` is sufficient — no webhook needed.

#### INT-B.1 — Generate CRM-Compatible refId in Next.js
**File**: `src/app/api/v1/leads/route.ts`
```typescript
// Add before lead insert — mirrors CRM's generateRefId()
async function generateCrmRefId(): Promise<string> {
  const rows = await db.execute(
    sql`SELECT MAX(CAST(SUBSTR(ref_id, 4) AS INTEGER)) as maxNum
        FROM leads WHERE ref_id LIKE 'EH-%'`
  );
  const maxNum = (rows.rows[0]?.maxNum as number | null) ?? 100000;
  return `EH-${maxNum + 1}`;
}

// In lead insert:
const refId = await generateCrmRefId();
await db.insert(leads).values({
  patientId, consentRecordId, medicalSummary,
  status: "new", score: 30,
  refId,
  phoneHash,
  hospitalId,
  sourcePlatform: "easyheals_platform",
});
```

#### INT-B.2 — CRM Lead List: Source Badge
**File**: `apps/crm/src/pages/Leads.jsx` (CRM repo)
```jsx
{lead.source_platform === 'easyheals_platform' && (
  <span className="badge badge-blue">Platform</span>
)}
{lead.source_platform === 'agent_portal' && (
  <span className="badge badge-green">Agent</span>
)}
```

#### INT-B.3 — CRM Lead Detail: Consent Status Panel
**File**: `apps/crm/src/pages/LeadDetail.jsx` (CRM repo)

New CRM route `GET /v1/leads/:id/consent` → queries `consent_records WHERE patient_id = lead.patient_id`.
Panel shows: granted purposes, grantedAt, channel, and a note:
`"Patient verified via OTP. Raw phone not stored — contact via hospital callback."`

#### INT-B.4 — CRM Outbox Consumer Route [CHECKPOINT]
**File**: `packages/api/src/routes/internal.js` (new, CRM repo)
```javascript
// POST /v1/internal/outbox/process  — protected by INTERNAL_API_KEY header
router.post('/internal/outbox/process', requireInternalKey, async (req, res) => {
  const events = await db.select().from(outbox)
    .where(eq(outbox.status, 'pending')).limit(50);

  for (const event of events) {
    if (event.topic === 'lead.created') {
      await assignLeadToDefaultAdvisor(event.payload.leadId);
      await sendLeadConfirmationWhatsApp(event.payload);
    }
    if (event.topic === 'patient.consent_granted') {
      await sendWelcomeEmail(event.payload);
    }
    await db.update(outbox)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(outbox.id, event.id));
  }
  res.json({ processed: events.length });
});
```

---

### INT Phase C — WhatsApp (Replace MSG91 Stub)
> **Goal**: Use CRM's live Meta WhatsApp API for OTP + lead confirmation.

#### INT-C.1 — Add WA Templates in CRM
Via CRM UI or direct DB insert into `waTemplates`:
```
otp_verification  : "Your EasyHeals verification code is {{otp}}. Valid 10 min. Do not share."
lead_confirmed    : "Hello! Your request (ID: {{refId}}) received. Advisor contacts you in 24h. — EasyHeals"
```

#### INT-C.2 — WhatsApp CRM Provider
**File**: `src/lib/notifications/whatsapp-crm.provider.ts` (new)
```typescript
export class WhatsAppCrmProvider implements NotificationProvider {
  async sendOTP(phone: string, otp: string): Promise<void> {
    await fetch(`${process.env.CRM_INTERNAL_URL}/v1/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 "x-internal-key": process.env.INTERNAL_API_KEY! },
      body: JSON.stringify({ phone,
        templateName: "otp_verification",
        variables: [{ type: "text", text: otp }] }),
    });
  }
  async sendLeadConfirmation(phone: string, refId: string): Promise<void> {
    await fetch(`${process.env.CRM_INTERNAL_URL}/v1/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 "x-internal-key": process.env.INTERNAL_API_KEY! },
      body: JSON.stringify({ phone,
        templateName: "lead_confirmed",
        variables: [{ type: "text", text: refId }] }),
    });
  }
}
```

#### INT-C.3 — Update Notification Factory + Env [CHECKPOINT]
**File**: `src/lib/notifications/index.ts` — add `whatsapp_crm` case.

New `.env.local` values:
```env
CRM_INTERNAL_URL=https://your-crm.vercel.app  # or http://localhost:3000 locally
INTERNAL_API_KEY=<32-char-shared-secret>       # same value in CRM .env
NOTIFICATION_PROVIDER=whatsapp_crm
```

---

### INT Phase D — Hospital/Doctor Data Unification
> **Goal**: CRM is the single source of truth. Next.js profile pages reflect it automatically.

#### INT-D.1 — Slug Generation in CRM Masters Route
**File**: `packages/api/src/routes/masters.js` (CRM)
```javascript
function generateHospitalSlug(name, city) {
  const base = `${name}-${city}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-+$|^-+/g, '');
  return base;
}
// On POST/PATCH hospitals: generate slug, ensure uniqueness with -2/-3 suffix
```

#### INT-D.2 — Simplify Next.js Hospitals Admin Tab
**File**: `src/app/admin/AdminDashboardClient.tsx`
- Keep: search, view, toggle `isActive`, FTS5 search preview
- Remove: full create form (CRM owns this)
- Add: `"Manage in CRM →"` button → opens `process.env.NEXT_PUBLIC_CRM_URL/masters`

#### INT-D.3 — FTS5 Triggers: Auto-sync When CRM Adds Hospital [CHECKPOINT]
**File**: new drizzle migration in `easyheals-next/drizzle/`
```sql
CREATE TRIGGER IF NOT EXISTS hospitals_fts_insert AFTER INSERT ON hospitals BEGIN
  INSERT INTO hospitals_fts(rowid, name, city, description, specialties,
                            facilities, accreditations, address)
  VALUES (new.rowid, new.name, new.city, new.description, new.specialties,
          new.facilities, new.accreditations, new.address_line_1);
END;

CREATE TRIGGER IF NOT EXISTS hospitals_fts_update AFTER UPDATE ON hospitals BEGIN
  DELETE FROM hospitals_fts WHERE rowid = old.rowid;
  INSERT INTO hospitals_fts(rowid, name, city, description, specialties,
                            facilities, accreditations, address)
  VALUES (new.rowid, new.name, new.city, new.description, new.specialties,
          new.facilities, new.accreditations, new.address_line_1);
END;
```

---

### INT Phase E — Auth Bridge (Deferred — post-P2)
Both auth models serve different users. Keep separate for now.
- CRM: JWT (staff/agents) — 24h expiry, localStorage
- Next.js: session cookie (admin) + OTP (patients)

**If SSO needed later**: Next.js middleware accepts CRM JWT in `Authorization: Bearer` header for
`/admin` routes. Map CRM roles (`owner/admin/advisor/viewer`) → Next.js RBAC roles (identical names).

---

### INT Phase F — Vercel Cron + Observability

#### INT-F.1 — Unified Environment Template
**File**: `.env.integration.example` (new, easyheals-next root)
Documents all shared + service-specific env vars — see `INTEGRATION_PLAN.md §Environment Variables`.

#### INT-F.2 — Vercel Cron for Outbox [CHECKPOINT]
**File**: `vercel.json` (easyheals-next) — add crons block:
```json
{
  "crons": [{ "path": "/api/cron/outbox", "schedule": "*/1 * * * *" }]
}
```
**File**: `src/app/api/cron/outbox/route.ts` (new)
```typescript
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await fetch(`${process.env.CRM_INTERNAL_URL}/v1/internal/outbox/process`, {
    method: "POST",
    headers: { "x-internal-key": process.env.INTERNAL_API_KEY! },
  });
  return NextResponse.json(await res.json());
}
```

#### INT-F.3 — End-to-End Smoke Test [CHECKPOINT]
```
[ ] Patient searches hospital on Next.js → books callback
[ ] OTP received via WhatsApp (WA template approved + delivered)
[ ] Lead created in shared DB with refId EH-XXXXXX + source_platform=easyheals_platform
[ ] Lead appears in CRM Kanban under "New" within 60s (outbox cron)
[ ] CRM advisor assigns → status → "prospect"
[ ] Agent submits lead via CRM agent portal → same pipeline
[ ] Hospital added in CRM Masters → slug generated → /hospitals/:slug returns 200 (after ISR)
[ ] Hospital added in CRM → appears in FTS5 search on Next.js immediately (trigger)
[ ] /privacy page shows consent records for patient
```

---

### INT Integration Checkpoint Summary
| Phase | Task | Effort |
|-------|------|--------|
| A.1 | DB snapshot + identify primary | 1h |
| A.2–A.4 | Schema extensions (CRM migration) | 2h |
| A.5–A.6 | Apply Next.js migrations + unify .env | 1h |
| A.7 | Update Next.js schema.ts | 1h |
| B.1 | refId generation in lead create | 1h |
| B.2–B.3 | CRM lead list + consent panel | 3h |
| B.4 | CRM outbox consumer route | 2h |
| C.1 | Add WA templates in CRM | 30m |
| C.2–C.3 | WhatsApp CRM provider + env | 2h |
| D.1 | Slug generation in CRM masters | 1h |
| D.2 | Simplify Next.js hospitals tab | 1h |
| D.3 | FTS5 triggers in DB migration | 1h |
| F.1–F.2 | Env template + Vercel cron | 1h |
| F.3 | End-to-end smoke test | 2h |
| **Total** | | **~2 dev-days** |

---

---

## 🏗️ ARCHITECTURE DECISIONS (Locked)

### Session Architecture — 4 Separate Tables (Scalability)
```
admin_sessions      → owner, admin, advisor, viewer (low volume: ~20 users)
portal_sessions     → hospital_admin, doctor (medium volume: thousands)
patient_sessions    → Redis-backed (TTL 24h, auto-expiry, scales to lakhs)
                      Key: patient_session:{token} → { patientId, phoneHash, city }
anonymous_browsing  → No session. Rate limit by IP via Redis. No DB row.
```
**Why Redis for patients**: At 1 lakh patients × 1 session each = 100,000 rows. With daily rotation that's millions of rows/year in a DB table. Redis with 24h TTL auto-expires sessions → zero DB overhead, O(1) lookup.

**Session TTLs** (per HLD §8.2):
- `admin_sessions`: 4 hours
- `portal_sessions`: 8 hours
- `patient_sessions` (Redis): 24 hours
- Anonymous: Redis rate counter, TTL 1 hour

### Anonymous Patient Browsing Limits (Rate-limiting via Redis)
| Action | Anonymous Limit | With OTP (Patient) |
|--------|----------------|-------------------|
| Search | 30/hour per IP | Unlimited |
| View hospital profile | Unlimited | Unlimited |
| View doctor profile | Unlimited | Unlimited |
| Submit lead/callback | BLOCKED — consent required | 3/day per patient |
| Gamification events | BLOCKED | Full access |

### Redis Setup (Upstash)
Required env vars — add to `.env.local` and Vercel:
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```
Package: `@upstash/redis` (already Vercel-compatible, edge-safe)

### OTP / Notification Architecture — Zero Cost P1, Easy Swap Later
```
src/lib/notifications/
  ├── provider.interface.ts      ← interface: sendOTP(), sendLeadConfirm(), sendAdminAlert()
  ├── console.provider.ts        ← P1 default: logs to console (free, zero infra)
  ├── msg91.provider.ts          ← P2 stub: plug in MSG91 (India, DLT registered)
  ├── twilio.provider.ts         ← P2 stub: plug in Twilio (international fallback)
  └── index.ts                   ← factory: reads NOTIFICATION_PROVIDER env var
```
**Env var switch** (no code change needed to upgrade):
```
NOTIFICATION_PROVIDER=console    ← P1 (free)
NOTIFICATION_PROVIDER=msg91      ← P2 (₹0.14/SMS, DLT registered)
NOTIFICATION_PROVIDER=twilio     ← P2 international
```
Cost in P1 = ₹0. Future swap = change 1 env var.

### Rate Limits — Admin-Configurable via system_config Table
All limits stored in DB `system_config` table (admin-editable via admin panel).
Default seeds:
```
rate_limit.search.anonymous_per_hour     = 15
rate_limit.search.patient_per_hour       = 200
rate_limit.lead.per_patient_per_day      = 3
rate_limit.lead.per_ip_per_hour          = 5
rate_limit.otp.per_phone_per_10min       = 3
rate_limit.otp.lockout_duration_minutes  = 60
bot.block_headless_browsers              = true
bot.min_request_interval_ms             = 500
bot.honeypot_enabled                     = true
```
Admin with `owner` or `admin` role can change any value. Change takes effect within 60 seconds (Redis TTL on config cache).

### Bot Protection Strategy
1. **Honeypot field**: invisible `<input name="website">` in all public forms — bots fill it → instant block
2. **Rate limiting**: Redis sliding window per IP (configurable)
3. **User-Agent check**: block known headless browsers (Headless Chrome, PhantomJS, Puppeteer signatures)
4. **Request cadence**: requests < 500ms apart from same IP flagged (configurable)
5. **FingerprintJS** (client-side, open source): device hash → link multiple IPs to same device
6. **Search query pattern**: >50 unique searches in 5 min from same IP → soft-block + CAPTCHA prompt
7. **No raw data API**: search always returns HTML-renderable JSON (no bulk CSV/dump endpoints)

### SEO Architecture (P1 — Well Implemented)
**Already exists** (keep + enhance):
- JSON-LD: MedicalBusiness, Physician, MedicalProcedure, BreadcrumbList
- Dynamic sitemap at /sitemap.xml
- ISR revalidate: 3600 on profile pages

**Add in P1**:
- OpenGraph + Twitter Card meta on every public page
- `<link rel="canonical">` on all pages
- City + specialty in `<title>` and `<meta description>` (dynamic, keyword-rich)
- FAQ schema (`FAQPage` JSON-LD) on treatment pages
- Hospital search results: `ItemList` JSON-LD
- `robots.txt` — allow crawlers, block `/admin`, `/api/`, `/portal/`
- `hreflang` tags: `en-IN` + `hi-IN` (even before Hindi content, signals intent to Google)
- **Breadcrumb** on every page: Home › Hospitals › City › Name
- **Core Web Vitals**: lazy-load images, skeleton loaders, LCP < 2.5s target

**AI Search (P1 — Gemini-powered)**:
- `POST /api/v1/search/intent` — full NLU pipeline:
  1. Detect language (EN/HI)
  2. Gemini Flash: extract intent → `{ entity_type, specialty, city, urgency, budget }`
  3. Transliterate Hindi → canonical English specialty name
  4. FTS5 query on hospitals/doctors with extracted terms
  5. Return ranked results + "Did you mean?" suggestions
  6. Cache intent result in Redis (TTL 5min, keyed by query hash)
- Search suggestions: `GET /api/v1/search/suggest?q=` — prefix match on specialty/hospital names
- Zero results: Gemini suggests related specialties ("No cardiac surgeons in Mysore — try Bangalore (45km away)")

### Design System (from www.easyheals.com)
- **Primary blue**: `#2563eb` (Tailwind `blue-600`), hover `#1d4ed8` (`blue-700`)
- **Background**: White (`#ffffff`) with light gray sections (`gray-50`)
- **Text**: Dark gray (`gray-900` / `gray-700`)
- **Feel**: Warm & friendly (not clinical) — rounded corners, soft shadows
- **Icons**: SVG line-based, minimal
- **Cards**: `rounded-xl`, `shadow-sm`, white background, subtle border `border-gray-100`
- **Buttons**: `rounded-lg`, blue primary, white/outline secondary
- **Badges/Tags**: `rounded-full`, small, colored background (blue-50/text-blue-700 etc.)
- **Consent modal**: Use blue primary CTA, soft overlay, card-style centered dialog

---

## 🗺️ WHAT EXISTS (Don't Rebuild)
- [x] Next.js App Router structure + Drizzle ORM + Turso
- [x] Schema: hospitals, doctors, users, sessions, leads, ingestion tables, taxonomy, audit_logs, outbox_events, OTP
- [x] Admin dashboard (ingestion, hospitals, taxonomy, ai_research, brochure, contributions, access tabs)
- [x] Hospital / Doctor / Treatment profile pages + SEO + JSON-LD
- [x] Leads API at `/api/book`
- [x] Portal (hospital_admin + doctor self-service)
- [x] Google OAuth for contributors
- [x] Gemini AI (search intent, brochure, research agent)
- [x] Middleware (admin auth guard)

## 🚫 P1 GAPS (Must Build — HLD v4.0 Compliance)

### CRITICAL BLOCKERS (P1 Launch Gate)
- [ ] `consent_records` table + patients table
- [ ] Consent modal UI before any PII capture
- [ ] `POST /api/v1/consent` endpoint
- [ ] Lead creation updated to require `consent_record_id`

### HIGH PRIORITY (P1 Core)
- [ ] OTP flow: `POST /api/v1/auth/otp/send` + `POST /api/v1/auth/otp/verify`
- [ ] Patient privacy page + `DELETE /api/v1/patients/me` (right to erasure)
- [ ] FTS5 virtual tables + search provider refactor (replace LIKE scans)

> **Gamification schema** (tables + actorId/actorType pattern) stays in Task 1.1 — it's cheap DDL
> that prevents a future breaking migration. **Gamification APIs + leaderboard UI are P2** —
> deferred until feature is validated as a user acquisition driver. Use freed capacity for
> trust signals: doctor credential display, hospital accreditation badges, review counts.

### INFRASTRUCTURE (P1 Foundation)
- [ ] AppError class + error code taxonomy (`src/lib/errors/`)
- [ ] PHI-safe logger (`src/lib/security/phi-redactor.ts`)
- [ ] Feature flag system (`src/lib/config/feature-flags.ts`)
- [ ] `GET /api/health` endpoint
- [ ] API v1 routes (`/api/v1/` prefix for new endpoints)

### HARDENING (P1 Required)
- [ ] Upgrade middleware: rate limiting + consent check
- [ ] Per-field ingestion provenance (upgrade `ingestion_field_confidences`)
- [ ] Moderation queue admin workflow (upgrade existing contributions tab)

---

## 📅 DAY-BY-DAY SPRINT PLAN

---

## DAY 0 — Pre-Sprint Security Fixes (existing code, before any new tables)

> These are live vulnerabilities in production code. Fix before writing any P1 schema or APIs.
> Source: `technical_design_review.md` findings B1, B2, B3, B4.

### Task 0.1 — Hash Session Tokens Before DB Storage (B1)
**File**: `src/lib/session.ts`

**Problem**: `randomUUID()` stored directly in DB. A DB leak = all sessions hijackable.

**Fix**:
```typescript
import { createHash } from "crypto";

// When creating a session:
const rawToken = randomUUID();
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
await db.insert(sessions).values({ sessionToken: tokenHash, userId, expiresAt });
// Send rawToken to client (cookie), never the hash

// When validating a session:
const tokenHash = createHash("sha256").update(cookieValue).digest("hex");
const session = await db.select().from(sessions).where(eq(sessions.sessionToken, tokenHash));
```

Also update `requireAuth()` in `src/lib/auth.ts` to hash the cookie value before DB lookup.

**[CHECKPOINT 0.1]** — Commit: `[PRE-P1] Hash session tokens before DB storage (fix B1)`

---

### Task 0.2 — Document Middleware Auth Model (B2)
**File**: `src/middleware.ts`

**Problem**: Middleware only checks cookie *existence* — not validity. A fake cookie value bypasses it.
Route handlers call `requireAuth()` which does validate, so there's no actual bypass.
But the false sense of security and wasted compute should be addressed.

**Fix**: Add a comment block at the top of `middleware.ts` making the model explicit:
```typescript
/**
 * SECURITY MODEL (read before modifying):
 * This middleware is a REDIRECT GUARD only — it checks cookie presence
 * to redirect unauthenticated users to /login before the page renders.
 * It does NOT validate session tokens (that requires a DB round-trip).
 *
 * ACTUAL AUTH ENFORCEMENT happens inside each route handler via requireAuth()
 * (src/lib/auth.ts), which validates the token hash against the DB.
 *
 * Do NOT add business logic here assuming the session is valid.
 */
```

No functional code change needed — the pattern is correct. Documentation prevents future regressions.

**[CHECKPOINT 0.2]** — Commit: `[PRE-P1] Document middleware auth model (fix B2)`

---

### Task 0.3 — Rate-Limit `/api/book` + Set Deprecation Plan (B3)
**File**: `src/app/api/book/route.ts`

**Problem**: Public endpoint, raw phone stored, zero rate limiting, no consent, no bot guard.

**Fix — immediate** (before P1 sprint, ~2 hours):
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),  // 5 leads per IP per hour
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  // ... existing logic
}
```

**Deprecation plan** (add response header now):
```typescript
// Add to all responses from /api/book:
headers: { "Deprecation": "true", "Sunset": "2026-06-01", "Link": '/api/v1/leads; rel="successor-version"' }
```

After Task 2.2 ships (`/api/v1/leads`), update `/api/book` to delegate:
```typescript
// /api/book becomes a thin wrapper:
export async function POST(req: NextRequest) {
  return fetch(new URL("/api/v1/leads", req.url), { method: "POST", body: req.body, headers: req.headers });
}
```

**[CHECKPOINT 0.3]** — Commit: `[PRE-P1] Rate-limit /api/book + add deprecation headers (fix B3)`

---

### Task 0.4 — PHI Redaction in Audit Log (B4)
**File**: `src/lib/audit.ts`

**Problem**: `writeAuditLog({ changes: { phone, fullName, ... } })` stores raw PII in audit log.
ARCHITECTURE.md §L.2 says "NEVER log phone, full_name" — existing code violates this.

**Fix** — add a `phiSafeChanges()` helper called before every `writeAuditLog`:
```typescript
// src/lib/audit.ts — add at top of file:
const PHI_FIELDS = ["phone", "fullName", "full_name", "email", "name", "patientName"];

export function phiSafeChanges(changes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(changes).map(([k, v]) =>
      PHI_FIELDS.includes(k) ? [k, "[REDACTED]"] : [k, v]
    )
  );
}
```

Update every `writeAuditLog` call that passes raw PII in `changes`:
```typescript
// Before:
await writeAuditLog({ changes: { fullName: lead.fullName, phone: lead.phone, status } });
// After:
await writeAuditLog({ changes: phiSafeChanges({ fullName: lead.fullName, phone: lead.phone, status }) });
```

Search for all call sites: `grep -r "writeAuditLog" src/` — update all instances.

**[CHECKPOINT 0.4]** — Commit: `[PRE-P1] Redact PII in audit log writes (fix B4)`

---

### Task 0.5 — Legacy Lead Data Migration (A2 — phone_hash identity split)
**New file**: `drizzle/migrate-legacy-leads.ts` (run once, before any P1 schema migration)

**Problem**: Existing `leads` table stores raw phones. New `patients` table uses `phone_hash`.
These are two identity systems. Dedup logic, right-to-erasure, and consent linking all break
without a bridge between them.

**Fix — migration script**:
```typescript
// drizzle/migrate-legacy-leads.ts
import { db } from "../src/lib/core/db";
import { leads, patients } from "../src/db/schema";
import { hashPhone } from "../src/lib/security/encryption";
import { createId } from "@paralleldrive/cuid2";
import { eq, isNull } from "drizzle-orm";

export async function migrateLegacyLeads() {
  // 1. Get all leads that don't yet have a patientId
  const orphanedLeads = await db.select().from(leads).where(isNull(leads.patientId));

  for (const lead of orphanedLeads) {
    if (!lead.phone) continue;

    const phoneHash = hashPhone(lead.phone);

    // 2. Find or create patient by phone_hash
    let patient = await db.select().from(patients).where(eq(patients.phoneHash, phoneHash)).get();
    if (!patient) {
      const [created] = await db.insert(patients).values({
        id: createId(),
        phoneHash,
        city: lead.city ?? null,
        createdAt: lead.createdAt,  // preserve original date
      }).returning();
      patient = created;
    }

    // 3. Link lead to patient
    await db.update(leads).set({ patientId: patient.id }).where(eq(leads.id, lead.id));
  }

  console.log(`Migrated ${orphanedLeads.length} legacy leads to patient records`);
}
```

**Run order**: After Task 1.1 schema migration (patients table must exist), before Task 2.2.
**Existing leads + DPDP**: No retroactive consent — document as `legalBasis: "legitimate_interest_pre_dpdp"`.
Add `leads.legacyLead: boolean` column; exclude legacy leads from DPDP erasure scope per legal guidance.

**[CHECKPOINT 0.5]** — Commit: `[PRE-P1] Legacy lead migration: link existing leads to patient records`

---

### Task 0.6 — AI Client Singleton with Timeout + Token Tracking (C1/C2)
**New file**: `src/lib/ai/client.ts`

**Problem**: `new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY)` is instantiated **12 times** across
the codebase (ingestion.ts 4×, gemini.ts, search routes, admin routes). No timeout, no token
tracking, no circuit breaker. One hung Gemini call = dead request with no error message.

**Strategy**: Create singleton + timeout wrapper now (< 1 hour). All 12 call sites migrate to it
during Task 1.2b (lib refactor) — decouples the fix from the big refactor.

```typescript
// src/lib/ai/client.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";

// Singleton — one instance for the entire process
let _client: GoogleGenerativeAI | null = null;
export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) _client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  return _client;
}

// Timeout wrapper — all Gemini calls must go through this
export async function generateWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn();
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new AppError("AI_PROVIDER_DOWN", `Gemini timed out after ${timeoutMs}ms`,
        "AI service is temporarily slow. Try again.", 503);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Token usage tracker — in-memory, resets on cold start. Exposed via /api/health.
let _tokenUsage = { inputTokens: 0, outputTokens: 0, calls: 0 };
export function trackTokenUsage(usage: { inputTokens: number; outputTokens: number }) {
  _tokenUsage.inputTokens += usage.inputTokens;
  _tokenUsage.outputTokens += usage.outputTokens;
  _tokenUsage.calls += 1;
}
export function getTokenUsage() { return { ..._tokenUsage }; }
```

**Migration pattern for 12 call sites** (applied during Task 1.2b):
```typescript
// Before (scattered across codebase — 12 instances):
const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent(prompt);

// After (via singleton with timeout):
const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });
const result = await generateWithTimeout(() => model.generateContent(prompt), 8000);
if (result.response.usageMetadata) trackTokenUsage(result.response.usageMetadata);
```

**Expose in `GET /api/health`**:
```json
{ "ai": "ok", "ai_stats": { "calls": 142, "inputTokens": 45200, "outputTokens": 8100 } }
```

> Full `cost-tracker.ts` + `circuit-breaker.ts` (ARCHITECTURE.md §G) are Task 1.6 scope.
> This task only creates the singleton + timeout wrapper. Mandatory before any P1 API ships.

**[CHECKPOINT 0.6]** — Commit: `[PRE-P1] AI client singleton with 8s timeout + token tracking (fix C1/C2)`

---

## DAY 1 — Schema + Infrastructure Foundation

### Task 1.1 — DB Schema Additions (P1-P4 Compatible)
**File**: `src/db/schema.ts`
**Reference**: ARCHITECTURE.md §B.2 for full stub column rationale

> Nullable stub columns are added now to all existing tables so P2/P3 activations require
> only additive migrations (new rows in feature_flags/system_config) — not schema changes.

**New packages**: `npm install @upstash/redis @upstash/ratelimit @sentry/nextjs`
**New env vars to add to env.ts**:
```
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
PHONE_SALT                (32-byte hex — generate once, never change)
ENCRYPTION_KEY            (32-byte hex — rotate every 90 days)
ENCRYPTION_KEY_VERSION    (v1 — increment on rotation)
NOTIFICATION_PROVIDER     (console — P1 default)
PAYMENT_PROVIDER          (console — P1 default)
SEARCH_PROVIDER           (fts5 — P1 default)
SENTRY_DSN                (from Sentry project)
```

**What to add**:

```typescript
// NEW TABLE 1: patients (phone_hash based — no raw PII)
export const patients = sqliteTable("patients", {
  id: id(),
  phoneHash: text("phone_hash").notNull().unique(),  // SHA-256 of phone+salt
  city: text("city"),
  deviceFpHash: text("device_fp_hash"),
  displayAlias: text("display_alias"),               // e.g. "Priya ****23" — user-chosen or auto-generated
  leaderboardOptOut: integer("leaderboard_opt_out", { mode: "boolean" }).notNull().default(false), // HLD §3.3.2
  // P2 stubs
  phoneEncrypted: text("phone_encrypted"),           // AES-256-GCM — needed for WhatsApp (P2)
  preferredLang: text("preferred_lang").default("en"),
  // P3 stubs
  abhaId: text("abha_id"),                          // ABHA health ID (P4)
  // P5 stub
  preferredPharmacyId: text("preferred_pharmacy_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }), // soft-delete for right-to-erasure (HLD §9 G10)
});

// NEW TABLE 2: consent_records (P1 GATE — CRITICAL)
// ⚠️ patientId is REQUIRED (not nullable). Consent can only be created AFTER OTP verification
// creates the patient row. Flow: otp/send → otp/verify (creates patient) → consent → lead.
// See A3 fix: circular dependency resolved by enforcing patient-first order in API design.
export const consentRecords = sqliteTable("consent_records", {
  id: id(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  purpose: text("purpose").notNull(),  // booking_lead | analytics | marketing | ai_health | emr_access | referral
  version: text("version").notNull().default("1.0"),
  granted: integer("granted", { mode: "boolean" }).notNull(),
  grantedAt: integer("granted_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  channel: text("channel").notNull().default("web"),  // web | whatsapp | sms | app
  ipHash: text("ip_hash").notNull(),
  userAgentHash: text("user_agent_hash"),
  legalBasis: text("legal_basis").notNull().default("dpdp_consent"),
});

// ACTOR IDENTITY (A1 fix: replaces dual userId/patientId nullable FK anti-pattern)
// ─────────────────────────────────────────────────────────────────────────────────
// All gamification tables use actorId (string) + actorType ('user'|'patient') instead
// of two nullable FKs. This eliminates COALESCE queries, fixes index ambiguity, and
// makes the DB self-describing. FK enforcement is at app layer (actorId validated
// against users.id or patients.id depending on actorType before any insert).

// NEW TABLE 3: user_points (gamification running total)
export const userPoints = sqliteTable("user_points", {
  id: id(),
  actorId: text("actor_id").notNull(),     // users.id or patients.id
  actorType: text("actor_type").notNull(), // 'user' | 'patient'
  totalPoints: integer("total_points").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  level: integer("level").notNull().default(1),
  lastUpdated: integer("last_updated", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
}, (table) => [
  uniqueIndex("user_points_actor_idx").on(table.actorId, table.actorType),
]);

// NEW TABLE 4: point_events (immutable ledger)
export const pointEvents = sqliteTable("point_events", {
  id: id(),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").notNull(), // 'user' | 'patient'
  eventType: text("event_type").notNull(),
  points: integer("points").notNull(),
  proofId: text("proof_id").notNull(),  // unique per eventType — idempotency key
  proofType: text("proof_type").notNull(),
  deviceFpHash: text("device_fp_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
}, (table) => [
  uniqueIndex("point_events_type_proof_idx").on(table.eventType, table.proofId),
]);

// NEW TABLE 5: badges
export const badges = sqliteTable("badges", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  tier: text("tier").notNull().default("bronze"),  // bronze | silver | gold
  phaseRequired: text("phase_required").notNull().default("phase-a"),
  iconUrl: text("icon_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

// NEW TABLE 6: user_badges
export const userBadges = sqliteTable("user_badges", {
  id: id(),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").notNull(), // 'user' | 'patient'
  badgeId: text("badge_id").notNull().references(() => badges.id),
  earnedAt: integer("earned_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  seen: integer("seen", { mode: "boolean" }).notNull().default(false),
  displayOnProfile: integer("display_on_profile", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  uniqueIndex("user_badges_actor_badge_idx").on(table.actorId, table.actorType, table.badgeId),
]);

// NEW TABLE 7: streaks
export const streaks = sqliteTable("streaks", {
  id: id(),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").notNull(), // 'user' | 'patient'
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: integer("last_activity_date", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("streaks_actor_idx").on(table.actorId, table.actorType),
]);

// NOTE: leaderboard_cache TABLE REMOVED (A4 fix — redundant dual storage).
// Leaderboard lives exclusively in Redis Sorted Sets:
//   Key: leaderboard:{city}:{period}  → ZADD score=points, member=actorId
//   GET /api/v1/leaderboard/:city reads from Redis ZREVRANGE.
//   Cron refreshes Redis from point_events aggregation (hourly).
//   If Redis is unavailable: return 503 "leaderboard temporarily unavailable".
//   Privacy: displayAlias stored alongside score as JSON: { alias, level, actorType }

// NEW TABLE 8: gamification_config (admin-configurable point values)
export const gamificationConfig = sqliteTable("gamification_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

// NEW TABLE 9: abuse_flags
export const abuseFlags = sqliteTable("abuse_flags", {
  id: id(),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").notNull(), // 'user' | 'patient'
  flagType: text("flag_type").notNull(),  // duplicate_device | otp_flood | referral_loop
  deviceFpHash: text("device_fp_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  resolvedBy: text("resolved_by").references(() => users.id),
});

// NEW TABLE 10: system_config (admin-configurable rate limits + bot settings)
export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // rate_limit | bot | gamification | seo
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  updatedBy: text("updated_by").references(() => users.id),
});

// NEW TABLE 11: feature_flags
export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  phase: text("phase").notNull().default("p2"),  // p1 | p2 | p3 | p4
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  updatedBy: text("updated_by").references(() => users.id),
});
```

**EXISTING TABLE UPDATES** (add nullable stub columns — zero breaking change for P2/P3/P4/P5):

```typescript
// sessions table — add session_type (default 'admin', backward compatible)
sessionType: text("session_type").notNull().default("admin"),
// TTL enforcement: admin=4h, portal=8h (fix current 7-day bug)
// Cookie rename: easyheals_next_session → eh_admin_session / eh_portal_session
// (keep reading old cookie for zero-downtime migration)

// leads table — P1 required + P2 stubs
patientId: text("patient_id").references(() => patients.id),         // P1
consentRecordId: text("consent_record_id").references(() => consentRecords.id), // P1
assignedDoctorId: text("assigned_doctor_id").references(() => doctors.id),      // P2 stub
preferredSlotDate: integer("preferred_slot_date", { mode: "timestamp_ms" }),    // P2 stub
appointmentId: text("appointment_id"),           // P2 stub (no FK yet — table doesn't exist)
broadcastCampaignId: text("broadcast_campaign_id"),                             // P2 stub
whatsappSent: integer("whatsapp_sent", { mode: "boolean" }).default(false),     // P2 stub
easyhealOwnerId: text("easyheal_owner_id").references(() => users.id),          // P2 stub
easyhealNotes: text("easyheal_notes"),                                          // P2 stub

// hospitals table — P2 stubs
whatsappBusinessNumber: text("whatsapp_business_number"),      // P2 stub
queueEnabled: integer("queue_enabled", { mode: "boolean" }).default(false),
broadcastEnabled: integer("broadcast_enabled", { mode: "boolean" }).default(false),
slotDurationMinutes: integer("slot_duration_minutes").default(15),
maxDailyAppointments: integer("max_daily_appointments"),
razorpayCustomerId: text("razorpay_customer_id"),              // P2 stub

// leads table — P5 stub
prescriptionRequestId: text("prescription_request_id"),   // P5 FK prescription_requests

// ingestion_field_confidences — upgrade to full provenance (ARCHITECTURE.md §B.2)
sourceType: text("source_type"),
extractedAt: integer("extracted_at", { mode: "timestamp_ms" }),
reviewStatus: text("review_status").notNull().default("pending"),
reviewedBy: text("reviewed_by").references(() => users.id),
reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
conflictWith: text("conflict_with"),  // self-referential FK
```

**NEW TABLES (14 total)**:
1. `patients` — with P2/P3/P4 nullable stubs (phone_encrypted, preferred_lang, abha_id etc.)
2. `consent_records` — P1 GATE (patientId NOT NULL, per A3 fix + HLD §2.1)
3. `user_points` — gamification running total (actorId/actorType, per A1 fix)
4. `point_events` — immutable ledger (actorId/actorType)
5. `badges` — badge catalogue
6. `user_badges` — earned badges per actor (actorId/actorType)
7. `streaks` — daily checkin streaks (actorId/actorType)
8. `gamification_config` — admin-configurable point values
9. `abuse_flags` — device/account abuse records (actorId/actorType)
10. `system_config` — all admin-configurable limits (rate limits, bot settings)
11. `feature_flags` — P1-P4 feature gates (seeded with defaults)
12. `analytics_events` — P1 stub, P2 full (consent-gated writes)
13. `payment_transactions` — P2 ready stub (Razorpay, table exists in P1)
14. `specialty_synonyms` — multilingual search synonyms (admin-managed)
> `leaderboard_cache` REMOVED (A4 fix) — leaderboard lives in Redis Sorted Sets only.

**FTS5 VIRTUAL TABLES** (add to migration `drizzle/0001_p1_patients_consent.sql`):
> Confirmed scope (Task 2.3a): hospitals_fts indexes 7 fields covering name, city, about,
> services (specialties + facilities), trust (accreditations), and contact (address_line_1).
> Searching "NABH hospital Bangalore" or "JCI cardiology ICU" returns correct results.

```sql
-- Full-text search (D4 fix: replaces LIKE scans which can't use indexes)
-- hospitals_fts: 7 fields — name | city | description | specialties | facilities | accreditations | address_line_1
CREATE VIRTUAL TABLE IF NOT EXISTS hospitals_fts USING fts5(
  name, city, description, specialties, facilities, accreditations, address_line_1,
  content=hospitals, content_rowid=rowid
);
-- doctors_fts: 5 fields — full_name | city | specialization | bio | qualifications
CREATE VIRTUAL TABLE IF NOT EXISTS doctors_fts USING fts5(
  full_name, city, specialization, bio, qualifications,
  content=doctors, content_rowid=rowid
);
-- Sync triggers for hospitals_fts (INSERT / DELETE / UPDATE)
CREATE TRIGGER hospitals_ai AFTER INSERT ON hospitals BEGIN
  INSERT INTO hospitals_fts(rowid, name, city, description, specialties, facilities, accreditations, address_line_1)
  VALUES (new.rowid, new.name, new.city, new.description, new.specialties, new.facilities, new.accreditations, new.address_line_1);
END;
CREATE TRIGGER hospitals_ad AFTER DELETE ON hospitals BEGIN
  INSERT INTO hospitals_fts(hospitals_fts, rowid, name, city, description, specialties, facilities, accreditations, address_line_1)
  VALUES ('delete', old.rowid, old.name, old.city, old.description, old.specialties, old.facilities, old.accreditations, old.address_line_1);
END;
CREATE TRIGGER hospitals_au AFTER UPDATE ON hospitals BEGIN
  INSERT INTO hospitals_fts(hospitals_fts, rowid, name, city, description, specialties, facilities, accreditations, address_line_1)
  VALUES ('delete', old.rowid, old.name, old.city, old.description, old.specialties, old.facilities, old.accreditations, old.address_line_1);
  INSERT INTO hospitals_fts(rowid, name, city, description, specialties, facilities, accreditations, address_line_1)
  VALUES (new.rowid, new.name, new.city, new.description, new.specialties, new.facilities, new.accreditations, new.address_line_1);
END;
-- Same 3-trigger pattern for doctors_fts (omitted for brevity, same INSERT/DELETE/UPDATE structure)
```
`fts5.provider.ts` uses `MATCH` queries: `SELECT * FROM hospitals_fts WHERE hospitals_fts MATCH ?`
JSON arrays stored as raw text in FTS5 — searching "NABH" matches substring in `["NABH","NABL"]`.
Turso/libSQL supports FTS5 natively — no additional setup needed.

**SEED DATA** (run after migration via `drizzle/seed-p1.ts`):
- Feature flags: all P1 flags ON, P2/P3/P4 flags OFF
- system_config: all rate limits with documented defaults
- gamification_config: point values per HLD §3.1
- Default badges: PROFILE_COMPLETED, FIRST_LEAD, STREAK_7, STREAK_30
- Default roles: ensure all 7 roles exist (owner/admin/advisor/viewer/hospital_admin/doctor/contributor)

**Migration files** (separate for easy rollback):
```
drizzle/0001_p1_patients_consent.sql
drizzle/0002_p1_gamification.sql
drizzle/0003_p1_config_flags.sql
drizzle/0004_p1_stubs_on_existing.sql
drizzle/0005_p1_analytics_payments.sql
drizzle/0006_p1_provenance_upgrade.sql
```

**[CHECKPOINT 1.1]** — Commit: `[P1-1.1] P1-P4 compatible schema: 14 new tables + FTS5 DDL + actorId/actorType pattern + stubs`

---

### Task 1.2 — Run DB Migration
```bash
cd easyheals-next
npm run db:generate
npm run db:migrate
```
Verify: `npm run db:studio` or check turso shell that all 11 new tables exist.
**[CHECKPOINT 1.2]** — Commit: `[P1-1.2] DB migration: P1 schema additions applied`

---

### Task 1.2b — Refactor Existing Modules into lib/ Structure
**Move/refactor existing files** to align with ARCHITECTURE.md §A.1:

- `src/lib/gemini.ts` → `src/lib/ai/providers/gemini.provider.ts` + `src/lib/ai/operations/search-intent.ts`
- `src/lib/session.ts` → update: split TTL by sessionType, rename cookies
- `src/lib/rbac.ts` → enhance: add patient role + portal role checks
- `src/lib/audit.ts` → move to `src/lib/observability/audit.ts`, add PHI-scrubbing
- `src/lib/env.ts` → add new env vars (UPSTASH, ENCRYPTION_KEY, PHONE_SALT etc.)
- Create `src/lib/core/db.ts` (re-export existing db client)
- Create `src/lib/core/redis.ts` (Upstash Redis singleton)

> **Do NOT break existing admin routes** during refactor. Keep re-exports in old paths temporarily.

**[CHECKPOINT 1.2b]** — Commit: `[P1-1.2b] Refactor lib/ into ARCHITECTURE.md module structure`

---

### Task 1.3 — Error Handling Framework
**New file**: `src/lib/errors/app-error.ts`

```typescript
// Full error taxonomy per HLD §7.1 — ALL 14 prefixes
export type ErrorCode =
  // AUTH_ — Authentication / authorisation (401/403)
  | "AUTH_OTP_EXPIRED" | "AUTH_INVALID_TOKEN" | "AUTH_FORBIDDEN" | "AUTH_SESSION_EXPIRED"
  // CONSENT_ — Consent violations (403/451)
  | "CONSENT_MISSING" | "CONSENT_PURPOSE_MISMATCH" | "CONSENT_REVOKED"
  // SEARCH_ — Search errors (400/429)
  | "SEARCH_INTENT_FAILED" | "SEARCH_NO_RESULTS" | "SEARCH_RATE_LIMITED"
  // LEAD_ — Lead / callback errors (422/409)
  | "LEAD_CONSENT_REQUIRED" | "LEAD_DUPLICATE" | "LEAD_HOSPITAL_INACTIVE"
  // BOOK_ — Appointment booking P2 (409/422) — codes exist in P1, feature-flagged
  | "BOOK_SLOT_TAKEN" | "BOOK_PATIENT_BLACKOUT" | "BOOK_HOSPITAL_CLOSED"
  // AI_ — AI operation errors (503/429)
  | "AI_QUOTA_EXCEEDED" | "AI_PROVIDER_DOWN" | "AI_COST_LIMIT" | "AI_CACHE_MISS"
  // NOTIFY_ — Notification errors (422/500)
  | "NOTIFY_WA_TEMPLATE_REJECTED" | "NOTIFY_OPT_OUT" | "NOTIFY_DLT_INVALID"
  // PHI_ — Clinical / privacy (403/451)
  | "PHI_ACCESS_DENIED" | "PHI_CONSENT_MISSING" | "PHI_AUDIT_REQUIRED"
  // GAME_ — Gamification (409/429)
  | "GAME_EVENT_DUPLICATE" | "GAME_PROOF_INVALID" | "GAME_CAP_HIT" | "GAME_ABUSE_FLAGGED"
  // INGEST_ — Ingestion / moderation (422/500)
  | "INGEST_SOURCE_UNREACHABLE" | "INGEST_CONFIDENCE_TOO_LOW" | "INGEST_CONFLICT"
  // CRM_ — CRM / lead integration (404/422)
  | "CRM_LEAD_NOT_FOUND" | "CRM_STATUS_INVALID_TRANSITION" | "CRM_WEBHOOK_FAILED"
  // RATE_ — Rate limiting (429)
  | "RATE_SEARCH_EXCEEDED" | "RATE_OTP_FLOOD" | "RATE_LEAD_FLOOD"
  // DB_ — Database (404/500)
  | "DB_UNIQUE_VIOLATION" | "DB_NOT_FOUND" | "DB_MIGRATION_PENDING"
  // SYS_ — System / unexpected (500)
  | "SYS_UNHANDLED" | "SYS_CONFIG_MISSING" | "SYS_HEALTH_DEGRADED";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly userMessage?: string,
    public readonly statusCode = 500,
    public readonly context?: Record<string, unknown>,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function withErrorHandler(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AppError) {
        return Response.json(
          { error: { code: err.code, message: err.userMessage ?? err.message } },
          { status: err.statusCode }
        );
      }
      // Unexpected (non-operational) errors → report to Sentry (PHI-scrubbed)
      if (!(err instanceof AppError) || !err.isOperational) {
        const { captureException } = await import("@sentry/nextjs");
        captureException(phiRedact(err));  // phiRedact strips phone/name/email before sending
      }
      logger.error({ code: "SYS_UNHANDLED", err: phiRedact(err) });
      return Response.json(
        { error: { code: "SYS_UNHANDLED", message: "An unexpected error occurred" } },
        { status: 500 }
      );
    }
  };
}
```

**New file**: `src/lib/security/phi-redactor.ts`
- Redacts phone numbers, emails, names from log objects before writing
- Used in all structured log calls

**[CHECKPOINT 1.3]** — Commit: `[P1-1.3] Add AppError framework + PHI-safe logger`

---

### Task 1.4 — Feature Flag System
**New file**: `src/lib/config/feature-flags.ts`

```typescript
// P2 flags (all OFF by default)
export const P2_FLAGS = [
  "appointment_booking",      // real slot booking
  "whatsapp_notifications",   // WhatsApp API
  "token_queue",              // live queue management
  "mass_broadcast",           // broadcast tool
  "gamification_phase_b",     // verified appointment/review events
  "paid_membership",          // patient paid tier
  "provider_analytics",       // analytics dashboard
  "crm_integration",          // event bus + webhooks
] as const;

// P3 flags (all OFF — require gate checklist)
export const P3_FLAGS = [
  "emr_lite",
  "lab_test_ordering",
  "video_consultation",
] as const;

export async function isFeatureEnabled(key: string): Promise<boolean> {
  // Check DB feature_flags table; fall back to env var EH_FLAG_{KEY}=1
  // Returns false for unknown keys (safe default)
}
```

**[CHECKPOINT 1.4]** — Commit: `[P1-1.4] Feature flag system with P2/P3 gate defaults`

---

### Task 1.5 — Health Check Endpoint
**New file**: `src/app/api/health/route.ts` (upgrade existing stub)

`GET /api/health` returns:
```json
{
  "status": "ok | degraded",
  "db": "ok | error",
  "ai": "ok | error",
  "features": {
    "appointment_booking": false,
    "gamification_phase_b": false
  },
  "ts": "2026-03-13T..."
}
```

**[CHECKPOINT 1.5]** — Commit: `[P1-1.5] Health check endpoint with DB + AI + feature status`

---

### Task 1.6 — Core Infrastructure Modules
Build the foundational modules that all P1 APIs depend on:

**`src/lib/core/redis.ts`** — Upstash Redis singleton with error handling + circuit breaker

**`src/lib/security/encryption.ts`**
```typescript
export function encryptPhone(phone: string): string  // AES-256-GCM
export function decryptPhone(encrypted: string): string
export function hashPhone(phone: string): string     // SHA-256 + PHONE_SALT
export function hashDeviceFp(fp: string): string
```

**`src/lib/security/otp.ts`**
```typescript
export function generateOTP(): string          // 6-digit
export function hashOTP(otp: string): string   // bcrypt hash
export async function verifyOTP(otp: string, hash: string): boolean
```

**`src/lib/crm/outbox.ts`** — `publishEvent(topic, payload)` → INSERT outbox_events

**`src/lib/analytics/track.ts`** — `trackEvent()` with consent gate

**`src/lib/config/system-config.ts`** — `getConfig(key)` → Redis cache → DB fallback

**`src/lib/search/fts5.provider.ts`** — refactor existing search into SearchProvider interface

**`src/lib/observability/logger.ts`** — PHI-safe structured logger
```typescript
// Usage in route handlers:
logger.info({ action: 'LEAD_CREATED', entityId: leadId, traceId });
// Never: logger.info({ phone: user.phone })  ← PHI-redactor catches this
```

**`vercel.json`** — add cron jobs + security headers in `next.config.ts`

**[CHECKPOINT 1.6]** — Commit: `[P1-1.6] Core infrastructure: Redis, encryption, OTP, CRM outbox, analytics, logger, search provider`

---

## DAY 2 — Core P1 APIs (Consent + Lead Gate + Trust Signals + Search)

### Task 2.1 — Consent API
**New file**: `src/app/api/v1/consent/route.ts`

`POST /api/v1/consent`
- Input: `{ patientId?, purposes: string[], version, ipHash }`
- Creates `consent_records` rows (one per purpose)
- Returns: `{ consentIds: string[], grantedAt: string }`
- Error: `AUTH_OTP_EXPIRED` if session invalid, `DB_UNIQUE_VIOLATION` if duplicate purpose

**New file**: `src/lib/security/consent.ts`
- `requireConsent(patientId, purpose)` — throws `CONSENT_MISSING` if no active consent
- `revokeConsent(patientId, purpose)` — soft-delete by setting revokedAt
- `hashPhone(phone)` — SHA-256 with app salt → returns phoneHash
- `findOrCreatePatient(phone)` — upsert patient by phoneHash

**[CHECKPOINT 2.1]** — Commit: `[P1-2.1] POST /api/v1/consent + consent lib`

---

### Task 2.2 — Lead API Upgrade (Consent Gate)
**New file**: `src/app/api/v1/leads/route.ts`
(Keep existing `/api/book` working for backwards compat during transition)

`POST /api/v1/leads`
- Input: `{ hospitalId, patientPhone, symptom, preferredDate?, consentGranted: true }`
- Flow:
  1. Hash phone → find/create patient
  2. Check consent_records for `booking_lead` purpose — throw `LEAD_CONSENT_REQUIRED` if missing
  3. Check duplicate: same patient + hospital + status=new within 7 days → `LEAD_DUPLICATE`
  4. Check hospital isActive → `LEAD_HOSPITAL_INACTIVE`
  5. INSERT lead with `consentRecordId`, `patientId`
  6. Award gamification event: `CONSENT_GRANTED` (first time only)
  7. Return: `{ leadId, status: "new", message: "Hospital will call you back within 24 hours" }`

**[CHECKPOINT 2.2]** — Commit: `[P1-2.2] POST /api/v1/leads with consent gate + patient linking`

---

### Task 2.3 — ~~Gamification Event API~~ → DEFERRED TO P2
> **Rationale**: Gamification APIs are unvalidated as a user acquisition driver for a healthcare
> lead-gen platform. The schema (tables + actorId/actorType) is already in P1. Building the
> APIs before we have usage data is premature investment.
>
> **What ships in P1 instead**: Trust signals (Task 2.3a below).
>
> **P2 pickup point**: When gamification Phase-A APIs are built in P2, use:
> - `src/lib/gamification/award.ts` — `awardPoints({ actorId, actorType, eventType, proofId })`
> - `POST /api/v1/gamification/event` — requires patient session
> - Phase-A events: PROFILE_COMPLETED (50pts), CONSENT_GRANTED (10pts), NEWS_READ_5 (30pts/week),
>   DAILY_CHECKIN (10pts), PROFILE_PHOTO_ADDED (20pts), SHARE_PROFILE (10pts, 3/day cap)
> - All events: idempotency by (eventType, proofId), cap enforcement, device abuse check

### Task 2.3a — Trust Signals: Accreditations + Admin Form + Search Expansion
> `hospitals.accreditations` already exists as a JSON string array in schema.ts.
> No schema change needed. Three surfaces to build:

**A. Admin Hospital Form — Accreditation Multi-Select**
**File**: `src/app/admin/AdminDashboardClient.tsx` (update hospitals tab add/edit modal)

Add multi-select accreditation field to the add/edit hospital form:
```
Predefined options (checkbox group + free-text for custom):
  NABH | NABL | JCI | ISO 9001 | AACI | CAP | NABH-SHCO
```
Saved as `string[]` → `hospitals.accreditations` JSON column.

Also expose `accreditations` in the **hospital portal** (`src/app/portal/hospital/`) so
`hospital_admin` users can update their own accreditation badges.

**B. FTS5 Search Expansion — include accreditations + full contact + services**
Update the `hospitals_fts` virtual table definition in Task 1.1 migration to index
7 fields (previously only 4):
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS hospitals_fts USING fts5(
  name,            -- hospital name
  city,            -- location
  description,     -- about
  specialties,     -- services (JSON array stored as text)
  facilities,      -- services (JSON array stored as text)
  accreditations,  -- trust: "NABH NABL JCI" (JSON array stored as text, NABH substring matches)
  address_line_1,  -- contact / area
  content=hospitals, content_rowid=rowid
);
-- Update all 3 triggers (INSERT/UPDATE/DELETE) to include all 7 columns.
```
Search for "NABH hospital Bangalore" or "JCI certified cardiac" now hits accreditation data.

**C. Search Provider — field coverage**
**File**: `src/lib/search/fts5.provider.ts`

FTS5 `MATCH` query covers all 7 columns. A patient searching any of the following now
returns relevant results:
- Contact: address / area name
- About: description / about text
- Services: specialties list, facilities list
- Accreditations: NABH / NABL / JCI / ISO

**`src/components/profiles/TrustBadges.tsx`** — on hospital + doctor profile pages:
```
Hospital: [✓ NABH] [✓ NABL]  [✓ Verified by EasyHeals]  [Last verified: Jan 2026]
Doctor:   [MBBS, MD Cardiology]  [Reg: MH-12345]  [22 years exp]  [X patients helped]
```
- Accreditation badges rendered from `hospital.accreditations[]`
- "Verified" badge from `hospital.verified === true`
- Last verified date from `ingestion_field_confidences.last_verified_at`
- "X patients helped" — lead count, shown only with `analytics` consent granted

**`src/components/profiles/ReviewCount.tsx`** — stub for P2 reviews:
- "Be the first to review" if no reviews yet
- Feature-flagged: shows star rating + count when `patient_reviews` flag turns ON in P2

**[CHECKPOINT 2.3a]** — Commit: `[P1-2.3a] Accreditation admin/portal form + FTS5 7-field expansion + TrustBadges component`

---

### Task 2.4 — ~~Leaderboard Endpoint~~ → DEFERRED TO P2
> Leaderboard has no value without gamification APIs. Both ship in P2 together.
>
> **P2 pickup point**:
> - `GET /api/v1/leaderboard/:city?period=monthly`
> - Reads from Redis Sorted Set: `leaderboard:{city}:{period}`
> - Returns top 20: `{ actorId, alias, level, points, rank }` (never full name/phone)
> - Hourly Vercel cron refreshes Redis from `point_events` aggregation
> - UI widget: `src/components/gamification/LeaderboardWidget.tsx`

---

### Task 2.5 — Upgrade Search Intent to /api/v1/
**New file**: `src/app/api/v1/search/intent/route.ts`
(Wraps existing Gemini AI search, adds proper error handling + rate limiting)

`POST /api/v1/search/intent`
- Input: `{ query, city, sessionId }`
- Rate limit: 10 req/min per sessionId (Redis counter, fallback to in-memory)
- Uses existing Gemini search logic
- Errors: `SEARCH_INTENT_FAILED`, `SEARCH_RATE_LIMITED`
- Returns: `{ intent, entities[], results[], cached: bool }`

**[CHECKPOINT 2.5]** — Commit: `[P1-2.5] POST /api/v1/search/intent with rate limiting + AppError`

---

### Task 2.6 — Moderation API (Ingestion Provenance Review)
**New files**:
- `src/app/api/v1/moderation/[id]/approve/route.ts`
- `src/app/api/v1/moderation/[id]/reject/route.ts`

Per HLD §10 frozen API contracts:

`POST /api/v1/moderation/:id/approve`
- Auth: Admin or Advisor JWT
- Input: `{ reviewedBy, notes? }`
- Finds `ingestion_candidates` / `ingestion_field_confidences` record by id
- Sets `review_status = "human_approved"`, `reviewed_by`, `reviewed_at = now()`
- Applies approved value to the live `hospitals` or `doctors` table field
- Logs to `audit_log`
- Returns: `{ entityId, status: "approved" }`
- Errors: `AUTH_FORBIDDEN`, `DB_NOT_FOUND`

`POST /api/v1/moderation/:id/reject`
- Auth: Admin or Advisor JWT
- Input: `{ reviewedBy, reason }`
- Sets `review_status = "rejected"`, preserves original data
- Logs to `audit_log` with rejection reason
- Returns: `{ entityId, status: "rejected" }`
- Errors: `AUTH_FORBIDDEN`, `DB_NOT_FOUND`

> Note: These are separate from `/api/admin/contributions/ai-review` (crowd edits).
> Moderation = ingestion provenance queue. Contributions = crowd-submitted edits.

**[CHECKPOINT 2.6]** — Commit: `[P1-2.6] Moderation API: POST /api/v1/moderation/:id/approve + reject`

---

## DAY 3 — UI + Integration + Admin Hardening

### Task 3.1 — Consent Modal Component
**New file**: `src/components/ConsentModal.tsx`

Design (per HLD §2.3):
- Cannot be dismissed without making a choice
- Shows: "EasyHeals will use your phone number to connect you with [Hospital]. Read more ▸"
- Two buttons: **"I Agree & Continue"** | **"No thanks (exit form)"**
- Separate unchecked checkbox for analytics consent (CANNOT be pre-ticked)
- On agree: calls `POST /api/v1/consent`, stores consentId in local state
- On decline: closes form, no PII captured, shows "anonymous search still available" message

**[CHECKPOINT 3.1]** — Commit: `[P1-3.1] ConsentModal component (DPDP compliant)`

---

### Task 3.2 — Update AppointmentModal → Lead/Callback Form
**File**: `src/components/AppointmentModal.tsx` (update)
**File**: `src/components/profiles/HospitalProfileClient.tsx` (update)
**File**: `src/components/profiles/DoctorProfileClient.tsx` (update)

Changes:
1. Replace "Book Appointment" label with "Request Callback" (P1 is lead-only per HLD §0)
2. Inject `<ConsentModal>` before the form renders
3. Block form submit until consent is granted
4. Change POST target from `/api/book` → `/api/v1/leads`
5. Update success message: "Hospital will call you back within 24 hours"

**[CHECKPOINT 3.2]** — Commit: `[P1-3.2] Update AppointmentModal → RequestCallbackModal with consent gate`

---

### Task 3.3 — Patient OTP Flow (Phone Verification) — Real SMS in P1
**New file**: `src/app/(patient)/verify/page.tsx`
**New file**: `src/app/api/v1/auth/otp/route.ts`

Flow:
1. User enters phone → `POST /api/v1/auth/otp/send` → generates OTP, hashes, stores in `otp_verifications`
2. OTP flood check: >3 requests in 10min → 1h lockout → `RATE_OTP_FLOOD`
3. OTP delivered via notification provider (real SMS in P1 — see below)
4. User enters OTP → `POST /api/v1/auth/otp/verify` → find/create patient by phoneHash
5. On verify: create patient session (TTL 24h, Redis-backed)
6. Gamification: schema hook ready (actual award deferred to P2 APIs)

**SMS Provider for P1 — Twilio (no DLT required)**:
```
NOTIFICATION_PROVIDER=twilio   ← P1 (international, no Indian DLT registration needed)
NOTIFICATION_PROVIDER=msg91    ← P2 (cheaper at ₹0.14/SMS, but requires DLT registration)
```

> ⚠️ **DLT Registration Note**: Indian telecom regulations require DLT (Distributed Ledger
> Technology) registration for transactional SMS from Indian senders. MSG91 requires this.
> Registration takes 2–4 weeks and needs a registered entity + template approval.
> **P1 uses Twilio** (no DLT needed, ~₹0.50/SMS) to unblock launch.
> **P2 migrates to MSG91** after DLT registration completes — change 1 env var.
>
> **Pre-launch gate item**: Twilio account created + phone number purchased + test SMS verified.

Local dev: `NOTIFICATION_PROVIDER=console` (logs OTP to terminal, zero cost, zero infra).

**[CHECKPOINT 3.3]** — Commit: `[P1-3.3] Patient OTP flow + real SMS via Twilio + patient session`

---

### Task 3.4 — Home Page: Trust Section + Gamification Placeholder UI
> Two sections ship in P1: trust signals (live) + gamification teaser (visible but locked).

**Update `src/app/page.tsx`**:

**Section A — Trust Signals (live):**
- "Why EasyHeals?" stats row: verified hospitals count, cities covered, patient inquiries served
- "Recently Verified" hospital cards (`last_verified_at` within 30 days)
- `<TrustBadges />` on featured hospital cards (NABH/NABL/JCI badges)
- Location-aware: hospitals section defaults to detected city (Task 3.10)

**Section B — Gamification Placeholder (visible, locked, teasers P2):**
**New file**: `src/components/gamification/RewardsTeaser.tsx`

```tsx
// Locked/teaser state — shown in P1, becomes interactive in P2
export function RewardsTeaser() {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🏆</span>
        <div>
          <h3 className="font-semibold text-gray-900">Points & Rewards</h3>
          <p className="text-sm text-blue-600">Coming soon</p>
        </div>
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          Beta
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Earn points for every health action — searching, booking, staying informed.
        Top patients in your city get featured on the leaderboard.
      </p>
      <div className="flex gap-4 text-center opacity-60 pointer-events-none">
        <div><p className="text-xl font-bold text-blue-600">—</p><p className="text-xs text-gray-500">Your Points</p></div>
        <div><p className="text-xl font-bold text-blue-600">—</p><p className="text-xs text-gray-500">City Rank</p></div>
        <div><p className="text-xl font-bold text-blue-600">—</p><p className="text-xs text-gray-500">Streak</p></div>
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        Rewards programme launching soon. Stay tuned!
      </p>
    </div>
  );
}
```

Layout on home page (below search bar, above hospital listings):
```
[Trust Stats Row]      ← live
[RewardsTeaser card]   ← placeholder, locked
[Hospital Listings]    ← live, city-filtered
```

In P2, `RewardsTeaser` is replaced by the live `LeaderboardWidget` + `StreakBadge` components
(feature-flagged: `gamification_phase_a` flag OFF → teaser shown; ON → live widget shown).

**[CHECKPOINT 3.4]** — Commit: `[P1-3.4] Home page trust section + gamification teaser placeholder`

---

### Task 3.5 — Admin: Feature Flags Tab
**File**: `src/app/admin/AdminDashboardClient.tsx` (update)

Add tab `"config"` (already in type, now build the UI):
- Table showing all feature flags with toggle
- P2 flags: red OFF badges by default
- P3 flags: grey OUT badges by default
- Toggle calls `PATCH /api/admin/config/flags`
- Display compliance gate checklist items for P2 (12 items from HLD §9.1)

**[CHECKPOINT 3.5]** — Commit: `[P1-3.5] Admin config tab: feature flags + P2 compliance checklist`

---

### Task 3.6 — Notification Provider Abstraction (Twilio fully implemented in P1)
**New files** in `src/lib/notifications/`:
- `provider.interface.ts` — defines `NotificationProvider` with `sendOTP()` + `sendLeadConfirmation()`
- `console.provider.ts` — logs to console (local dev, zero cost)
- `twilio.provider.ts` — **fully implemented in P1** (sends real SMS via Twilio REST API)
- `msg91.provider.ts` — stub with DLT template placeholder (activate in P2 after DLT registration)
- `index.ts` — factory: `getNotificationProvider()` reads `NOTIFICATION_PROVIDER` env

```typescript
// twilio.provider.ts — P1 full implementation
import Twilio from "twilio";
export class TwilioProvider implements OTPSender, LeadNotifier {
  private client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  async sendOTP(phone: string, otp: string) {
    await this.client.messages.create({
      body: `Your EasyHeals verification code is ${otp}. Valid for 10 minutes.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: phone,  // E.164 format: +919876543210
    });
  }
}
```

**New env vars** (add to `.env.local` + Vercel):
```
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

**[CHECKPOINT 3.6]** — Commit: `[P1-3.6] Notification providers: Twilio (P1 live) + console (dev) + MSG91 stub (P2)`

---

### Task 3.7 — SEO Enhancements
**Update files**:
- `src/lib/seo.ts` — add `buildOpenGraphTags()`, `buildTwitterCardTags()`, `buildFAQJsonLd()`, `buildItemListJsonLd()`
- `src/app/hospital/[slug]/page.tsx` — add OG tags + canonical + breadcrumb JSON-LD
- `src/app/doctor/[slug]/page.tsx` — same
- `src/app/hospitals/page.tsx` — add `ItemList` JSON-LD for search listings
- `src/app/layout.tsx` — add `hreflang` (en-IN, hi-IN), global canonical base
- `public/robots.txt` — allow crawlers, block /admin /api /portal
- Every page title format: `[Hospital/Doctor Name] — [City] | EasyHeals`
- Every meta description: `[Specialty] in [City]. Book a callback with [Name]. Verified by EasyHeals.`

**[CHECKPOINT 3.7]** — Commit: `[P1-3.7] SEO: OG tags, Twitter cards, FAQ schema, canonical, hreflang, ItemList JSON-LD`

---

### Task 3.8 — AI Search: Full NLU Pipeline + Suggestions
**Update**: `src/app/api/v1/search/intent/route.ts` (from Task 2.5 — add these on top)
- Language detection (Devanagari script check)
- Gemini Flash intent: returns `{ entity_type, specialty, city, urgency }`
- Hindi transliteration → canonical English term (Gemini handles this)
- "Zero results" handler: Gemini suggests nearby city or related specialty
- Redis cache for intent results (TTL 5 min, keyed by `sha256(query+city)`)

**New file**: `src/app/api/v1/search/suggest/route.ts`
- `GET /api/v1/search/suggest?q=heart&city=Bangalore`
- Prefix match on specialty names + hospital names (FTS5)
- Returns top 5 suggestions with type tags: `{ label, type: "specialty"|"hospital"|"doctor", slug? }`
- Rate limit: 30/min per IP (configurable via system_config)

**New file**: `src/lib/security/bot-guard.ts`
- `checkBotSignature(req)` — UA check + honeypot check + cadence check
- Used in middleware for all `/api/v1/search/*` and `/api/v1/leads` routes

**[CHECKPOINT 3.8]** — Commit: `[P1-3.8] AI search NLU pipeline + suggest endpoint + bot guard`

---

### Task 3.9 — Upgrade Middleware: Rate Limit + Consent Check + Bot Guard
**File**: `src/middleware.ts` (upgrade)

Current: only admin auth guard.
Upgrade to:
1. Rate limit `/api/v1/leads` — max 3 lead submissions per IP per hour
2. Rate limit `/api/v1/search/intent` — 10/min per session
3. Add `X-Request-Id` header for tracing
4. Block `/api/v1/leads` without session or consent (return `LEAD_CONSENT_REQUIRED`)

**[CHECKPOINT 3.9]** — Commit: `[P1-3.9] Middleware: rate limiting + consent enforcement headers`

---

### Task 3.10 — Location-Aware Home Page + AI Health News
**File**: `src/app/page.tsx` (update)
**New file**: `src/app/api/v1/health-news/route.ts`

**Location-aware home (HLD §0 — P1 IN):**
- On first load: browser Geolocation API → `navigator.geolocation.getCurrentPosition()`
- Fallback: IP-based city detection (Vercel `x-vercel-ip-city` header)
- Detected city stored in `patient_session` (Redis) or `localStorage` for anonymous
- Home page search bar pre-fills city — patient can override
- Hospital listings filtered by detected city by default

**AI Health News (HLD §0 — P1 IN, freemium):**
- `GET /api/v1/health-news?city=Bangalore&interests=cardiology`
- Gemini Flash generates 3-5 health tips/news items based on city + patient interests
- Cached in Redis: `ai:health-news:{city}:{interests_hash}` (TTL 4h)
- Consent check: only personalised if `analytics` consent granted; generic if anonymous
- Displayed as a card carousel on home page below the search bar

**[CHECKPOINT 3.10]** — Commit: `[P1-3.10] Location-aware home page + AI health news endpoint`

---

### Task 3.11 — Patient Privacy Page (Right to Erasure)
**New file**: `src/app/(patient)/privacy/page.tsx`
**New file**: `src/app/api/v1/patients/me/route.ts`

Per HLD §9 P2 Gate G10 — deletion flow must be tested before P2.

`GET /api/v1/patients/me` — returns patient's consent records + lead count
`DELETE /api/v1/patients/me` — soft-delete patient (sets `deletedAt = now()`)

**Privacy page UI:**
- Shows all active consents with their purposes and dates
- "Revoke" button per purpose → calls `POST /api/v1/consent/revoke`
- "Delete my account" → confirmation dialog → calls `DELETE /api/v1/patients/me`
  - Soft-delete: `patients.deletedAt = now()` (patient can re-register with same phone)
  - Hard purge cron: Vercel cron runs weekly → deletes soft-deleted patients older than 30 days + orphaned data

**[CHECKPOINT 3.11]** — Commit: `[P1-3.11] Patient privacy page + right-to-erasure endpoint`

---

---

## 🧪 TESTING REQUIREMENTS (DPDP-Critical Paths)

> No full test suite required in P1. These three integration tests are MANDATORY before launch —
> they cover legally required behaviors that cannot be verified by code review alone.
> **Package**: `vitest` (already works with Next.js App Router via `@vitejs/plugin-react`)

### Test 1 — Consent Gate Cannot Be Bypassed
**File**: `src/tests/consent-gate.test.ts`

```typescript
describe("POST /api/v1/leads — consent gate", () => {
  it("blocks lead creation when no consent record exists", async () => {
    const res = await POST("/api/v1/leads", { hospitalId, patientPhone: "+919999999999", symptom: "fever" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "LEAD_CONSENT_REQUIRED" } });
  });

  it("blocks lead creation when consent is revoked", async () => {
    await createConsent(patientId, "booking_lead");
    await revokeConsent(patientId, "booking_lead");
    const res = await POST("/api/v1/leads", { ...validPayload, consentRecordId });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "CONSENT_REVOKED" } });
  });

  it("allows lead creation with valid active consent", async () => {
    const consentId = await createConsent(patientId, "booking_lead");
    const res = await POST("/api/v1/leads", { ...validPayload, consentRecordId: consentId });
    expect(res.status).toBe(201);
  });
});
```

### Test 2 — OTP Flood Protection
**File**: `src/tests/otp-rate-limit.test.ts`

```typescript
describe("POST /api/v1/auth/otp/send — rate limiting", () => {
  it("blocks 4th OTP request within 10 minutes", async () => {
    const phone = "+919888888888";
    for (let i = 0; i < 3; i++) {
      await POST("/api/v1/auth/otp/send", { phone });
    }
    const res = await POST("/api/v1/auth/otp/send", { phone });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: "RATE_OTP_FLOOD" } });
  });

  it("allows OTP after lockout expires (mock time)", async () => {
    vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000)); // 61 minutes later
    const res = await POST("/api/v1/auth/otp/send", { phone: "+919888888888" });
    expect(res.status).toBe(200);
  });
});
```

### Test 3 — Right to Erasure (DPDP §9 G10)
**File**: `src/tests/right-to-erasure.test.ts`

```typescript
describe("DELETE /api/v1/patients/me — right to erasure", () => {
  it("sets deletedAt on the patient row (soft delete)", async () => {
    const { patientId, sessionToken } = await createVerifiedPatient("+919777777777");
    await DELETE("/api/v1/patients/me", { headers: { Authorization: sessionToken } });
    const patient = await db.select().from(patients).where(eq(patients.id, patientId)).get();
    expect(patient?.deletedAt).not.toBeNull();
  });

  it("blocks the deleted patient from submitting new leads", async () => {
    // Re-use same phone after deletion
    const res = await POST("/api/v1/leads", { ...payload, patientPhone: "+919777777777" });
    expect(res.status).toBe(403);
  });

  it("purge cron hard-deletes patients with deletedAt > 30 days", async () => {
    vi.setSystemTime(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
    await runPurgeCron();
    const patient = await db.select().from(patients).where(eq(patients.id, patientId)).get();
    expect(patient).toBeUndefined();
  });
});
```

**Setup**: `npm install -D vitest @vitejs/plugin-react`
Add to `package.json`:
```json
"scripts": { "test": "vitest run", "test:watch": "vitest" }
```
Add `vitest.config.ts` with `testEnvironment: "node"` and `setupFiles: ["./src/tests/setup.ts"]`.

> These tests run against a real in-memory SQLite DB (`:memory:`), not mocks. They test the
> actual route handler + DB layer end-to-end. Never mock the DB for DPDP compliance tests.

---

## 🎨 UX FLOWS (Design Spec — match easyheals.com theme)

### UX-1: Consent Modal (Task 3.1)
```
┌─────────────────────────────────────────────────────┐
│  🏥  Request a Callback                             │
│  ─────────────────────────────────────────────────  │
│  EasyHeals will share your contact with             │
│  **Apollo Hospital, Bangalore** so they can call    │
│  you back to discuss your health query.             │
│                                                     │
│  📋 Read our Privacy Policy ›                       │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  □  Also allow EasyHeals to use my search history  │
│     to show relevant health tips (optional)         │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  [  I Agree & Continue  ]  [  No Thanks  ]         │
│       (blue-600)            (gray outline)          │
└─────────────────────────────────────────────────────┘
```
- Cannot dismiss by clicking outside or pressing Escape
- "No Thanks" closes the entire form — shows: *"You can still search anonymously"*
- Analytics checkbox: default **unchecked**, not pre-ticked (DPDP rule)
- On mobile: full-screen bottom sheet style

### UX-2: Request Callback Form (Task 3.2) — replaces AppointmentModal
```
Step 1: Consent modal (UX-1)
  ↓ (on agree)
Step 2: OTP Verification
  ┌─────────────────────────────────────────┐
  │  Enter your mobile number               │
  │  [+91] [__________]  [Send OTP]        │
  │  We'll connect you with the hospital   │
  └─────────────────────────────────────────┘
  ↓ (OTP sent — console log in P1, SMS in P2)
Step 3: OTP Entry
  ┌─────────────────────────────────────────┐
  │  Enter the 6-digit OTP                  │
  │  [_] [_] [_] [_] [_] [_]              │
  │  Resend in 00:45                        │
  └─────────────────────────────────────────┘
  ↓ (verified)
Step 4: Request Details (pre-filled if known)
  ┌─────────────────────────────────────────┐
  │  Your Name        [________________]   │
  │  Concern / Query  [________________]   │
  │  Preferred time   [Morning ▾]          │
  │  [  Submit Callback Request  ]         │
  └─────────────────────────────────────────┘
  ↓ (submit)
Step 5: Confirmation
  ┌─────────────────────────────────────────┐
  │  ✅ Request Sent!                       │
  │  Apollo Hospital will call you back     │
  │  within 24 hours.                       │
  │  +10 points earned 🏅                  │  ← gamification nudge
  │  [  Done  ]   [  Browse More  ]        │
  └─────────────────────────────────────────┘
```

### UX-3: Gamification Home Widget (Task 3.4)
```
── City Leaderboard ── [Bangalore ▾]  [This Month ▾]
┌──────────────────────────────────────────────┐
│  🥇  Ravi A****  •  Level 5  •  2,840 pts   │
│  🥈  Meena S****  •  Level 4  •  2,200 pts  │
│  🥉  Kiran P****  •  Level 4  •  1,950 pts  │
│  4.  Priya ****  •  Level 3  •  1,200 pts   │
│  5.  Amit ****  •  Level 3  •  980 pts      │
├──────────────────────────────────────────────┤
│  Your rank: #24  •  340 pts                  │  ← logged in only
│  🔥 3-day streak! Keep going                 │
│  [  View Full Leaderboard  ]                 │
└──────────────────────────────────────────────┘
```
- City selector: auto-detected from browser geolocation, can override
- Privacy: only alias + masked phone + city (never full name)
- Anonymous users: see leaderboard but "Login to join" CTA replaces personal stats
- Color: white card, `rounded-xl`, `shadow-sm`, trophy icons use brand blue

### UX-4: OTP Flood / Rate Limit Error States
```
OTP flood: "Too many attempts. Please try again after 1 hour."
           (yellow warning banner — not red — so not scary for patients)
Anonymous limit hit: "Create a free account to continue searching."
                     → triggers OTP flow inline
Lead duplicate: "We already have your request for this hospital.
                 They'll call you soon!" (not an error — reassuring)
```

---

## 🔴 PHASE GATES — DO NOT BUILD AHEAD OF PHASE

### P1 DECISIONS (locked, no rework)
- **TOTP for admin**: `admin` role gets TOTP (Google Authenticator) login in **P2** — not P1. P1 has username+password. Add P2 gate item: "TOTP mandatory for all admin/owner accounts before Phase-2 feature flags activate."
- **API versioning**: New patient-facing endpoints → `/api/v1/`. Existing internal routes (`/api/admin/*`, `/api/portal/*`) stay as-is (not versioned contracts). See ARCHITECTURE.md §K.
- **Provenance columns**: Provenance (source_url, confidence, review_status) lives in `ingestion_field_confidences` (per-field granularity). Hospitals/doctors tables do NOT duplicate these — use JOIN for provenance data. This avoids denormalization drift.
- **Leaderboard privacy**: Public leaderboard shows `displayAlias` + city + level + points only. Phone, full name, health data NEVER shown. opt-out via `patients.leaderboardOptOut` (HLD §3.3.2).

### P2 — Build only after P2 compliance gate passes (HLD §9.1)

> **CRM Integration impact on P2**: CRM Integration (Phases A–F above) must be complete before
> starting P2. Once integrated, several P2 tasks are **significantly reduced** — the CRM already
> has appointments, WhatsApp, documents, and agent pipeline. P2 builds on top, not from scratch.
> Estimated P2 effort reduction: **~40%**.

#### P2 Prerequisites (from CRM Integration)
Before any P2 flag activates:
- [ ] INT Phase A–F complete (shared DB, lead bridge, WhatsApp, FTS5 triggers)
- [ ] F.3 smoke test all green
- [ ] Twilio live SMS confirmed on real device
- [ ] Consent flow verified in staging with real patient
- [ ] TOTP mandatory for all admin/owner accounts (G-TOTP gate)

#### Appointment Booking + CRM
> ⚡ **CRM already has**: `appointments` table (leadId, hospitalId, departmentId, doctorId,
> scheduledAt, status, waConfirmationSent). Extend this table — do not create a new one.

- **Patient appointment booking** — `POST /api/v1/appointments`
  - Reuses CRM `appointments` table (add patientId, consentRecordId, type columns via migration)
  - Appointment type: `in_person | online_consultation`
  - Status lifecycle: `requested → confirmed → in_progress → completed | cancelled | no_show`
  - **CRM migration needed**: `ALTER TABLE appointments ADD COLUMN patient_id TEXT; ADD COLUMN type TEXT DEFAULT 'in_person';`
- **Doctor CRM dashboard** — `GET /api/v1/portal/appointments`
  - Extend CRM's existing doctor portal views — do not rebuild
  - Add consent scope selector (patient history visibility)
- **Hospital portal CRM dashboard** — extend CRM's existing hospital portal
- **Patient dashboard** — `GET /api/v1/patients/me/appointments` — new Next.js route reading shared `appointments` table
- **appointment_slots table** — new (CRM doesn't have this); add via Next.js migration

#### Document Upload
> ⚡ **CRM already has**: `documents` table + AWS S3 storageService + Vercel Blob.
> Next.js prescription uploads should call CRM's storage service via `CRM_INTERNAL_URL/v1/documents`.
> Do NOT build a separate S3 integration in Next.js.

- **Patient document upload** — `POST /api/v1/patients/documents`
  - Proxies to `CRM_INTERNAL_URL/v1/leads/:leadId/documents` using `INTERNAL_API_KEY`
  - Returns Vercel Blob / S3 URL stored in shared `documents` table
- **Prescription AI analysis** — reuse CRM's `POST /v1/prescriptions/upload` (already calls Gemini OCR)

#### Consultation Room (Placeholder — design locked, activation in P3)
> Schema, config, and UI placeholder created in P2 so P3 activation requires zero breaking changes.
- `consultation_room_configs` table — per-doctor/hospital configuration:
  - `provider`: `daily_co | whereby | jitsi | zoom_sdk`
  - `maxParticipants`: 2–10 (free: max 4, paid: max 10)
  - `allowedParticipantTypes`: `['patient','doctor','specialist','coordinator','family_member','interpreter']`
  - `recordingEnabled`: boolean (requires per-session consent from all participants)
  - `waitingRoomEnabled`: boolean, `autoAdmit`: boolean
- `consultation_sessions` table (stub) — linked to appointment, status `scheduled | active | ended`
- `consultation_participants` table (stub) — participant per session, role + timestamps
- **UI placeholder**: locked `ConsultationRoomCard` on appointment detail (feature-flagged `consultation_room=OFF`)
- Async text messaging pre/post appointment: `consultation_messages` table

#### Notifications + Queue
> ⚡ **CRM already has**: Meta WhatsApp API live + `waTemplates` table + mass broadcast tool.
> INT Phase C installs the CRM WhatsApp provider in Next.js. P2 activates it for appointment flows.

- WhatsApp appointment confirmations + reminders — use CRM's `sendWhatsAppTemplate` (already live)
- **MSG91 DLT**: activate only after DLT registration completes — one env var change in CRM
- Token queue live display (Redis SSE) — new, build in P2
- Mass broadcast — reuse CRM's existing broadcast tool; add patient consent gate before sending

#### Gamification
- **Gamification Phase-A APIs** — `POST /api/v1/gamification/event`, `GET /api/v1/leaderboard/:city`,
  `LeaderboardWidget.tsx`, `StreakBadge.tsx` (schema already in P1; validate feature before building)
- Gamification Phase-B (verified appointment/review events — triggered from CRM activity on lead close)

#### Other P2
> ⚡ **CRM already has**: invoice generation, PDF export, agent commission tracking, provider analytics dashboard (Recharts). Reuse rather than rebuild.

- Patient paid membership (Razorpay) — new in Next.js
- **Provider analytics**: expose CRM's existing analytics as a read-only portal view via shared DB
- **TOTP for admin** (HLD §8.2 — mandatory P2 gate item G-TOTP)
- CRM event bus / webhook delivery — use BullMQ already in CRM + outbox pattern from INT-B.4

**P2 Schema changes (extend CRM tables — run as CRM migrations):**
```sql
-- Extend CRM appointments table
ALTER TABLE appointments ADD COLUMN patient_id TEXT REFERENCES patients(id);
ALTER TABLE appointments ADD COLUMN consent_record_id TEXT;
ALTER TABLE appointments ADD COLUMN type TEXT DEFAULT 'in_person';
ALTER TABLE appointments ADD COLUMN source_platform TEXT DEFAULT 'crm';

-- New Next.js-only tables (via Next.js drizzle migration):
-- appointment_slots: id, doctorId, hospitalId, startsAt, endsAt, isBooked
-- consultation_room_configs, consultation_sessions, consultation_participants, consultation_messages
```

**P2 Feature Flags** (seeded as OFF from P1):
`appointment_booking`, `consultation_room`, `whatsapp_notifications`, `token_queue`,
`mass_broadcast`, `gamification_phase_a`, `gamification_phase_b`, `paid_membership`,
`provider_analytics`, `crm_webhooks`

### P3 — Build only after EMR compliance gate passes (HLD §9.2)

#### EMR + Clinical
- EMR-lite (visit records, prescriptions, vitals — BP, weight, blood sugar)
- Lab test ordering + result upload (consent required for lab access)
- E-prescriptions from doctor portal → feeds P5 pharmacy routing

#### Consultation Room — Full Implementation
> Activates the placeholder built in P2. All config, tables, and UI scaffold already exist.
> Only the video provider SDK integration and room orchestration are built here.

**Multi-participant architecture:**
```
Appointment confirmed (type=online_consultation)
  ↓
System creates consultation_session + unique room URL via configured provider
  ↓
Invitations sent (SMS/WhatsApp) to all participants based on consultation_room_configs.allowedParticipantTypes:
  - Patient (required)
  - Primary doctor (required)
  - Specialist / second-opinion doctor (optional — doctor can invite)
  - Hospital coordinator (optional — auto-invited if hospital.consultationCoordinatorEnabled)
  - Family member / caregiver (optional — patient invites up to 2)
  - Medical interpreter (optional — hospital assigns if language mismatch)
  ↓
Waiting room: doctor admits each participant individually (if waitingRoomEnabled=true)
  ↓
Session active: video + audio + text chat in-room
  ↓
Doctor ends session → post-consultation notes saved to EMR visit record
  ↓
If recordingEnabled + all participants consented → recording stored in R2 (2-year retention, DPDP)
```

**Tiers (feature-flagged):**
- **Free tier** (`consultation_room_free=ON`): WebRTC via Jitsi Meet embed, max 4 participants, no recording
- **Paid tier** (`consultation_room_paid=ON`, requires active Razorpay subscription):
  - Provider: Daily.co or Whereby SDK (configurable per hospital via `consultation_room_configs.provider`)
  - Max 10 participants
  - HD video + screen sharing (for reviewing reports/scans)
  - Session recording (per-participant consent required, stored R2)
  - AI-generated session summary (Gemini Flash — opt-in, consent-gated)

**New APIs (P3):**
- `POST /api/v1/consultations/:appointmentId/start` — creates room, generates participant tokens
- `GET /api/v1/consultations/:sessionId/join` — validate + return join URL for authenticated participant
- `POST /api/v1/consultations/:sessionId/invite` — doctor invites additional participant (specialist/family)
- `PATCH /api/v1/consultations/:sessionId/admit/:participantId` — admit from waiting room
- `POST /api/v1/consultations/:sessionId/end` — end session + trigger post-consult flow
- `GET /api/v1/consultations/:sessionId/recording` — consent-gated recording access

**Configuration (admin-managed, per-provider defaults set by EasyHeals admin):**
```
Hospital/doctor sets in portal:
  provider: daily_co | whereby | jitsi         (default: jitsi for free tier)
  maxParticipants: 2-10
  waitingRoomEnabled: true/false
  allowedParticipantTypes: [patient, doctor, specialist, coordinator, family_member, interpreter]
  recordingEnabled: true/false
  autoAdmit: true/false
  sessionTimeoutMinutes: 30-120 (default: 45)
  aiSummaryEnabled: true/false (paid only, requires patient consent)
```

#### Search + Infrastructure
- Typesense migration (replaces FTS5) — better relevance, typo tolerance, faceted filters
- Turborepo monorepo migration (optional — extract `packages/ai`, `packages/db`)

### P4 — Role-Based Portal (HLD v5, 2026-03-18) — Build after P3 stable
> Full spec: see HLD_v5.md. Summary below.
> Phase renumbered: old P4 (Referral/ABHA/Insurance) → P5. Old P5 (Pharmacy) → P6.

#### P4 Architectural Decisions (OVERRIDES + EXTENDS prior decisions)

**OVERRIDE #1 — Document Storage**
> PLAN.md P2 said: "Do NOT build separate S3 in Next.js — proxy to CRM's storage."
> OVERRIDDEN by HLD v5: Document sharing needs per-share expiry, revocation, and audit logging
> that CRM's generic document table cannot support. Use Cloudflare R2 directly from Next.js.
> Integration: presigned upload URL → R2 → metadata in patient_documents table → share via document_shares.

**OVERRIDE #2 — P4 Scope**
> PLAN.md P4 was: Referral engine + ABHA/ABDM + Insurance TPA.
> OVERRIDDEN: These move to P5. P4 is now the full role-based portal (HLD v5 §2-§5).

**NEW — RBAC Expansion**
> Adds `receptionist` sub-role: provider-scoped, invited by hospital_admin, no admin panel access.
> New `provider_staff` table: maps user_id → provider entity + sub_role.
> proxy.ts extended: `/portal/*` routes check provider entity binding.

**NEW — Scheduling Engine**
> `appointment_slots` table (stub in P1 schema) now needs `provider_schedules` configuration:
> working hours, slot duration (default 15 min), break blocks, per-doctor capacity.
> Auto-generation of slots from schedule config (lazy: generate on-demand per date, not pre-generated).

**NEW — Provider Self-Registration**
> Currently providers are admin-created only. P4 adds self-serve onboarding:
> basic listing live immediately → verification docs → admin approval → full features unlocked.
> Feature-flagged: `provider_self_registration` (OFF by default).

#### P4 New DB Tables (migration required)
```sql
-- provider_staff       (receptionist/billing sub-users)
-- patient_documents    (uploads: PDF/image, stored in R2)
-- document_shares      (patient → provider, with expiry + revocation)
-- document_access_log  (every provider access logged — DPDP audit)
-- opd_tokens           (walk-in queue management)
-- provider_schedules   (working hours config per doctor)
```

#### P4 Feature Flags
```
patient_document_upload     OFF → enable after R2 configured
document_sharing            OFF → enable after patient_documents live
provider_self_registration  OFF → enable after approval workflow tested
opd_queue                   OFF → enable per provider on request
provider_staff_mgmt         OFF → enable with receptionist feature
provider_schedule_mgmt      OFF → enable with slot management
```

#### P4 Day Plan

**Phase 4a — Patient + Provider Dashboards (Priority 1 — unblocks testing P1/P2/P3)**
- Day 1: `/dashboard` (patient hub: upcoming appt + quick cards) + `/portal/dashboard` (today timeline)
- Day 2: `/dashboard/appointments` (list + join) + `/portal/appointments` (accept/reject/start consult)
- Day 3: `/dashboard/records` (EMR: visits, prescriptions, vitals) + provider consultation room doc panel

**Phase 4b — Booking + Scheduling**
- Day 4: Full `/book/[providerId]` 4-step booking flow (replaces AppointmentModal)
- Day 5: `/portal/schedule` — slot calendar + working hours config + block/unblock
- Day 6: Slot auto-generation API from provider_schedules config

**Phase 4c — Documents + Sharing**
- Day 7: `/dashboard/documents` — R2 upload (presigned URL) + document list
- Day 8: Share flow (3-step modal) + `/api/v1/patient/documents/[id]/share`
- Day 9: Provider document viewer (share-gated, access logged) + `/portal/documents/shared`

**Phase 4d — Operations**
- Day 10: `/portal/queue` OPD walk-in tokens (SSE for live updates)
- Day 11: `/portal/staff` sub-user management + receptionist invite flow
- Day 12: `/portal/subscription` plan management UI (uses existing payment APIs)

**Phase 4e — Provider Registration + Admin Expansions**
- Day 13: Provider self-registration flow (4-step) + admin approval workflow
- Day 14: Admin: `patients` tab + `providers` verification tab
- Day 15: Admin: `appointments` oversight tab + `documents` audit tab

### P5 — AI Health Memory + Document Intelligence + i18n (HLD v6, Updated 2026-03-19)
> Full spec: HLD_v6.md. ARCHITECTURE.md §H (health module). Summary + task list below.
> Incorporates P4 carry-overs (4c docs/sharing, 4e admin) + old P5 ABHA. 20 missing features tracked.

#### P5 Genuinely Missing Feature Audit (vs P1–P4)

| # | Feature | Was Planned In | Week |
|---|---------|----------------|------|
| 1 | Patient document upload UI + Vercel Blob (replaces CRM proxy) | P4c Day 7 | W1 |
| 2 | `health_documents` + `health_memory_events` + `ai_conversations` tables | HLD v6 | W1 |
| 3 | `document_shares` + `document_access_log` + `previsit_briefs` tables | P4c / HLD v6 | W1 |
| 4 | Gemini Vision document extraction → structured health events | HLD v6 | W1 |
| 5 | `/dashboard/documents` page | P4c Day 7 | W1 |
| 6 | Document sharing modal (patient → provider, expiry + revoke) | P4c Day 8 | W2 |
| 7 | Provider document viewer (`/portal/documents/shared`, access logged) | P4c Day 9 | W2 |
| 8 | Health memory timeline API + `/dashboard/health-timeline` | HLD v6 | W2 |
| 9 | ABHA/ABDM health ID linking | Old P5 | W2 |
| 10 | `/dashboard/privacy` — consent management + right-to-erasure UI | P1 Task 3.11 | W2 |
| 11 | AI Health Coach SSE endpoint + `/dashboard/health-coach` | HLD v6 | W3 |
| 12 | Pre-Visit Brief cron + doctor dashboard integration | HLD v6 | W3 |
| 13 | Full 4-step `/book/[providerId]` booking flow | P4b Day 4 | W4 |
| 14 | Admin: patients tab | P4e Day 14 | W4 |
| 15 | Admin: providers verification tab | P4e Day 14 | W4 |
| 16 | Admin: appointments oversight + document audit tabs | P4e Day 15 | W4 |
| 17 | Provider self-registration 4-step flow (flag-gated) | P4e Day 13 | W4 |
| 18 | Full i18n: next-intl, en.json/hi.json, language switcher | Arch §N P2 | W4 |
| 19 | `/dashboard/rewards` full gamification page | P2 deferred | W4 |
| 20 | Slot auto-generation API from schedule config | P4b Day 6 | W4 |

#### P5 New DB Tables
```sql
-- health_documents: Patient uploaded docs + AI extraction status
CREATE TABLE health_documents (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  blob_url TEXT NOT NULL, file_type TEXT NOT NULL,
  doc_type TEXT, source_name TEXT, doc_date INTEGER, title TEXT,
  ai_status TEXT DEFAULT 'pending', -- pending|processing|done|failed
  uploaded_at INTEGER DEFAULT (unixepoch()*1000), consent_id TEXT REFERENCES consent_records(id)
);
-- health_memory_events: AES-GCM encrypted structured health events from all sources
CREATE TABLE health_memory_events (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  source TEXT NOT NULL, -- emr_visit|prescription|lab_report|device|document|self_report|abha
  source_ref_id TEXT, event_type TEXT NOT NULL, -- vital|lab_result|diagnosis|medication|procedure
  event_date INTEGER NOT NULL, data_encrypted TEXT NOT NULL, is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);
CREATE INDEX hme_patient_date ON health_memory_events(patient_id, event_date DESC);
-- ai_conversations: Multi-turn Health Coach sessions (AES-GCM encrypted)
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  title TEXT, messages_encrypted TEXT NOT NULL, last_message_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);
-- document_shares: Time-limited, revocable patient→provider document shares
CREATE TABLE document_shares (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES health_documents(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  provider_id TEXT NOT NULL, provider_type TEXT NOT NULL, -- hospital|doctor
  expires_at INTEGER NOT NULL, revoked_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);
-- document_access_log: DPDP audit — every provider access recorded
CREATE TABLE document_access_log (
  id TEXT PRIMARY KEY, share_id TEXT NOT NULL REFERENCES document_shares(id),
  accessed_by TEXT NOT NULL REFERENCES users(id),
  accessed_at INTEGER DEFAULT (unixepoch()*1000), ip_hash TEXT
);
-- previsit_briefs: AI-generated patient summaries for doctors (AES-GCM encrypted)
CREATE TABLE previsit_briefs (
  id TEXT PRIMARY KEY, appointment_id TEXT UNIQUE REFERENCES appointments(id),
  patient_id TEXT NOT NULL REFERENCES patients(id), doctor_id TEXT REFERENCES doctors(id),
  brief_encrypted TEXT NOT NULL, generated_at INTEGER DEFAULT (unixepoch()*1000),
  viewed_at INTEGER, consent_id TEXT REFERENCES consent_records(id)
);
```

#### P5 Feature Flags (seed OFF)
```
health_memory              health_documents + health_memory_events active
ai_health_coach            /dashboard/health-coach + SSE endpoint
previsit_brief             doctor-side brief generation cron
document_sharing           patient→provider document shares
abha_integration           ABDM sandbox health ID linking
provider_self_registration 4-step self-serve provider onboarding
i18n_hindi                 Hindi UI strings active
rewards_page               /dashboard/rewards full gamification
slot_auto_generation       on-demand slot generation from schedule config
```

#### P5 New Consent Purposes
```
health_document_processing  gate on first document upload
ai_health_coach             gate on first Health Coach message
provider_health_share       gate before Pre-Visit Brief sent to doctor
abha_link                   gate before ABHA linking initiates
```

#### P5 New Modules
```
src/lib/health/
  encryption.ts    encryptPHI / decryptPHI (AES-256-GCM, HEALTH_PHI_ENCRYPTION_KEY)
  extract.ts       Gemini Vision: blob → { diagnoses[], medications[], labs[], vitals[] }
  context.ts       buildHealthContext(patientId) → Gemini system prompt (~30K tokens)
  memory-writer.ts writeMemoryEvents(patientId, source, events[]) — normalized insert
src/i18n/
  locales/en.json  all UI strings
  locales/hi.json  Hindi translations
  locales/mr.json + ta.json + te.json + kn.json + bn.json + gu.json  (stubs, filled P6)
```

#### P5 API Routes
```
POST   /api/v1/patients/documents               Blob upload + Gemini extract trigger
GET    /api/v1/patients/documents               list docs with AI status
GET    /api/v1/patients/documents/[id]          doc + extracted summary
DELETE /api/v1/patients/documents/[id]          DPDP erasure (blob + events)
POST   /api/v1/patients/documents/[id]/share    create document_share
DELETE /api/v1/patients/documents/[id]/share/[shareId]  revoke share
GET    /api/v1/patients/health-timeline         paginated health_memory_events
GET    /api/v1/patients/health-export           JSON health record export
POST   /api/v1/patients/abha/link              ABDM → link ABHA ID + import records
GET    /api/v1/ai/conversations                 list conversation history
GET    /api/v1/ai/conversations/[id]            full decrypted conversation
POST   /api/v1/ai/health-coach                  SSE stream: message → Gemini → store
GET    /api/portal/documents/shared             provider views shared docs (access logged)
GET    /api/v1/previsit-briefs/[id]            doctor reads brief (logged)
POST   /api/internal/extract-document          async Gemini Vision extraction
POST   /api/cron/previsit-briefs               every 30min brief generation cron
```

#### P5 Week-by-Week Task Plan

**Week 1 — DB Foundation + Document Upload**
- W1-1: `src/db/schema.ts` — add 6 P5 tables (health_documents, health_memory_events, ai_conversations, document_shares, document_access_log, previsit_briefs)
- W1-2: Run `drizzle-kit push` to apply to Turso
- W1-3: `src/lib/health/encryption.ts` — encryptPHI / decryptPHI
- W1-4: `src/lib/health/extract.ts` — Gemini Vision extraction
- W1-5: `src/lib/health/memory-writer.ts` — writeMemoryEvents()
- W1-6: `src/app/api/v1/patients/documents/route.ts` — REWORK (Blob upload + fire-and-forget extract)
- W1-7: `src/app/api/v1/patients/documents/[id]/route.ts` — GET + DELETE (DPDP)
- W1-8: `src/app/api/internal/extract-document/route.ts` — async Gemini Vision → writeMemoryEvents
- W1-9: `src/app/dashboard/documents/page.tsx` + `DocumentsClient.tsx`
- W1-10: Update `DashboardClient.tsx` — quick links: Upload Report, Timeline, Ask Coach, Privacy

**Week 2 — Sharing + Timeline + ABHA + Privacy**
- W2-1: `src/app/api/v1/patients/documents/[id]/share/route.ts` — POST create + DELETE revoke
- W2-2: `src/app/api/portal/documents/shared/route.ts` — GET (access logged)
- W2-3: `src/app/portal/documents/shared/page.tsx` + `SharedDocsClient.tsx`
- W2-4: Share modal in DocumentsClient (provider select, expiry, confirm)
- W2-5: `src/app/api/v1/patients/health-timeline/route.ts` — GET paginated events
- W2-6: `src/app/api/v1/patients/health-export/route.ts` — GET JSON export
- W2-7: `src/app/dashboard/health-timeline/page.tsx` + `HealthTimelineClient.tsx`
- W2-8: `src/app/api/v1/patients/abha/link/route.ts` — ABDM sandbox → writeMemoryEvents
- W2-9: `src/app/dashboard/privacy/page.tsx` + `PrivacyClient.tsx` (consent list, revoke, ABHA link, delete account)
- W2-10: Doctor dashboard sidebar — add "Shared Records" link

**Week 3 — AI Health Coach + Pre-Visit Brief**
- W3-1: `src/lib/health/context.ts` — buildHealthContext(patientId)
- W3-2: `src/app/api/v1/ai/conversations/route.ts` — GET list
- W3-3: `src/app/api/v1/ai/conversations/[id]/route.ts` — GET full
- W3-4: `src/app/api/v1/ai/health-coach/route.ts` — SSE stream
- W3-5: `src/app/dashboard/health-coach/page.tsx` + `HealthCoachClient.tsx`
- W3-6: `src/app/api/internal/generate-brief/route.ts` — Gemini one-shot brief
- W3-7: `src/app/api/cron/previsit-briefs/route.ts` — 30-min cron
- W3-8: `vercel.json` — add previsit-briefs cron `"*/30 * * * *"`
- W3-9: Update doctor dashboard — "View Patient Brief" button + `GET /api/v1/previsit-briefs/[id]`

**Week 4 — i18n + Admin + Booking + Rewards + Slots**
- W4-1: `npm install next-intl`
- W4-2: `src/i18n/locales/en.json` — all UI strings extracted
- W4-3: `src/i18n/locales/hi.json` — Hindi translations
- W4-4: Stub locale files: mr.json, ta.json, te.json, kn.json, bn.json, gu.json
- W4-5: `src/middleware.ts` — next-intl locale detection (cookie → Accept-Language → en)
- W4-6: `LanguageSwitcher` component in nav header + save lang to patient session
- W4-7: Health Coach lang pass-through → Gemini responds in patient's language
- W4-8: Admin: patients tab (list, search, consent view, soft-delete)
- W4-9: Admin: providers verification tab (approval, trust score)
- W4-10: Admin: appointments oversight tab + document audit tab
- W4-11: `src/app/book/[providerId]/` — 4-step booking flow
- W4-12: `src/app/api/v1/provider/schedule/generate/route.ts` — on-demand slot generation
- W4-13: Provider self-registration flow (flag-gated: provider_self_registration)
- W4-14: `src/app/dashboard/rewards/page.tsx` + `RewardsClient.tsx`

#### P5 Gate Checklist
- [ ] HEALTH_PHI_ENCRYPTION_KEY (32-byte hex) set in Vercel env
- [ ] BLOB_READ_WRITE_TOKEN active (Vercel Blob configured)
- [ ] Gemini Vision tested on lab report + prescription + discharge summary
- [ ] AES-256-GCM encrypt/decrypt round-trip verified
- [ ] ABHA sandbox keys from NHA developer portal (abdm.gov.in)
- [ ] Hindi strings native-speaker reviewed before i18n_hindi ON
- [ ] provider_health_share consent gate tested end-to-end before previsit_brief ON

### P6 — Wearable Integration + Care Navigation Engine (HLD v6 §P6)
**Depends on**: P5 (health_memory_events schema in place)
> Absorbs: old P5 Referral Engine (→ Care Navigation) and Insurance TPA (→ cost estimation).
> Full spec: HLD_v6.md §P6.
- Device OAuth2: Fitbit, Google Health Connect, Garmin, Dexcom, Withings
- New tables: `device_connections`, `health_observations`, `health_alerts`, `appointment_ratings`, `treatment_cost_ranges`
- Crons: `device-sync` (hourly), `health-anomaly-check` (daily), `previsit-briefs` (every 30min — already in P5)
- Care Navigation: symptom triage → specialist routing → cost estimation → one-click booking
- Provider Conversion Analytics: funnel, attribution, slot utilization, patient ratings
- Smart lead scoring: AI-enhanced (replaces static 20-point model)
- Regional i18n: Tamil, Telugu, Marathi, Kannada, Bengali, Gujarati (Hindi done in P5)

### P7 — Platform Intelligence + Monetization (HLD v6 §P7)
**Depends on**: P6 (device data + care navigation in place)
> Absorbs: old P6 Pharmacy Prescription Routing (→ P7.4 Lab/Pharmacy Integration).
- AI subscription tiers: Free / Pro ₹2,999/mo / AI Pro ₹7,499/mo / Enterprise
- Patient premium tiers: Free / Health+ ₹299/mo / Health Pro ₹599/mo
- Family health profiles (caregiver role, child/elderly management)
- Lab integration: Apollo Diagnostics, SRL, Metropolis auto-sync → health memory
- Pharmacy integration: PharmEasy/1mg prescription fulfillment (supersedes old P6 pharmacy routing)
- Instant teleconsult marketplace (AI-matched, <10min)
- React Native app (iOS HealthKit + Android Health Connect native SDK)
- New roles: `pharmacy_admin` (deferred from old P5 to P7)

---

## 📦 FINAL FILE STRUCTURE (after all P1 tasks complete)

```
src/
├── app/
│   ├── api/
│   │   ├── v1/                              ← NEW — versioned, frozen on ship
│   │   │   ├── consent/route.ts
│   │   │   ├── leads/route.ts
│   │   │   ├── search/
│   │   │   │   ├── intent/route.ts
│   │   │   │   └── suggest/route.ts
│   │   │   └── auth/otp/route.ts
│   │   │   (gamification/event + leaderboard/:city → P2)
│   │   ├── cron/                            ← NEW — Vercel cron triggers
│   │   │   ├── staleness-scan/route.ts
│   │   │   ├── outbox-processor/route.ts    ← P2 stub (returns skip if flag OFF)
│   │   │   └── search-reindex/route.ts      ← P3 stub (returns skip if flag OFF)
│   │   ├── health/route.ts                  ← UPGRADE existing
│   │   └── admin/* + portal/* + auth/*      ← KEEP EXISTING
│   ├── (patient)/                           ← NEW — patient auth group
│   │   ├── verify/page.tsx
│   │   ├── privacy/page.tsx                 ← NEW Task 3.11 (right to erasure)
│   │   └── rewards/page.tsx                 ← P2 (gamification deferred)
│   └── page.tsx                             ← UPDATE: trust section + location-aware
├── components/
│   ├── ConsentModal.tsx                     ← NEW
│   ├── RequestCallbackModal.tsx             ← NEW (replaces AppointmentModal)
│   ├── profiles/
│   │   ├── TrustBadges.tsx                  ← NEW (Task 2.3a)
│   │   └── ReviewCount.tsx                  ← NEW stub (P2 reviews feature-flagged)
│   └── gamification/                        ← P2 (schema exists, UI deferred)
│       ├── LeaderboardWidget.tsx            ← P2
│       └── StreakBadge.tsx                  ← P2
├── db/
│   └── schema.ts                            ← UPDATE: +14 tables + FTS5 DDL + stubs
└── lib/
    ├── core/                                ← NEW
    │   ├── db.ts                            (re-export existing)
    │   └── redis.ts                         (Upstash singleton)
    ├── ai/                                  ← REFACTOR from gemini.ts
    │   ├── client.ts                        ← NEW Task 0.6: singleton + timeout + token tracker
    │   ├── providers/
    │   │   ├── provider.interface.ts
    │   │   └── gemini.provider.ts
    │   ├── operations/
    │   │   ├── search-intent.ts
    │   │   └── health-news.ts
    │   ├── cache.ts
    │   └── cost-tracker.ts
    ├── search/                              ← NEW
    │   ├── provider.interface.ts
    │   ├── fts5.provider.ts
    │   ├── typesense.provider.ts            ← P3 stub
    │   └── index.ts
    ├── notifications/                       ← NEW
    │   ├── provider.interface.ts            (includes P2 WhatsApp + P3 FCM stubs)
    │   ├── console.provider.ts
    │   ├── msg91.provider.ts                ← P2 stub (env.ts already has MSG91_AUTH_KEY!)
    │   ├── twilio.provider.ts               ← P2 stub
    │   ├── whatsapp.provider.ts             ← P2 stub
    │   ├── fcm.provider.ts                  ← P3 stub
    │   └── index.ts
    ├── payments/                            ← NEW
    │   ├── provider.interface.ts
    │   ├── console.provider.ts              ← P1: no-op
    │   ├── razorpay.provider.ts             ← P2 stub
    │   └── index.ts
    ├── security/                            ← NEW
    │   ├── consent.ts
    │   ├── encryption.ts                    (AES-256 phone encryption)
    │   ├── otp.ts                           (generate + hash + verify)
    │   ├── phi-redactor.ts
    │   └── bot-guard.ts
    ├── gamification/                        ← P2 (schema in P1; lib built in P2)
    │   ├── award.ts                         ← P2
    │   ├── caps.ts                          ← P2
    │   ├── proof-validator.ts               ← P2 Phase-B stub
    │   ├── abuse-detector.ts                ← P2
    │   └── refresh-leaderboard.ts           ← P2
    ├── crm/                                 ← NEW
    │   ├── events.ts                        (topic type definitions)
    │   ├── outbox.ts                        (publishEvent → DB)
    │   └── processor.ts                     ← P2 stub
    ├── analytics/                           ← NEW
    │   ├── events.ts
    │   └── track.ts                         (consent-gated writes)
    ├── observability/                       ← NEW
    │   ├── logger.ts                        (PHI-safe structured)
    │   ├── metrics.ts
    │   └── health.ts
    ├── config/                              ← NEW
    │   ├── feature-flags.ts
    │   └── system-config.ts
    ├── errors/                              ← NEW
    │   └── app-error.ts
    ├── i18n/
    │   └── server.ts                        ← NEW wrapper
    ├── emr/
    │   └── index.ts                         ← P3 stub (feature flag check only)
    ├── referral/
    │   └── index.ts                         ← P4 stub (feature flag check only)
    └── env.ts                               ← UPDATE: add all new env vars
```

**Updated `vercel.json`** — add 4 cron jobs (ARCHITECTURE.md §J)
**Updated `next.config.ts`** — add security headers (ARCHITECTURE.md §M)

---

## 🏁 CHECKPOINT SUMMARY

| # | Task | Commit Tag | Status | Day |
|---|------|-----------|--------|-----|
| 0.1 | Hash session tokens before DB storage (B1 fix) | `[PRE-P1]` | ☐ | 0 |
| 0.2 | Document middleware auth model (B2 fix) | `[PRE-P1]` | ☐ | 0 |
| 0.3 | Rate-limit /api/book + deprecation headers (B3 fix) | `[PRE-P1]` | ☐ | 0 |
| 0.4 | PHI redaction in audit log writes (B4 fix) | `[PRE-P1]` | ☐ | 0 |
| 0.5 | Legacy lead migration: link existing leads to patient rows | `[PRE-P1]` | ☐ | 0 |
| 0.6 | AI client singleton: timeout + token tracking (C1/C2 fix) | `[PRE-P1]` | ☐ | 0 |
| 1.1 | Schema: 14 new tables + FTS5 DDL + stubs on existing (P1-P4 compatible) | `[P1-1.1]` | ☐ | 1 |
| 1.2 | DB migration (6 migration files) + seed data | `[P1-1.2]` | ☐ | 1 |
| 1.2b | Refactor lib/ modules into ARCHITECTURE.md structure | `[P1-1.2b]` | ☐ | 1 |
| 1.3 | AppError class + error code taxonomy | `[P1-1.3]` | ☐ | 1 |
| 1.4 | Feature flag system (DB + Redis cache) | `[P1-1.4]` | ☐ | 1 |
| 1.5 | GET /api/health (db + redis + ai + features) | `[P1-1.5]` | ☐ | 1 |
| 1.6 | Core infra: Redis, encryption, OTP, CRM outbox, analytics, logger, search | `[P1-1.6]` | ☐ | 1 |
| 2.1 | POST /api/v1/consent + consent lib | `[P1-2.1]` | ☐ | 2 |
| 2.2 | POST /api/v1/leads (consent gate + patient linking) | `[P1-2.2]` | ☐ | 2 |
| 2.3a | Trust signals: accreditation badges, doctor credentials, verified indicator | `[P1-2.3a]` | ☐ | 2 |
| 2.3 | ~~Gamification Phase-A event API~~ → **P2** | — | ⏭ | — |
| 2.4 | ~~GET /api/v1/leaderboard/:city~~ → **P2** | — | ⏭ | — |
| 2.5 | POST /api/v1/search/intent + GET /api/v1/search/suggest | `[P1-2.5]` | ☐ | 2 |
| 2.6 | POST /api/v1/moderation/:id/approve + reject | `[P1-2.6]` | ☐ | 2 |
| 3.1 | ConsentModal component (DPDP compliant, mobile bottom sheet) | `[P1-3.1]` | ☐ | 3 |
| 3.2 | RequestCallbackModal: 5-step flow (consent→OTP→details→confirm) | `[P1-3.2]` | ☐ | 3 |
| 3.3 | Patient OTP flow + Redis session | `[P1-3.3]` | ☐ | 3 |
| 3.4 | Home page trust section (replaces gamification widget) | `[P1-3.4]` | ☐ | 3 |
| 3.5 | Admin config tab: feature flags + system_config editor | `[P1-3.5]` | ☐ | 3 |
| 3.6 | Notification provider abstraction (console → MSG91/Twilio/WhatsApp stubs) | `[P1-3.6]` | ☐ | 3 |
| 3.7 | SEO: OG, Twitter cards, FAQ/ItemList schema, canonical, hreflang | `[P1-3.7]` | ☐ | 3 |
| 3.8 | AI search: full NLU pipeline + suggest + bot guard | `[P1-3.8]` | ☐ | 3 |
| 3.9 | Middleware: configurable rate limiting + bot guard + cookie migration | `[P1-3.9]` | ☐ | 3 |
| 3.10 | Location-aware home + AI health news endpoint | `[P1-3.10]` | ☐ | 3 |
| 3.11 | Patient privacy page + right-to-erasure endpoint | `[P1-3.11]` | ☐ | 3 |
| T | 3 DPDP integration tests (consent gate, OTP flood, erasure) | `[P1-TEST]` | ☐ | 3 |

---

## ⚡ HOW TO MARK PROGRESS

When a task is done, update the STATUS block at the top of this file:
```
PHASE: DAY 2 COMPLETE
LAST COMPLETED TASK: Task 2.4 — Leaderboard endpoint
NEXT TASK: Task 2.5 — Search intent v1
```

And check the box in the checkpoint table above.
