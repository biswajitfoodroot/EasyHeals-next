# EasyHeals — HLD v5 (Role-Based Platform)
## Version: 5.0 | Created: 2026-03-18 | Extends: HLD v4 + P1/P2/P3 PLAN.md
## Scope: Patient Portal · Provider Portal · Admin Super-Control · RBAC · UI Screens

---

## 0. WHAT'S NEW IN v5

v4 (PLAN.md) covers infrastructure, APIs, search, EMR, video consultation, and payments.
v5 adds the full **role-based access model** with complete UI specifications for:
- Patient login, dashboard, documents, appointments, and sharing
- Provider (Hospital/Doctor/Clinic) portal, scheduling, online consult, subscriptions
- Staff/Receptionist sub-user support
- Admin super-control expansions
- UI wireframe specifications for every screen

---

## 1. ROLES & ACCESS CONTROL (RBAC)

### 1.1 Role Taxonomy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EASYHEALS ROLES                              │
├──────────────────┬──────────────────────────────────────────────────┤
│ PATIENT          │ Self-registered via OTP. Access own data only.   │
├──────────────────┼──────────────────────────────────────────────────┤
│ PROVIDER GROUP   │ Hospital / Clinic / Doctor entity                │
│  ├ hospital_admin│ Manage own hospital listing + staff              │
│  ├ doctor        │ Own schedule + consultations                     │
│  └ receptionist  │ Appointments + queue only (NEW sub-role)         │
├──────────────────┼──────────────────────────────────────────────────┤
│ ADMIN GROUP      │ EasyHeals internal staff                         │
│  ├ owner         │ Full platform control + user management          │
│  ├ admin         │ Full CRUD, no user delete                        │
│  ├ advisor       │ Edit content + AI tools, no user mgmt           │
│  └ viewer        │ Read-only                                        │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 1.2 RBAC Enforcement Matrix

| Resource                   | patient | hospital_admin | doctor | receptionist | admin/owner |
|----------------------------|---------|----------------|--------|--------------|-------------|
| Own appointments           | CRUD    | R              | R      | CRUD         | CRUD        |
| Provider appointments      | R(own)  | CRUD           | CRUD   | CRUD         | CRUD        |
| Own documents/uploads      | CRUD    | –              | –      | –            | R+audit     |
| View shared documents      | –       | R(shared only) | R(shared only) | – | R+audit |
| Prescriptions (write)      | –       | –              | CRU    | –            | R           |
| Prescriptions (read)       | R(own)  | –              | R(own pts) | –        | R           |
| Vitals (write)             | CRU(self) | –            | CRU    | –            | R           |
| Provider profile           | –       | CRU (approval) | CRU   | R            | CRUD        |
| Slot management            | –       | CRU            | CRU    | R            | CRUD        |
| Subscription billing       | –       | R+pay          | –      | –            | CRUD        |
| User management            | –       | R(own staff)   | –      | –            | CRUD        |
| Audit logs                 | R(own)  | –              | –      | –            | R           |
| Feature flags              | –       | –              | –      | –            | CRUD        |

### 1.3 DB Schema Additions (v5)

```sql
-- Provider sub-users (receptionist / billing)
CREATE TABLE provider_staff (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES hospitals(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  sub_role    TEXT NOT NULL DEFAULT 'receptionist', -- receptionist | billing
  is_active   INTEGER DEFAULT 1,
  created_at  INTEGER
);

-- Patient documents (uploads)
CREATE TABLE patient_documents (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  filename        TEXT NOT NULL,
  storage_url     TEXT NOT NULL,  -- S3/Cloudflare R2 signed URL
  doc_type        TEXT NOT NULL,  -- prescription | lab_report | scan | discharge | other
  doc_date        TEXT,           -- ISO date patient labels the doc
  hospital_name   TEXT,           -- optional free-text
  doctor_name     TEXT,           -- optional free-text
  tags            TEXT,           -- JSON array
  file_size_kb    INTEGER,
  mime_type       TEXT,
  is_deleted      INTEGER DEFAULT 0,
  created_at      INTEGER
);

-- Document shares (patient → provider)
CREATE TABLE document_shares (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES patient_documents(id),
  shared_by       TEXT NOT NULL,  -- patientId
  shared_to_type  TEXT NOT NULL,  -- hospital | doctor
  shared_to_id    TEXT NOT NULL,  -- hospitalId or doctorId
  appointment_id  TEXT,           -- optional: scope to appointment
  permission      TEXT NOT NULL DEFAULT 'view', -- view | download
  expires_at      INTEGER,        -- timestamp_ms; null = until revoked
  revoked_at      INTEGER,
  accessed_at     INTEGER,        -- last access
  access_count    INTEGER DEFAULT 0,
  created_at      INTEGER
);

-- Document access audit (every access logged)
CREATE TABLE document_access_log (
  id            TEXT PRIMARY KEY,
  share_id      TEXT NOT NULL REFERENCES document_shares(id),
  actor_id      TEXT NOT NULL,   -- userId (provider)
  actor_type    TEXT NOT NULL,   -- hospital_admin | doctor
  action        TEXT NOT NULL,   -- view | download
  ip_hash       TEXT,
  accessed_at   INTEGER
);

-- Walk-in patient tokens (OPD queue)
CREATE TABLE opd_tokens (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL,
  doctor_id     TEXT,
  token_number  INTEGER NOT NULL,
  token_date    TEXT NOT NULL,  -- YYYY-MM-DD
  patient_name  TEXT,
  patient_phone TEXT,           -- encrypted
  status        TEXT NOT NULL DEFAULT 'waiting', -- waiting | in_consultation | done | skipped
  called_at     INTEGER,
  completed_at  INTEGER,
  created_at    INTEGER
);
```

