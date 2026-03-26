# EasyHeals — CRM + Next.js Platform Integration Plan
## Version: 1.0 | Date: 2026-03-17
## Systems: easyheals-next (Next.js) ↔ EasyHeals CRM (Express + React)

---

## Executive Summary

Both systems already use:
- **Same DB engine**: Turso (libSQL/SQLite) with Drizzle ORM
- **Same AI**: Google Gemini 2.5 Flash
- **Same env vars**: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`

**Integration strategy: Single Turso database, two backend services.**

The CRM continues to run as the internal staff tool. The Next.js platform is the public-facing layer. Both read/write to the **same Turso database instance** — no sync, no duplication, no webhooks needed for core data.

---

## Current State

### CRM (C:\Biswajit\Antigravity Google\EasyHeals)
| Area | Stack |
|------|-------|
| Backend | Express.js v5, JWT auth, BullMQ task queue |
| Frontend | Vite + React 19, Zustand, React Query |
| DB | Turso (libSQL) + Drizzle ORM |
| Storage | AWS S3 (prescriptions) + Vercel Blob (docs) |
| WhatsApp | Meta Business API (WA_ACCESS_TOKEN) |
| Email | Nodemailer (SMTP) |
| AI | Gemini 2.5 Flash + Anthropic SDK |
| Deployment | Vercel (monorepo) |

**CRM tables**: users, hospitals, departments, doctors, agents, leads, attendants, documents, appointments, activities, invoices, waTemplates, auditLog (13 tables)

### Next.js Platform (easyheals-next)
| Area | Stack |
|------|-------|
| Backend | Next.js 16 App Router, session auth, OTP auth |
| DB | Turso (libSQL) + Drizzle ORM |
| AI | Gemini 2.5 Flash |
| WhatsApp | MSG91 stub (not live) |
| Deployment | Vercel |

**Next.js tables (P1)**: hospitals, doctors, treatments, leads, patients, consent_records, otp_verifications, sessions, users, roles, user_role_map, feature_flags, system_config, analytics_events, gamification tables + more (51 tables)

---

## Schema Conflicts & Resolution

Both systems define tables with the same names but different columns.

### Conflict Map

| Table | CRM columns | Next.js columns | Resolution |
|-------|------------|-----------------|-----------|
| `hospitals` | contactPerson, contactEmail, emailIds[], accreditation, isActive | slug, specialties, facilities, rating, verified, packages, accreditations[], isActive | **Merge** — add slug + specialties + rating to CRM columns |
| `doctors` | specialization, hospitalId, departmentId, qualification, experienceYears | slug, specialties, bio, qualifications[], languages, fees, verified | **Merge** — add slug + bio + verified to CRM columns |
| `leads` | 47 columns incl. refId, name, phone, agentId, assignedTo, status, visaLetterData | patientId, consentRecordId, medicalSummary, status | **Extend CRM** — add patientId + consentRecordId to CRM leads |
| `users` | role, permissions JSON, linkedAgentId, JWT-based | role via user_role_map, googleId, googleAvatar, session-based | **Keep separate** — different auth models, different surfaces |
| `appointments` | leadId, hospitalId, departmentId, doctorId, scheduledAt, waConfirmationSent | P2 scope — not yet built | **Use CRM schema** — Next.js P2 extends it |
| `documents` | leadId, docType, fileUrl, uploadedBy | P2 scope — not yet built | **Use CRM schema** |

### Tables with No Conflict (exclusive ownership)

| Owner | Tables |
|-------|--------|
| CRM only | agents, attendants, invoices, waTemplates, activities, auditLog, departments |
| Next.js only | patients, consent_records, otp_verifications, feature_flags, system_config, gamification_*, analytics_events, specialty_synonyms, sessions (Next.js admin), user_role_map, roles |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SINGLE TURSO DATABASE                       │
│                                                                  │
│  CRM-owned tables          Shared tables       Next.js-only     │
│  ───────────────           ─────────────       ────────────      │
│  agents                    hospitals           patients          │
│  attendants                doctors             consent_records   │
│  invoices                  leads*              otp_verifications │
│  waTemplates               departments         feature_flags     │
│  activities                appointments        system_config     │
│  auditLog (CRM)            documents           gamification_*    │
│                            users (separate)    analytics_events  │
└─────────────────────────────────────────────────────────────────┘
         ▲                                              ▲
         │                                              │
 ┌───────┴────────┐                         ┌──────────┴──────────┐
 │  Express API   │◄──── lead.created ──────│  Next.js Platform   │
 │  (CRM backend) │     (DB row visible)    │  (public-facing)    │
 │  Port 3000     │                         │  Port 4000          │
 │                │                         │                     │
 │  Staff CRM     │                         │  Patient OTP auth   │
 │  Agent portal  │                         │  Consent management │
 │  Invoicing     │                         │  Public search      │
 │  WhatsApp      │                         │  SEO profiles       │
 │  S3 documents  │                         │  RewardsTeaser      │
 └────────────────┘                         └─────────────────────┘
```

