# EasyHeals Agile Stories (RC#1, RC#3, RC#4, RC#6)

Scope source: `EasyHeals_HLD_v2.1_Revised.docx`
Focused sections:
- RC#1 Intelligent Multilingual Search Engine
- RC#3 Crowd-Sourced Listings with AI Outlier Detection
- RC#4 Pan-India Private Hospital Coverage
- RC#6 Hospital Self-Registration (Free)

## Delivery Structure (Before Further Admin Expansion)

## Sub-Phase A: Search Foundation (RC#1)
### EH-RC1-001: Multilingual Query Pipeline
- Story: As a user, I can search in multiple Indian languages and get relevant results.
- Acceptance:
  - Supports English + phase-1 Indian language inputs.
  - Query normalization layer handles transliteration and typo tolerance.
  - Search API returns language code and normalized query in response metadata.
- Verification:
  - API tests for language input variants.
  - Manual QA set of predefined multilingual queries.

### EH-RC1-002: Search Modes and Ranking v1
- Story: As a user, I can search by treatment, doctor, hospital, symptom.
- Acceptance:
  - Unified endpoint supports mode filtering (`treatment|doctor|hospital|symptom`).
  - Ranking weights combine relevance + city match + active profile status.
  - Empty/low-confidence query returns suggestions instead of hard fail.
- Verification:
  - Ranking snapshot tests with deterministic fixtures.

### EH-RC1-003: Search Cache and Cost Controls
- Story: As a platform owner, repeated identical queries are cached to reduce AI cost/latency.
- Acceptance:
  - Cache key includes language + query + mode + city.
  - TTL is configurable (default 6 hours).
  - Cache hit/miss is logged to telemetry.
- Verification:
  - Integration test confirms second request is served from cache.

## Sub-Phase B: Crowd Listings + AI Moderation (RC#3)
### EH-RC3-001: Public Contribution API
- Story: As a contributor, I can submit listing add/update suggestions.
- Acceptance:
  - Contribution types: create hospital, update hospital fields, doctor association update.
  - Required fields validated and versioned.
  - Every submission stored with contributor metadata and timestamp.
- Verification:
  - API validation tests and persistence tests.

### EH-RC3-002: Outlier Scoring and Moderation Queue
- Story: As an admin/moderator, I can review high-risk changes first.
- Acceptance:
  - Outlier score generated per contribution (rule-based v1, AI hook-ready).
  - Queue sorted by severity (`critical`, `high`, `medium`, `low`).
  - Decisions: `accept`, `reject`, `request_info` with reason.
- Verification:
  - Queue ordering tests.
  - Audit trail checks for each decision.

### EH-RC3-003: Trust Score and Auto-Approval Rules
- Story: As system, trusted contributors with low-risk edits can bypass manual queue.
- Acceptance:
  - Contributor trust score model persisted and updated by decision outcomes.
  - Auto-approve for low-risk edits when trust score threshold is met.
  - Full decision history visible for rollback.
- Verification:
  - Tests for threshold behavior and fallback to manual review.

## Sub-Phase C: Pan-India Private Hospital Coverage (RC#4)
### EH-RC4-001: India Geography Master Data
- Story: As an operations user, I can seed and manage India city/state master data.
- Acceptance:
  - Master tables for state, city, locality.
  - Fast lookup by city name and state.
  - Unique constraints to reduce duplicates.
- Verification:
  - Data integrity tests and import idempotency test.

### EH-RC4-002: Private Hospital Coverage Seeding Engine
- Story: As operations, I can seed private hospital listings city-wise in batches.
- Acceptance:
  - Supports batch sizes (50/100/500).
  - Marks source and confidence for each seeded record.
  - Enforces rule: government hospitals excluded.
- Verification:
  - Seed job tests for duplicate handling and exclusion filters.

### EH-RC4-003: Coverage Dashboard Metrics
- Story: As leadership, I can track city-wise coverage progress.
- Acceptance:
  - Metrics: total hospitals, active hospitals, low-confidence pending review.
  - Filter by state/city.
  - Trend snapshot by day/week.
- Verification:
  - Dashboard query tests against seeded fixtures.

## Sub-Phase D: Free Hospital Self-Registration (RC#6)
### EH-RC6-001: Self-Registration Onboarding Flow
- Story: As a hospital, I can register and create a free profile.
- Acceptance:
  - Registration form with contact verification placeholders.
  - Profile fields: hospital identity, address, specialties, contact, hours, photos.
  - Registration status lifecycle (`submitted`, `verified`, `active`, `suspended`).
- Verification:
  - E2E form flow test (mobile + desktop).

### EH-RC6-002: Free Tier Entitlements Engine
- Story: As a hospital on free tier, I receive defined free features automatically.
- Acceptance:
  - Free package is assigned on activation.
  - Entitlements enforced by feature flags (doctor count cap, lead cap, SMS cap placeholders).
  - Upgrade prompt surfaces when limits are exceeded.
- Verification:
  - API tests for cap enforcement and package assignment.

### EH-RC6-003: Community Verification Badge Flow
- Story: As a hospital, I can receive a community-verified badge after trusted confirmations.
- Acceptance:
  - Badge rule engine configurable (default: 3 valid confirmations).
  - Badge status visible in profile and API response.
  - Badge can be revoked on quality signals.
- Verification:
  - Rule engine tests for grant/revoke transitions.

## Sprint-Ready Priority (Implement Next)
1. EH-RC1-001 Multilingual Query Pipeline
2. EH-RC1-002 Search Modes and Ranking v1
3. EH-RC3-001 Public Contribution API
4. EH-RC3-002 Outlier Scoring and Moderation Queue
5. EH-RC6-001 Self-Registration Onboarding Flow
6. EH-RC4-001 India Geography Master Data

## Definition of Done (All Stories)
- Unit + integration tests pass.
- Audit logs emitted for all write operations.
- Mobile responsiveness validated for all new screens.
- OpenAPI docs updated for new endpoints.
- Migration scripts are additive and reversible.