---

## 2. PATIENT PORTAL

### 2.1 Routes

```
/                        → Home (search-first, public)
/login                   → Patient OTP login
/dashboard               → Patient dashboard (auth required)
/dashboard/appointments  → Appointment list + detail
/dashboard/records       → Health records (EMR)
/dashboard/documents     → Uploaded documents
/dashboard/share         → Share management
/dashboard/membership    → Membership plan
/book/[hospitalId]       → Appointment booking flow
/book/[doctorId]         → Doctor-specific booking
```

### 2.2 Screen: Patient Login Page `/login`

```
┌─────────────────────────────────────────────────────────────────┐
│  ● EasyHeals                                           [EN ▼]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│           Welcome back                                          │
│           Verify your phone to continue                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  🇮🇳 +91  │  98765 43210                               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  [ ] [ ] [ ] [ ] [ ] [ ]   ← 6-digit OTP               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [        Send OTP        ]  or  [  Verify OTP  ]             │
│                                                                 │
│   Resend in 0:45   |   Having trouble? Chat with us            │
│                                                                 │
│   ─────────────── or continue as ───────────────               │
│   [ 🔍 Browse hospitals without login ]                         │
│                                                                 │
│   By continuing you agree to our Privacy Policy (DPDP 2023)   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Screen: Patient Dashboard `/dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│  ● EasyHeals  [Search...]              👤 Rahul S.  [Sign Out]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Good morning, Rahul 👋                                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📅 UPCOMING APPOINTMENT                                 │  │
│  │  Dr. Anjali Mehta · Cardiology                          │  │
│  │  Tomorrow, 10:30 AM  ·  Apollo Hospital, Mumbai         │  │
│  │  Status: Confirmed                                       │  │
│  │                                                          │  │
│  │  [ 🎥 Join Online ]   [ Reschedule ]   [ Cancel ]       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 📅       │ │ 📄       │ │ 🧪       │ │ 💊       │          │
│  │Appoint-  │ │ Health   │ │   Lab    │ │Prescri-  │          │
│  │ ments    │ │ Records  │ │  Orders  │ │ ptions   │          │
│  │  3 total │ │ 2 visits │ │ 1 active │ │ 2 active │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📁 MY DOCUMENTS                               [+ Upload] │  │
│  │  Blood Test Report.pdf         14 Mar  · 🔒 Not shared   │  │
│  │  ECG Report.jpg                10 Mar  · ✅ Shared (1)   │  │
│  │  Dr. Sharma Prescription.pdf    5 Mar  · ✅ Shared (2)   │  │
│  │                                          [ See all → ]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🏆 REWARDS                                  [View all]  │  │
│  │  ████████░░  800 pts · Silver member                     │  │
│  │  200 pts to Gold                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Screen: Appointments List `/dashboard/appointments`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    My Appointments                   [+ Book New]       │
├─────────────────────────────────────────────────────────────────┤
│  [ Upcoming (2) ]  [ Past (8) ]  [ Cancelled (1) ]             │
│                                                                 │
│  ── UPCOMING ─────────────────────────────────────────────────  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🟢 Confirmed               Tomorrow · 10:30 AM          │  │
│  │  Dr. Anjali Mehta                                        │  │
│  │  Cardiology · Apollo Hospital, Mumbai                    │  │
│  │  Type: 🎥 Online Consultation                            │  │
│  │  Reason: Follow-up ECG review                            │  │
│  │                                                          │  │
│  │  [ 🎥 Join Now ]  [ 📋 View Details ]  [ ✏ Reschedule ] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🟡 Pending                   25 Mar · 2:00 PM           │  │
│  │  Dr. Rajan Patel                                         │  │
│  │  Orthopaedics · Fortis Hospital, Pune                    │  │
│  │  Type: 🏥 In-Person                                      │  │
│  │                                                          │  │
│  │  [ 📋 View Details ]  [ ❌ Cancel ]                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── PAST ──────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ✅ Completed                  10 Mar · 11:00 AM          │  │
│  │  Dr. Anjali Mehta · Cardiology · Apollo Hospital          │  │
│  │  📄 Doctor notes available   💊 Prescription attached    │  │
│  │  [ 📋 View Summary ]  [ ⬇ Download Prescription ]        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Screen: Document Upload `/dashboard/documents`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    My Documents                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Upload New Document                     │  │
│  │                                                          │  │
│  │       ☁ Drag & drop PDF / JPG / PNG here                │  │
│  │            or [ Browse Files ]                           │  │
│  │                Max size: 10 MB                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Document type:                                                 │
│  ○ Prescription  ● Lab Report  ○ Scan/X-Ray  ○ Discharge  ○ Other │
│                                                                 │
│  Document date:   [ 14/03/2026 ▼ ]                             │
│  Hospital/Doctor: [ Apollo Hospital, Mumbai       ] (optional)  │
│  Tags:            [ + Blood Test ] [ + Cardiac ]               │
│                                                                 │
│  [ Upload Document ]                                            │
│                                                                 │
│  ─────── My Documents ────────────────────────────────────── │
│  Filter: [All ▼]  [Type ▼]  [Date ▼]  🔍 Search...           │
│                                                                 │
│  ┌───┬───────────────────────┬────────┬───────────┬─────────┐  │
│  │📄 │ Blood Test Report.pdf │ 14 Mar │ Lab Report│[Share▼] │  │
│  │   │ 2.3 MB · Not shared   │ 2026   │           │[Delete] │  │
│  ├───┼───────────────────────┼────────┼───────────┼─────────┤  │
│  │📄 │ ECG Report.jpg        │ 10 Mar │ Scan      │[Share▼] │  │
│  │   │ 1.1 MB · Shared (1)  │ 2026   │           │[Revoke] │  │
│  └───┴───────────────────────┴────────┴───────────┴─────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 Screen: Share Document Flow (Modal)