*`leads` table is extended — both services can read it; patients write via Next.js, staff manage via CRM.

---

## Implementation Plan

### PHASE A — Database Consolidation (Day 1)
> Goal: Point both services at one Turso DB. Reconcile schema conflicts.

#### A.1 — Identify which DB is more populated
- Compare row counts: hospitals, doctors, leads in both DBs
- The DB with more data becomes the **primary**
- Export-import the smaller DB's data into the primary

#### A.2 — Extend CRM `hospitals` table (Drizzle migration in CRM)
Add these columns to CRM's hospitals table (they don't exist there yet):
```sql
ALTER TABLE hospitals ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE hospitals ADD COLUMN specialties TEXT DEFAULT '[]';  -- JSON array
ALTER TABLE hospitals ADD COLUMN facilities TEXT DEFAULT '[]';   -- JSON array
ALTER TABLE hospitals ADD COLUMN accreditations TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE hospitals ADD COLUMN rating REAL DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN verified INTEGER DEFAULT 0;     -- boolean
ALTER TABLE hospitals ADD COLUMN verified_at INTEGER;            -- timestamp_ms
ALTER TABLE hospitals ADD COLUMN description TEXT;
ALTER TABLE hospitals ADD COLUMN packages TEXT DEFAULT '[]';     -- JSON array
ALTER TABLE hospitals ADD COLUMN latitude REAL;
ALTER TABLE hospitals ADD COLUMN longitude REAL;
```
Backfill: `UPDATE hospitals SET slug = lower(replace(name, ' ', '-')) || '-' || id WHERE slug IS NULL`

#### A.3 — Extend CRM `doctors` table
```sql
ALTER TABLE doctors ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE doctors ADD COLUMN bio TEXT;
ALTER TABLE doctors ADD COLUMN languages TEXT DEFAULT '[]';    -- JSON array
ALTER TABLE doctors ADD COLUMN fees TEXT DEFAULT '{}';         -- JSON
ALTER TABLE doctors ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE doctors ADD COLUMN rating REAL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE doctors ADD COLUMN consultation_fee INTEGER;
```

#### A.4 — Extend CRM `leads` table (DPDP bridge columns)
```sql
ALTER TABLE leads ADD COLUMN patient_id TEXT REFERENCES patients(id);
ALTER TABLE leads ADD COLUMN consent_record_id TEXT REFERENCES consent_records(id);
ALTER TABLE leads ADD COLUMN phone_hash TEXT;  -- SHA-256(phone+PHONE_SALT)
```
These are nullable — existing CRM leads have NULL here; new patient-submitted leads have values.

#### A.5 — Apply Next.js P1 schema migrations to the primary DB
Run `npm run db:migrate` from easyheals-next against the consolidated DB.
All Next.js-only tables (patients, consent_records, feature_flags, etc.) are created.

