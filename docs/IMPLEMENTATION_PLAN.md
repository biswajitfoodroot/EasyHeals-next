# EasyHeals Next (Greenfield) Implementation Plan

## Program Principles
- Fully independent from `crm.easyheals.com` codebase and database.
- Mobile-first UX and SEO-first IA from the first sprint.
- Scalable and maintainable architecture with explicit module boundaries.
- Compliance-aware design with strict auditability for sensitive workflows.

## Architecture Baseline
- Frontend: Next.js App Router (TypeScript), server components by default, client components only where interaction is required.
- Backend: Next.js route handlers for core APIs, background workers split into dedicated service when queue volume grows.
- Database: Turso (SQLite), Drizzle ORM, migration-led schema evolution.
- Async/events: Outbox table + worker pattern to avoid lost events and support retries.
- Storage: object storage abstraction (S3-compatible), signed URLs, encrypted objects.
- Caching: edge cache for read-heavy pages, application cache for expensive query aggregations.

## Database Design Strategy
Use normalized domain tables with additive migrations and explicit history tables.

### Core domains (v1)
- Identity and access: `users`, `roles`, `user_role_map`, `sessions`.
- Provider network: `hospitals`, `doctors`, `hospital_doctor_map`, `departments`.
- Discovery taxonomy: `specialties`, `treatments`, `symptoms`, `taxonomy_nodes`, `taxonomy_edges`, `aliases`.
- Leads and pipeline: `leads`, `lead_events`, `lead_scores`, `lead_assignments`, `lead_status_history`.
- Appointments: `appointment_slots`, `appointments`, `appointment_documents`.
- Package and feature gating: `packages`, `package_features`, `hospital_subscriptions`, `feature_overrides`.
- Governance: `audit_logs`, `consents`, `data_access_logs`.

### Design rules
- UUID primary keys for all entities.
- `created_at`, `updated_at`, soft delete fields on mutable entities.
- JSON fields only for truly flexible metadata, not core relational structure.
- Covering indexes for hot filters: city, specialty, status, created_at, assigned_to.
- Reference data separated from transactional data.

## Five-Phase Plan

## Phase 1: Foundation and Guardrails
### Outcome
- Production-safe skeleton with isolated infra, auth, RBAC, audit logging, feature flags, and Turso migrations.
### Workstreams
- Project scaffold hardening, environment config policy, lint/test pipelines.
- Initial schema and migration policy with Drizzle.
- Security middleware baseline and centralized error handling.
### Exit criteria
- CI green on lint/typecheck/unit tests.
- Auth and role checks enforced across protected routes.
- Audit log coverage for all write endpoints.

## Phase 2: Discovery, Mobile UX, and SEO
### Outcome
- Indexable and fast discovery experience for hospitals, doctors, treatments, and cities.
### Workstreams
- SEO route map, metadata generator, sitemap, robots, canonical strategy.
- Mobile-first pages with responsive search and filters.
- Taxonomy ingestion and query composition for discovery pages.
### Exit criteria
- Core discovery pages pass Lighthouse mobile thresholds.
- Structured data present for profile and listing pages.
- URL structure stable and crawl-friendly.

## Phase 3: Onboarding, Leads, and Appointment Flows
### Outcome
- End-to-end journey from provider onboarding to appointment creation and CRM-compatible lead lifecycle.
### Workstreams
- Hospital onboarding workflow and profile management.
- Lead capture API + scoring + status transitions.
- Appointment sloting, booking, and notification triggers.
### Exit criteria
- Lead lifecycle runs fully in-app with complete status history.
- Booking flow works on mobile and desktop with validation.
- Event outbox contains reliable records for downstream integrations.

## Phase 4: Billing, Clinical Workflows, and Moderation
### Outcome
- Revenue and clinical workflows operational with policy controls.
### Workstreams
- Payment order, transaction, refund, settlement modules.
- Prescription and lab order workflow foundation.
- Crowd contribution moderation queue with outlier scoring hooks.
### Exit criteria
- Financial records reconcile through test scenarios.
- Clinical documents have access logs and role constraints.
- Moderation queue supports deterministic decisions and traceability.

## Phase 5: Scale, Reliability, and Commercial Readiness
### Outcome
- Platform hardened for growth with observability and governance.
### Workstreams
- Performance optimization and load profile tuning.
- Queue retry/backoff and dead-letter handling.
- De-identified analytics marts and governance checks.
### Exit criteria
- SLO dashboard and alerting coverage for critical paths.
- Backup/restore drill documented and tested.
- Release process supports staged rollout by market/city.

## UX Standards (All Phases)
- Mobile-first breakpoints and touch-friendly controls.
- Keyboard accessibility and screen-reader friendly semantics.
- Predictable navigation with low cognitive load.
- Form UX: inline validation, autosave where relevant, resilient error recovery.

## SEO Standards (All Phases)
- Semantic HTML and metadata completeness.
- Structured data for healthcare entities where applicable.
- Internal linking via taxonomy breadcrumbs and related content.
- Page speed budgets for LCP/INP/CLS monitored in CI where possible.

## Scalability and Maintainability Standards (All Phases)
- Clear module boundaries and dependency direction (domain -> services -> adapters).
- Contract-first API documentation with versioning.
- Idempotent write APIs for externally triggered flows.
- Migration safety checks and rollback strategy for every schema change.
- Test strategy: unit + integration + contract + core E2E user journeys.

## Immediate Sprint (Next 5 working days)
- Finalize schema v1 and commit migration files.
- Implement auth, RBAC, audit middleware.
- Build foundation UI shell (mobile nav + desktop layout).
- Build SEO skeleton: sitemap, metadata helper, canonical URL utility.
- Create lead domain APIs with validation and tests.