```
┌──────────────────── Share Document ─────────────────────────────┐
│                                                          [✕]    │
│  Sharing: "Blood Test Report.pdf"                               │
│                                                                 │
│  Step 1 of 3 — Select Provider                                  │
│                                                                 │
│  🔍 Search hospital or doctor...                                │
│                                                                 │
│  ○ Apollo Hospital, Mumbai                ★ 4.8  ✅ Verified    │
│  ○ Dr. Anjali Mehta · Cardiology          ★ 4.9  ✅ Verified    │
│  ○ Fortis Hospital, Pune                  ★ 4.7  ✅ Verified    │
│                                                                 │
│  [ Next → ]                                                     │
│ ─────────────────────────────────────────────────────────────── │
│  Step 2 of 3 — Share Scope & Permissions                        │
│                                                                 │
│  Link to appointment?                                           │
│  ● For appointment: Dr. Anjali · 19 Mar 10:30 (recommended)    │
│  ○ General access (no specific appointment)                     │
│                                                                 │
│  Permission:  ● View only   ○ Allow download                    │
│                                                                 │
│  Expires in:  ○ 7 days  ● 30 days  ○ Until I revoke            │
│                                                                 │
│  [ ← Back ]   [ Next → ]                                        │
│ ─────────────────────────────────────────────────────────────── │
│  Step 3 of 3 — Confirm                                          │
│                                                                 │
│  You are sharing:                                               │
│  📄 Blood Test Report.pdf                                       │
│  → Dr. Anjali Mehta at Apollo Hospital                          │
│  → For appointment on 19 Mar 10:30 AM                          │
│  → View only · Expires in 30 days                              │
│  → Provider will be notified via notification                   │
│                                                                 │
│  [ ← Back ]   [ ✅ Confirm Share ]                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.7 Screen: Appointment Booking Flow `/book/[providerId]`

```
── STEP 1: Select Doctor ────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Book at Apollo Hospital, Mumbai                    Step 1/4    │
│                                                                 │
│  Select Doctor (optional)                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 👨‍⚕ Dr. Anjali Mehta · Cardiology    ₹800/consult  [Select]│  │
│  │ 👩‍⚕ Dr. Rajan Patel · Orthopaedics  ₹600/consult  [Select]│  │
│  │ 🏥 Any available doctor             First available[Select]│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

── STEP 2: Select Type ──────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Book at Apollo Hospital · Dr. Anjali Mehta         Step 2/4    │
│                                                                 │
│  Appointment type:                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🏥 In-Person Visit                   ₹800              │  │
│  │  Available Mon–Sat, 9AM–5PM                              │  │
│  │  [ Select ]                                              │  │
│  │────────────────────────────────────────────────────────── │  │
│  │  🎥 Online Consultation               ₹600              │  │
│  │  Available Mon–Fri, 8AM–8PM                              │  │
│  │  ✅ Supports: Video + Audio                              │  │
│  │  [ Select ]                                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

── STEP 3: Pick Slot ────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Dr. Anjali Mehta · Online · April 2026             Step 3/4    │
│                                                                 │
│  ◀  March 2026  ▶                                               │
│  Mo Tu We Th Fr Sa Su                                           │
│  18 19 20 21 22 23 24                                           │
│        [19] ← selected                                          │
│                                                                 │
│  Available slots — Wednesday 19 Mar                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ 9:00   │ │ 9:15   │ │[9:30] ●│ │ 9:45   │ │ 10:00  │        │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│  ┌────────┐ ┌────────┐ ┌────────┐                               │
│  │ 10:15  │ │ 10:30  │ │ FULL   │                               │
│  └────────┘ └────────┘ └────────┘                               │
│                                                                 │
│  [ Next → ]                                                     │
└─────────────────────────────────────────────────────────────────┘

── STEP 4: Confirm ──────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Confirm Appointment                               Step 4/4     │
│                                                                 │
│  Dr. Anjali Mehta · Cardiology                                  │
│  Apollo Hospital, Mumbai                                        │
│  🎥 Online · Wednesday 19 Mar · 9:30 AM                        │
│  Fee: ₹600                                                      │
│                                                                 │
│  Reason for visit (optional):                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Follow-up after ECG...                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📁 Attach documents (optional):                                │
│  ☑ ECG Report.jpg (shared for this appointment)                │
│  ☐ Blood Test Report.pdf                                        │
│                                                                 │
│  ☑ I consent to sharing my basic health info per DPDP 2023    │
│                                                                 │
│  [ Pay ₹600 & Confirm ]  or  [ Request (Pay at clinic) ]       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.8 Screen: Health Records `/dashboard/records`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    My Health Records                                    │
├─────────────────────────────────────────────────────────────────┤
│  [ Visits (3) ]  [ Prescriptions (4) ]  [ Vitals ]  [ Lab Orders ]│
│                                                                 │
│  ── RECENT VISITS ──────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  19 Mar 2026 · Dr. Anjali Mehta · Cardiology            │  │
│  │  Apollo Hospital · Online Consultation                   │  │
│  │  Diagnosis: Mild hypertension (shared)                   │  │
│  │  Notes: Monitor BP twice daily, low-sodium diet          │  │
│  │  [ View Full Summary ]  [ Download ]                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── VITALS TREND ───────────────────────────────────────────── │
│  Blood Pressure   ↑ 130/85 (19 Mar)  ↓ 122/80 (10 Mar)        │
│  Heart Rate       72 bpm (19 Mar)                               │
│  Weight           74 kg  (10 Mar)                               │
│  BMI              23.4                                          │
│  [ Log New Vitals ]                                             │
│                                                                 │
│  ── ACTIVE PRESCRIPTIONS ───────────────────────────────────── │
│  💊 Amlodipine 5mg · Once daily · 30 days                      │
│     Prescribed by Dr. Anjali · 19 Mar 2026                     │
│  💊 Losartan 25mg · Morning · 30 days                          │
│     [ View Prescription ]  [ Download PDF ]                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. PROVIDER PORTAL (Hospital / Doctor / Clinic)