#### A.6 — Update both services to point to the same Turso DB
Update `.env` files so both services share `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

---

### PHASE B — Lead Pipeline Bridge (Day 2)
> Goal: Patient-submitted leads (Next.js) automatically appear in the CRM pipeline.

#### B.1 — Patient lead becomes a CRM lead
When `POST /api/v1/leads` creates a lead in Next.js, the lead is written to the shared `leads` table with:
- All CRM standard columns (name from consent, phone from OTP session, hospitalId, status: "new")
- DPDP columns: patientId, consentRecordId, phoneHash
- `refId` generated with CRM's pattern: `EH-100001` format
- `source = "easyheals_platform"` (distinguishes from CRM-entered or agent leads)

The CRM sees this lead immediately in the pipeline — no webhook, no polling. Same DB.

Update `src/app/api/v1/leads/route.ts` to generate refId and populate CRM lead columns:

```typescript
// Add to lead insert in /api/v1/leads/route.ts
const refId = await generateCrmRefId(db);  // query MAX(ref_id), increment
const [newLead] = await db.insert(leads).values({
  // existing fields
  hospitalId, patientId, consentRecordId, medicalSummary, status: "new",
  // NEW: CRM-compatible fields
  refId,
  phone: "[hashed-identity]",   // do NOT store raw phone
  phoneHash,                     // for staff to match via OTP verification
  source: "easyheals_platform",
  score: 30,
}).returning({ id: leads.id });
```

#### B.2 — CRM lead detail page shows consent status
Add a read-only "Patient Consent" section to the CRM lead detail view:
- Reads from `consent_records` table using `leads.patient_id`
- Shows: granted purposes, grantedAt, channel
- Warning banner if no active `booking_lead` consent (e.g. legacy CRM-entered lead)
- This is a CRM frontend change (apps/crm/src/pages/Leads.jsx or lead detail page)

#### B.3 — CRM phone display
Since `leads.phone` is now empty for patient-submitted leads:
- CRM lead detail shows "Phone verified via OTP" with phoneHash
- Staff call patient by having patient call back via the listed hospital number
- Full phone available only if patient explicitly shares via encrypted `phone_encrypted` field (P2)

---

### PHASE C — Replace MSG91 with CRM WhatsApp (Day 3)
> Goal: Use CRM's live Meta WhatsApp API instead of the MSG91 stub.

#### C.1 — Update Next.js notification provider
Replace the MSG91 stub with a call to the CRM Express API:

**New provider: `src/lib/notifications/whatsapp-crm.provider.ts`**
```typescript
// Calls CRM's POST /v1/whatsapp/send endpoint
// Uses shared WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID
export class WhatsAppCrmProvider implements NotificationProvider {
  async sendOTP(phone: string, otp: string, lang: string): Promise<void> {
    // POST to CRM's /v1/whatsapp/send with templateName: "otp_verification"
  }
  async sendLeadConfirmation(phone: string, refId: string): Promise<void> {
    // POST to CRM's /v1/whatsapp/send with templateName: "lead_confirmed"
  }
}
```

Or simpler: import `sendWhatsAppTemplate` directly from CRM service (if running in same Node process via monorepo, or call the API endpoint).

#### C.2 — Add OTP WhatsApp template to CRM
Create `otp_verification` template in CRM waTemplates table:
```
Body: "Your EasyHeals verification code is {{otp}}. Valid for 10 minutes. Do not share this code."
Variables: [otp]
```

#### C.3 — Lead confirmation WhatsApp message
When patient lead is created via Next.js, send WhatsApp confirmation:
```
"Hello! Your callback request (ID: {{refId}}) has been received.
Our health advisor will contact you within 24 hours. - EasyHeals"
```

---

### PHASE D — Hospital/Doctor Data Unification (Day 4)
> Goal: Admin populates data once (in CRM), Next.js public pages reflect it automatically.

#### D.1 — CRM becomes the single admin for hospital/doctor data
- Next.js admin `hospitals` tab remains for viewing and quick edits
- CRM's master data section is the canonical source for detailed hospital management
- Remove duplication: don't maintain two separate admin UIs for the same data

#### D.2 — Hospital slug generation in CRM
Add slug generation to CRM's `POST /v1/masters/hospitals` route:
```javascript
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-') + '-' + city.toLowerCase();
// ensure unique: check DB, append counter if needed
```

#### D.3 — Next.js profile pages use unified data
`src/lib/profile-data.ts` already queries the `hospitals` table by slug.
After schema merge (Phase A), this works against the shared DB automatically.
No code change needed — the data will be there.

#### D.4 — Admin ingestion results (brochure/AI research) flow to CRM
When Next.js admin uses the brochure or AI research tab and saves a hospital:
- Writes to the shared `hospitals` table
- CRM sees it immediately in Masters
- CRM admin can add contactPerson, email, agent assignment from their side

---

### PHASE E — Shared Auth Bridge (Day 5, Optional)
> Goal: Staff don't need two logins.

The two auth systems are architecturally different:
- CRM: JWT, 24h expiry, stored in localStorage
- Next.js admin: session cookie, DB-backed, httpOnly

**Option 1 (Recommended for now): Keep separate**
- CRM staff use CRM login for pipeline management
- Next.js admin uses Next.js login for ingestion, AI research, config
- Both are internal tools — two logins is acceptable

**Option 2 (Future): SSO via shared JWT**
- Add a Next.js middleware that accepts CRM JWT for admin routes
- CRM JWT payload: `{ id, email, role }` — map to Next.js RBAC roles
- Implementation: `src/lib/auth.ts` adds a JWT path alongside session path

---

### PHASE F — CRM Outbox Consumer (Day 6)
> Goal: Next.js CRM outbox events are processed by CRM without external HTTP calls.

Currently `src/lib/crm/outbox.ts` publishes events to a DB outbox table.
The consumer (background job) should call CRM's Express service.

#### F.1 — CRM processes Next.js outbox events
Add a new CRM route: `POST /v1/internal/outbox/process`
- Reads unprocessed events from the shared `outbox` table
- Processes: `lead.created` → assign to advisor, send WhatsApp
- Processes: `patient.consent_granted` → trigger CRM welcome flow
- Protected with `INTERNAL_API_KEY` header (not JWT)

#### F.2 — Next.js outbox processor
Create a cron/background job that runs every 30s:
- Reads pending outbox events
- POSTs to `CRM_INTERNAL_URL/v1/internal/outbox/process`
- Marks events as processed

Or simpler: Since shared DB, CRM can poll outbox directly using BullMQ (already set up in CRM).

---

## Environment Variables — Unified

Both services need these added/aligned in their `.env` files:

```env
# ── SHARED (same values in both) ──────────────────────
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