### 3.1 Routes

```
/portal/login                    → Provider OTP/password login
/portal/dashboard                → Provider home (today's summary)
/portal/appointments             → Full appointment management
/portal/appointments/[id]        → Appointment detail
/portal/schedule                 → Slot & availability management
/portal/patients                 → Patient quick profiles
/portal/consultation/[sessionId] → Video consultation room (enhanced)
/portal/profile                  → Provider profile edit
/portal/staff                    → Sub-user management
/portal/subscription             → Plans & billing
/portal/queue                    → Walk-in OPD token queue
```

### 3.2 Screen: Provider Login `/portal/login`

```
┌─────────────────────────────────────────────────────────────────┐
│  ● EasyHeals Provider Portal                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│           Provider Login                                        │
│           Manage your practice on EasyHeals                     │
│                                                                 │
│  Login as:                                                      │
│  ○ Hospital / Clinic Admin   ● Doctor   ○ Receptionist          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Email or Registered Phone                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Password                                      [👁 Show] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [        Login        ]                                        │
│  Forgot password?   |   Login with OTP instead                  │
│                                                                 │
│  Not registered yet? [ Register your Practice → ]               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Screen: Provider Dashboard `/portal/dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│  ● EasyHeals Provider  Apollo Hospital       [Dr. Anjali ▼] [⚙] │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                       │
│  📅Today  │  Wednesday, 19 March 2026                            │
│  📋 Appt  │                                                       │
│  👥 Patients│ TODAY AT A GLANCE                                   │
│  📅 Schedule│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  👁 Docs  │ │ 8 Total  │ │ 3 Online │ │ 1 Pending│ │ 2 Done │ │
│  📡 Queue  │ │   Today  │ │  Consult │ │ Approval │ │  Done  │ │
│  👤 Profile│ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  💳 Plan  │                                                       │
│  👥 Staff │  TODAY'S SCHEDULE TIMELINE                           │
│           │  ──────────────────────────────────────────────── │  │
│           │  9:00  ████ Rahul S. · Online ✅        [Join]    │  │
│           │  9:15  ████ Priya K. · In-person ✅     [Start]   │  │
│           │  9:30  ░░░░ BREAK                                  │  │
│           │  9:45  ████ Anand M. · Online 🟡 Pending [Accept] │  │
│           │  10:00 ████ ─ AVAILABLE ─                          │  │
│           │  10:15 ████ Walk-in #3                   [Mark]    │  │
│           │                                                       │
│           │  PENDING ACTIONS                                      │
│           │  ⚠ 1 appointment awaiting your approval              │
│           │  ⚠ 2 unread patient document shares                  │
│           │  [ Review → ]                                         │
└──────────┴──────────────────────────────────────────────────────┘
```

### 3.4 Screen: Appointment Management `/portal/appointments`

```
┌─────────────────────────────────────────────────────────────────┐
│  Appointments            [+ Add Walk-in]  [⬇ Export]  [🔍 Search]│
├─────────────────────────────────────────────────────────────────┤
│  [ Today ] [ Upcoming ] [ Past ] [ All ]                        │
│  Filter: [ All Doctors ▼ ] [ All Types ▼ ] [ All Status ▼ ]    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🟡 PENDING APPROVAL                    19 Mar · 9:45 AM │  │
│  │  Anand Mishra  ·  +91 98765 43210                        │  │
│  │  Online Consultation  ·  Dr. Anjali Mehta                │  │
│  │  Reason: Chest pain follow-up                            │  │
│  │  📄 1 document shared (ECG Report)                       │  │
│  │                                                          │  │
│  │  [ ✅ Accept ]  [ ❌ Reject ]  [ 🔄 Reschedule ]         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🟢 CONFIRMED                           19 Mar · 9:00 AM │  │
│  │  Rahul Sharma  ·  Online                                 │  │
│  │  Dr. Anjali Mehta  ·  Cardiology                         │  │
│  │                                                          │  │
│  │  [ 🎥 Start Consult ]  [ 📋 Details ]  [ 📝 Notes ]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── Reject Appointment (modal) ─────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Reason for rejection:                                   │  │
│  │  ● Doctor unavailable on this date                       │  │
│  │  ○ Please choose another time slot                       │  │
│  │  ○ Requires in-person visit                              │  │
│  │  ○ Custom: [________________________]                    │  │
│  │  [ Send Rejection ]                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Screen: Slot & Schedule Management `/portal/schedule`

```
┌─────────────────────────────────────────────────────────────────┐
│  Schedule — Dr. Anjali Mehta              Week of 18–24 Mar     │
├─────────────────────────────────────────────────────────────────┤
│  Working Hours:  [ 09:00 ] to [ 17:00 ]   Slot: [ 15 min ▼ ]   │
│  Days:  ✅Mon ✅Tue ✅Wed ✅Thu ✅Fri  ☐Sat  ☐Sun               │
│  Capacity per slot:  [ 1 ▼ ]     [ Save Settings ]              │
│                                                                 │
│       Mon 18   Tue 19   Wed 20   Thu 21   Fri 22               │
│  9:00 [Rahul●] [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ]               │
│  9:15 [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ]               │
│  9:30 [  ◌  ] [Anand●] [BLOCK ] [  ◌  ] [  ◌  ]               │
│  9:45 [  ◌  ] [  ◌  ] [BLOCK ] [  ◌  ] [  ◌  ]               │
│ 10:00 [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ]               │
│ 10:15 [ LEAVE] [  ◌  ] [  ◌  ] [  ◌  ] [  ◌  ]               │
│                                                                 │
│  ● = Booked   ◌ = Available   BLOCK = Blocked                   │
│                                                                 │
│  Click any slot to:  [ Block ] [ Unblock ] [ Add Walk-in ]      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  + Add Block / Leave                                     │  │
│  │  From: [ 20 Mar 09:30 ]  To: [ 20 Mar 09:45 ]           │  │
│  │  Reason: [ Lunch break         ]  [ Save ]              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Screen: Online Consultation Room (Provider) `/portal/consultation/[id]`

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 LIVE  Consultation — Rahul Sharma          ⏱ 00:12:34      │
│  Dr. Anjali Mehta · Cardiology · Apollo Hospital                │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │                             │
│                                   │  PATIENT INFO               │
│   ┌───────────────────────────┐   │  Rahul Sharma · M · 34 yrs  │
│   │                           │   │  Ph: *** *** 3210           │
│   │   VIDEO FRAME (Jitsi)     │   │  City: Mumbai               │
│   │                           │   │                             │
│   │   Rahul Sharma            │   │  ─── SHARED DOCS ─────────  │
│   │                           │   │  📄 ECG Report.jpg   [View] │
│   │                           │   │  📄 Blood Test.pdf   [View] │
│   └───────────────────────────┘   │                             │
│                                   │  ─── PAST VISITS ─────────  │
│  [🎙 Mute] [📷 Cam] [💬 Chat]    │  10 Mar · Dr. Anjali        │
│  [🖥 Share] [⏺ Record] [📞 End]  │  Mild hypertension noted    │
│                                   │  [ View Notes ]             │
│                                   │                             │
│                                   │  ─── CONSULTATION NOTES ──  │
│                                   │  ┌─────────────────────┐   │
│                                   │  │ Patient reports BP  │   │
│                                   │  │ 138/88...           │   │
│                                   │  └─────────────────────┘   │
│                                   │                             │
│                                   │  ─── ADD PRESCRIPTION ────  │
│                                   │  Medicine: [Amlodipine  ]  │
│                                   │  Dose: [5mg] Freq: [OD  ]  │
│                                   │  Days: [30]  [+ Add More]  │
│                                   │                             │
│                                   │  Instructions:              │
│                                   │  [Take after breakfast...]  │
│                                   │                             │
│                                   │  [ ✅ End & Save Notes ]    │
└───────────────────────────────────┴─────────────────────────────┘
```

### 3.7 Screen: Patient Shared Document Viewer (Provider Modal)

```
┌──────── Patient Document — Shared Access ────────────────────────┐
│  📄 ECG Report.jpg                                      [✕]     │
│  Shared by: Rahul Sharma  |  For: Appointment 19 Mar 9:00 AM    │
│  Shared: 15 Mar 2026  |  Expires: 14 Apr 2026  |  View only    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │           [ Document Preview / Image ]                   │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ⚠ Download not permitted by patient.                           │
│  This access is logged per EasyHeals Privacy Policy (DPDP 2023) │
│                                                                  │
│  [ Close ]                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 3.8 Screen: OPD Walk-in Queue `/portal/queue`

```
┌─────────────────────────────────────────────────────────────────┐
│  OPD Queue — Dr. Anjali Mehta        Wednesday 19 Mar 2026      │
├─────────────────────────────────────────────────────────────────┤
│  [ + Add Walk-in ]   [ 🔄 Refresh ]                             │
│                                                                 │
│  NOW SERVING:  Token #3 — Geeta Nair                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔴 IN CONSULTATION — Token #3                           │  │
│  │  Geeta Nair  ·  Called at 9:42 AM                        │  │
│  │  [ ✅ Mark Done ]  [ ⏭ Skip ]                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  WAITING QUEUE                                                   │
│  ┌────┬────────────────────────────┬──────────┬──────────────┐  │
│  │ #4 │ Ramesh Kumar               │ 9:30 AM  │ [Call Next]  │  │
│  │ #5 │ Lakshmi V.                 │ 9:45 AM  │ [Call Next]  │  │
│  │ #6 │ —                          │ Waiting  │ [Skip]       │  │
│  └────┴────────────────────────────┴──────────┴──────────────┘  │
│                                                                 │
│  COMPLETED TODAY: 2 patients                                     │
│                                                                 │
│  + Add Walk-in:                                                  │
│  Name: [___________]  Phone: [+91 __________]  [Add Token]      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.9 Screen: Staff Management `/portal/staff`