GEMINI_API_KEY=your-gemini-key

WA_ACCESS_TOKEN=your-meta-wa-token
WA_PHONE_NUMBER_ID=your-phone-number-id

# ── CRM-ONLY ──────────────────────────────────────────
REDIS_URL=redis://...
JWT_SECRET=your-jwt-secret
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=easyheals-prescriptions
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASS=...

# ── NEXT.JS-ONLY ──────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
PHONE_SALT=your-hmac-salt-for-phone-hashing
PHONE_ENCRYPTION_KEY=32-byte-hex-key
SESSION_SECRET=your-next-session-secret
CRM_INTERNAL_URL=https://your-crm.vercel.app  # for outbox consumer
INTERNAL_API_KEY=shared-secret-for-crm-calls
```

---

## What Gets Reused (No Rebuild Needed)

| CRM Asset | Reuse in Next.js |
|-----------|-----------------|
| `hospitals` + `doctors` data | Direct read from shared DB |
| WhatsApp service (sendWhatsAppTemplate) | Called from Next.js notification provider |
| S3 document service | Called from Next.js for prescription uploads |
| Agent portal | Unchanged — agents submit leads, appear in shared DB |
| Invoice generation | Unchanged — CRM generates invoices for all leads |
| Lead pipeline (Kanban) | Unchanged — CRM staff manage all leads incl. patient-submitted |
| BullMQ task queue | Can process Next.js outbox events |
| Department taxonomy | Shared `departments` table — Next.js reads directly |
| Activity audit trail | CRM `activities` table — Next.js can append via API |
| WhatsApp templates | Shared `waTemplates` table |

---

## What Changes (Migration Tasks)

| Task | Effort | Phase |
|------|--------|-------|
| Merge hospital/doctor columns (Drizzle migration in CRM) | Low | A |
| Add patientId/consentRecordId to CRM leads table | Low | A |
| Point both .env files to same Turso DB | Trivial | A |
| Generate refId in Next.js lead creation | Low | B |
| WhatsApp provider for OTP (Next.js → CRM WA service) | Medium | C |
| Hospital slug generation in CRM masters route | Low | D |
| CRM lead detail: consent status display | Medium | D |
| CRM outbox consumer route | Medium | F |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema migration breaks CRM data | Medium | High | Test migration on a DB snapshot first |
| CRM Express + Next.js both writing to same table concurrently | Low | Medium | No overlapping write paths — CRM owns leads/hospitals master; Next.js only inserts new leads |
| Phone privacy: CRM staff see patient phone hash, not raw phone | Low | Low | Staff are trained; raw phone available via OTP-confirmed callback only |
| WhatsApp template mismatch (OTP template not approved) | Medium | Medium | Test with console provider first; activate WA only after template approval |
| CRM lead schema change breaks Next.js lead insert | Low | Medium | Next.js only inserts; uses named columns not SELECT * |

---

## Recommended Execution Order

```
Week 1 — Phase A + B (Database consolidation + lead bridge)
  Day 1: Snapshot both DBs. Identify primary. Apply schema extensions.
  Day 2: Point both services to single DB. Test CRM pipeline still works.
  Day 3: Update Next.js lead creation to populate CRM-compatible columns.
  Day 4: Verify patient lead appears in CRM pipeline end-to-end.

Week 2 — Phase C + D (WhatsApp + data unification)
  Day 1: Add OTP WA template in CRM waTemplates. Build WA provider in Next.js.
  Day 2: Test OTP via WhatsApp (real phone). Enable in staging.
  Day 3: CRM lead detail — add consent status panel.
  Day 4: Hospital slug + profile page smoke test.

Week 3 — Phase F (Outbox + observability)
  Day 1: CRM internal outbox consumer route.
  Day 2: Next.js cron job to process outbox.
  Day 3: End-to-end test: patient submits → OTP → consent → lead → CRM assigns → WA sent.
```

---

## Phase 2 Impact

Phase 2 (appointments, WhatsApp notifications, gamification) is now significantly simplified:

| P2 Feature | Without integration | With integration |
|-----------|---------------------|-----------------|
| Appointment booking | Build from scratch | Extend CRM's `appointments` table |
| WhatsApp notifications | Build MSG91 DLT | Use CRM's live Meta WA API |
| Document upload | Build S3 integration | Use CRM's existing `storageService.js` |
| Doctor CRM dashboard | Build new portal | Extend CRM's existing doctor views |
| Lead assignment | Build in Next.js | Already in CRM |

**Estimated P2 effort reduction: ~40%** — the hard infrastructure is already in the CRM.

---

*Plan authored: 2026-03-17*
*Review before Phase A begins — confirm DB merge approach with both teams.*