```
┌─────────────────────────────────────────────────────────────────┐
│  Staff & Sub-users             [+ Add Staff Member]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───┬─────────────────┬────────────────┬──────────┬─────────┐  │
│  │ # │ Name            │ Role           │ Status   │ Actions │  │
│  ├───┼─────────────────┼────────────────┼──────────┼─────────┤  │
│  │ 1 │ Dr. Anjali Mehta│ Doctor         │ 🟢 Active│ [Edit]  │  │
│  │ 2 │ Rekha Singh     │ Receptionist   │ 🟢 Active│ [Edit]  │  │
│  │   │                 │ (Appts+Queue)  │          │[Disable]│  │
│  │ 3 │ Sunil Gupta     │ Billing Staff  │ 🔴 Inactive [Enable]│  │
│  └───┴─────────────────┴────────────────┴──────────┴─────────┘  │
│                                                                 │
│  ── Add Staff Member ──────────────────────────────────────── │
│  Name: [_______________]  Phone/Email: [__________________]    │
│  Role: [ Receptionist ▼ ]   ← Doctor / Receptionist / Billing  │
│  Doctor (if applicable): [ Dr. Anjali Mehta ▼ ]               │
│  [ Send Invite & Set Password ]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.10 Screen: Subscription Management `/portal/subscription`

```
┌─────────────────────────────────────────────────────────────────┐
│  Subscription & Billing                                         │
├─────────────────────────────────────────────────────────────────┤
│  Current Plan: PLUS  |  Renews: 18 Apr 2026  |  ₹999/month    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PLUS Plan includes:                                     │  │
│  │  ✅ Online Consultation (Video + Audio)                  │  │
│  │  ✅ Up to 3 Doctors                                      │  │
│  │  ✅ 100 appointments/month                               │  │
│  │  ✅ Featured Listing in search                           │  │
│  │  ✅ WhatsApp appointment notifications                   │  │
│  │  ❌ Unlimited appointments  → Upgrade to PREMIUM         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── Available Plans ───────────────────────────────────────── │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  FREE    │  │  PLUS ✅  │  │ PREMIUM  │                      │
│  │ ₹0/mo   │  │ ₹999/mo  │  │₹2499/mo  │                      │
│  │ 1 doctor │  │ 3 doctors│  │Unlimited │                      │
│  │ 20 appts │  │100 appts │  │Unlimited │                      │
│  │ No online│  │  Online  │  │  Online  │                      │
│  │          │  │          │  │ Priority │                      │
│  │[Current] │  │[Current] │  │[Upgrade] │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                 │
│  ── Invoices ─────────────────────────────────────────────── │
│  Mar 2026  ₹999  ✅ Paid   [Download Invoice]                  │
│  Feb 2026  ₹999  ✅ Paid   [Download Invoice]                  │
│                                                                 │
│  [ ❌ Cancel Auto-Renewal ]                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. EASYHEALS ADMIN — EXPANDED

### 4.1 New Admin Tabs (extends existing dashboard)

```
type Tab = "ingestion" | "hospitals" | "taxonomy" | "ai_research"
         | "brochure" | "contributions" | "access"
         | "patients"      ← NEW: patient account management
         | "providers"     ← NEW: provider verification & governance
         | "appointments"  ← NEW: platform-wide appointment oversight
         | "documents"     ← NEW: privacy/document audit
         | "subscriptions" ← NEW: billing admin
         | "broadcast"     (existing)
```

### 4.2 Screen: Admin — Patient Management Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  PATIENTS                                    🔍 Search patient  │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [City ▼] [Status ▼]  Total: 12,450            │
│                                                                 │
│  ┌────┬────────────────┬──────────┬────────────┬─────────────┐  │
│  │ ID │ Phone (masked) │ City     │ Registered │ Actions     │  │
│  ├────┼────────────────┼──────────┼────────────┼─────────────┤  │
│  │ P1 │ +91 *** 3210   │ Mumbai   │ 10 Mar '26 │ [View][Dis] │  │
│  │ P2 │ +91 *** 9988   │ Pune     │ 11 Mar '26 │ [View][Dis] │  │
│  └────┴────────────────┴──────────┴────────────┴─────────────┘  │
│                                                                 │
│  Patient Detail (drawer):                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Patient #P1 · Mumbai · Registered 10 Mar 2026           │  │
│  │  Appointments: 3  |  Documents: 2  |  EMR visits: 1      │  │
│  │  Shares active: 2  |  Consent purposes: booking, emr     │  │
│  │  [ Disable Account ]  [ Export Data (DPDP) ]             │  │
│  │  [ View Audit Log ]   [ Restore ]                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Screen: Admin — Provider Verification Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  PROVIDERS                              [+ Manual Add Provider] │
├─────────────────────────────────────────────────────────────────┤
│  [ Pending Verification (3) ]  [ Active (342) ]  [ Suspended ]  │
│                                                                 │
│  ── PENDING VERIFICATION ────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MedCare Clinic · Bengaluru                              │  │
│  │  Applied: 17 Mar 2026 · Type: Clinic                     │  │
│  │  Docs submitted: ✅ License  ✅ Registration  ❌ GSTIN   │  │
│  │  [ ✅ Approve ]  [ ❌ Reject ]  [ Request More Docs ]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── PROVIDER ACTIONS ────────────────────────────────────────── │
│  [ Merge Duplicates ]  [ Flag Suspicious ]  [ Suspend ]         │
│  [ Override Subscription ]  [ Activate Online Consult ]         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Screen: Admin — Document Audit Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  DOCUMENT ACCESS AUDIT                        🔍 Search         │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [Date range] [Provider] [Patient] [Action: View/DL]    │
│                                                                 │
│  ┌──────────┬─────────────────┬──────────────┬────────┬──────┐  │
│  │ Time     │ Document        │ Accessed By  │ Action │ Flag │  │
│  ├──────────┼─────────────────┼──────────────┼────────┼──────┤  │
│  │19 Mar    │ ECG Report.jpg  │ Dr. Anjali M.│ View   │  –   │  │
│  │ 09:02    │ Patient: P1     │ Apollo Hosp  │        │      │  │
│  ├──────────┼─────────────────┼──────────────┼────────┼──────┤  │
│  │18 Mar    │ Blood Test.pdf  │ Dr. R. Patel │ View   │ ⚠   │  │
│  │ 14:30    │ Patient: P2     │ Fortis Pune  │        │[Flag]│  │
│  └──────────┴─────────────────┴──────────────┴────────┴──────┘  │
│                                                                 │
│  Policy Controls:                                               │
│  Default share expiry:  [ 30 days ▼ ]                          │
│  Allow provider download: [ Admin policy ▼ ]  [ Save ]         │
│  Data retention:  [ 2 years ▼ ]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Screen: Admin — Appointment Oversight

```
┌─────────────────────────────────────────────────────────────────┐
│  PLATFORM APPOINTMENTS                         [⬇ Export CSV]  │
├─────────────────────────────────────────────────────────────────┤
│  SLA Monitor: ⚠ 3 appointments pending >24h without response   │
│                                                                 │
│  Filter: [Status ▼] [Type ▼] [Provider ▼] [Date ▼]            │
│                                                                 │
│  ┌──────────┬───────────────┬──────────┬────────────┬────────┐  │
│  │ Date     │ Patient       │ Provider │ Status     │ Act    │  │
│  ├──────────┼───────────────┼──────────┼────────────┼────────┤  │
│  │17 Mar    │ P1            │ Apollo   │ ⚠ Pending  │[Force] │  │
│  │          │               │          │ 28h no resp│ Cnfrm  │  │
│  ├──────────┼───────────────┼──────────┼────────────┼────────┤  │
│  │19 Mar    │ P2            │ Fortis   │ Confirmed  │[View]  │  │
│  └──────────┴───────────────┴──────────┴────────────┴────────┘  │
│                                                                 │
│  [ Override Status ]  [ Flag Fraud ]  [ Send SLA Warning ]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. PROVIDER REGISTRATION & ONBOARDING

### 5.1 Screen: Provider Registration Flow

```
── Step 1: Basic Info ───────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Register Your Practice on EasyHeals          Step 1/4          │
│                                                                 │
│  Practice type:                                                 │
│  [🏥 Hospital] [🏢 Clinic] [👨‍⚕ Individual Doctor]           │
│                                                                 │
│  Name:    [ Apollo Multi-Specialty Hospital    ]               │
│  Phone:   [ +91 98765 00000                   ]                │
│  Email:   [ admin@apollo.com                  ]                │
│  City:    [ Mumbai                    ▼ ]                       │
│  Address: [ Plot 5, Andheri East...           ]                │
│                                                                 │
│  [ Next → ]                                                     │
└─────────────────────────────────────────────────────────────────┘

── Step 2: Clinical Info ────────────────────────────────────────
│  Specialties: [ Cardiology ✕ ] [ Orthopaedics ✕ ] [ + Add ]   │
│  Services:    [ ICU ✕ ] [ Emergency ✕ ] [ Lab ✕ ] [ + Add ]   │
│  Consultation fee: ₹ [ 800       ]  (optional)                 │
│  Beds (hospital):  [ 150         ]  (optional)                 │

── Step 3: Verification Docs ────────────────────────────────────
│  Medical License: [ Upload PDF ]                                │
│  Registration No: [ ______________  ]                           │
│  GSTIN (optional): [ ______________ ]                           │
│  Note: Basic listing is live immediately.                       │
│  Full verification unlocks Online Consultation + Featured.      │

── Step 4: Set Up Doctors ───────────────────────────────────────
│  Add your first doctor:                                         │
│  Dr. Name: [ Anjali Mehta    ]  Specialty: [ Cardiology ▼ ]   │
│  Phone/Email: [ anjali@apollo.com        ]                     │
│  Fee: ₹ [ 800 ]   [ + Add Another Doctor ]                    │
│  [ Complete Setup → ]                                           │
```

---

## 6. NEW APIs REQUIRED (v5)

### 6.1 Document Management APIs

```
POST   /api/v1/patient/documents               → upload document (S3 presigned URL flow)
GET    /api/v1/patient/documents               → list own documents
DELETE /api/v1/patient/documents/[id]          → delete own document (if not shared)

POST   /api/v1/patient/documents/[id]/share    → create document share
GET    /api/v1/patient/documents/shares        → list active shares
DELETE /api/v1/patient/documents/shares/[id]  → revoke share

GET    /api/v1/provider/documents/shared       → provider: list shared docs (for current appointment)
GET    /api/v1/provider/documents/[shareId]    → provider: view/stream document (logs access)
```

### 6.2 Schedule & Slot APIs

```
GET    /api/v1/provider/schedule               → get working hours config
PUT    /api/v1/provider/schedule               → update working hours + slot duration
GET    /api/v1/provider/slots?date=&doctorId=  → get slots for date
POST   /api/v1/provider/slots/block            → block time range
DELETE /api/v1/provider/slots/block/[id]       → unblock

GET    /api/v1/public/slots/[hospitalId]?date= → public: available slots for booking
```

### 6.3 Appointment Management APIs (Provider side)

```
GET    /api/v1/provider/appointments           → list (with filters)
PATCH  /api/v1/provider/appointments/[id]/accept     → accept
PATCH  /api/v1/provider/appointments/[id]/reject     → reject (with reason)
PATCH  /api/v1/provider/appointments/[id]/reschedule → propose new slot
PATCH  /api/v1/provider/appointments/[id]/complete   → mark done + add notes
POST   /api/v1/provider/appointments/walkin          → add walk-in patient
```

### 6.4 OPD Queue APIs

```
GET    /api/v1/provider/queue?date=&doctorId=  → today's queue
POST   /api/v1/provider/queue                  → add walk-in token
PATCH  /api/v1/provider/queue/[id]/call        → mark as called
PATCH  /api/v1/provider/queue/[id]/done        → mark completed
PATCH  /api/v1/provider/queue/[id]/skip        → skip token
```

### 6.5 Provider Staff APIs

```
GET    /api/v1/provider/staff                  → list staff
POST   /api/v1/provider/staff                  → invite staff (sends OTP/email)
PATCH  /api/v1/provider/staff/[id]             → update role / disable
DELETE /api/v1/provider/staff/[id]             → remove
```

### 6.6 Provider Registration API

```
POST   /api/v1/provider/register               → register new provider (starts onboarding)
POST   /api/v1/provider/register/verify-otp    → verify phone OTP during signup
POST   /api/v1/provider/register/docs          → upload verification docs
GET    /api/v1/provider/register/status        → check approval status
```

### 6.7 Admin Override APIs

```
GET    /api/admin/patients                     → list patients
PATCH  /api/admin/patients/[id]/disable        → disable patient account
GET    /api/admin/providers/pending            → list pending verifications
PATCH  /api/admin/providers/[id]/verify        → approve provider
PATCH  /api/admin/providers/[id]/suspend       → suspend provider
GET    /api/admin/appointments                 → platform-wide appointment view
PATCH  /api/admin/appointments/[id]/override   → force status change
GET    /api/admin/document-audit               → full document access audit log
PATCH  /api/admin/subscriptions/[id]           → manual subscription override
```

---

## 7. FEATURE FLAG ADDITIONS (v5)

```typescript
export const V5_FLAGS = [
  "patient_document_upload",    // S3 upload flow
  "provider_registration",      // self-serve provider onboarding
  "provider_schedule_mgmt",     // slot + calendar management
  "opd_queue",                  // walk-in token queue
  "provider_staff_mgmt",        // sub-user (receptionist) support
  "document_sharing",           // patient → provider share
  "document_access_audit",      // full access audit logs
];
```

---

## 8. UI TECH SPEC

### 8.1 Design System

```
Colors (existing EasyHeals brand):
  Primary:    #1B8A4A (green)
  Surface:    #FFFFFF / #F8FAFB (light mode)
  Text:       #0D1117 (primary) / #6B7280 (muted)
  Danger:     #DC2626
  Warning:    #D97706
  Success:    #16A34A
  Border:     #E5E7EB

Typography:
  Headings:  Bricolage Grotesque (existing)
  Body:      DM Sans (existing)

Patient Portal: Light theme (white backgrounds, green CTAs)
Provider Portal: Light theme with sidebar nav (professional)
Admin: Dark sidebar, white content area (existing)
Consultation Room: Dark theme #0a0f14 (existing)
```

### 8.2 New Pages Implementation Priority

```
Priority 1 (Test P1/P2/P3 immediately):
  /dashboard                    → Patient hub
  /dashboard/appointments       → Appointment list + join links
  /dashboard/records            → EMR viewer
  /portal/dashboard             → Provider home + today's schedule
  /portal/appointments          → Accept/reject/start consult

Priority 2 (Complete provider workflow):
  /portal/schedule              → Slot management calendar
  /portal/queue                 → OPD walk-in tokens
  /portal/staff                 → Sub-user management
  /book/[providerId]            → Full booking flow (replace modal)

Priority 3 (Documents & compliance):
  /dashboard/documents          → Upload + manage
  /dashboard/share              → Share management
  /portal/subscription          → Plan + billing
  Provider registration flow

Priority 4 (Admin expansions):
  New admin tabs: patients, providers, appointments, documents, subscriptions
```

---

## 9. BUILD SEQUENCE (Post-P3)

```
Phase 4a — Patient Dashboard + Provider Dashboard UI
  Day 1: /dashboard (hub + appointments) + /portal/dashboard (today view)
  Day 2: /dashboard/records (EMR) + /portal/appointments (accept/reject)
  Day 3: /portal/schedule (slots + calendar)

Phase 4b — Booking Flow + Documents
  Day 4: Full /book/[providerId] multi-step booking (replaces modal)
  Day 5: /dashboard/documents (upload) + share flow
  Day 6: /portal/queue (OPD tokens) + /portal/staff

Phase 4c — Subscription + Admin Expansions
  Day 7: /portal/subscription (plans + billing)
  Day 8: Admin: patients + providers tabs
  Day 9: Admin: document audit + appointment oversight tabs

Phase 5 — Provider Registration + Advanced
  Provider self-registration flow
  S3/R2 document storage integration
  Provider profile change approval workflow
```

---

## 10. CROSS-CUTTING CONCERNS

### 10.1 Notifications (all roles)

| Event                          | Patient | Provider | Admin |
|--------------------------------|---------|----------|-------|
| Appointment requested          | ✅ WA   | ✅ WA+SMS | –    |
| Appointment confirmed          | ✅ WA   | –        | –     |
| Appointment rejected           | ✅ WA   | –        | –     |
| 1h before appointment          | ✅ WA   | ✅ SMS   | –     |
| Document shared to provider    | –       | ✅ SMS   | –     |
| Share expiring in 3 days       | ✅ WA   | –        | –     |
| Subscription renewing in 7 days| –       | ✅ WA    | –     |
| New provider verification req  | –       | –        | ✅ Email |
| SLA breach (pending >24h)      | –       | ✅ SMS   | ✅ Alert |

### 10.2 DPDP 2023 Compliance Additions

- Document shares create a `consent_records` entry (purpose: `document_sharing`)
- Patient can revoke any share at any time → `document_shares.revoked_at`
- Every document access logged in `document_access_log`
- Patient data export: `/api/v1/patient/export` (DPDP Article 11 — right to data)
- Admin can trigger account deletion on patient request (right to erasure)
- Retention policy configurable per document type

---

*End of HLD v5 — Role-Based Platform Specification*
*Next: Implement Phase 4a — Patient Dashboard + Provider Dashboard UI*
