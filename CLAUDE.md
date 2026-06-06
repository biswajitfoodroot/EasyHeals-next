# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on port 5000
npm run build        # Production build
npm run start        # Production server on port 5000
npm run lint         # ESLint 9
npm run typecheck    # TypeScript strict check (no emit)
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run test:coverage

npm run db:generate  # Generate migration SQL from schema changes
npm run db:migrate   # Apply migrations to Turso
npm run db:push      # Push schema directly (dev/non-prod only)
npm run db:studio    # Open Drizzle Studio GUI
npm run db:seed      # Seed roles, admin user, hospitals, taxonomy
```

Run a single test file: `npx vitest run src/tests/path/to/file.test.ts`

## Architecture

### Stack
- **Next.js 16 App Router** + React 19 + TypeScript 5 (strict)
- **Turso (libSQL/SQLite via HTTP)** as the primary database, accessed through Drizzle ORM
- **Drizzle ORM** — schema lives in [src/db/schema.ts](src/db/schema.ts) (115KB+); a separate [src/db/emr-schema.ts](src/db/emr-schema.ts) targets Neon Postgres for the EMR feature (P3)
- **Gemini 2.5 Flash** (`@google/generative-ai`) for AI search and the health coach
- **Tailwind CSS 4** + custom CSS modules
- **Upstash Redis** for caching; **Vercel Blob** for document storage

### Authentication & Sessions
- Session-based auth — raw token stored in an httpOnly cookie; only its SHA-256 hash is persisted in the DB
- Session TTL: 7 days; optional sliding window via feature flag
- [src/lib/auth.ts](src/lib/auth.ts) — `requireAuth()` / `requireAuthNoTOTP()` extract and validate the session; all protected API routes call one of these
- [src/lib/session.ts](src/lib/session.ts) — session creation/deletion, cookie management
- [src/lib/rbac.ts](src/lib/rbac.ts) — `ensureRole(ctx, [...roleCodes])` returns 403 if the caller's role isn't in the list
- TOTP (P2): owner/admin roles; `session.totpVerifiedAt` marks completion; some routes require `requireAuth()` (TOTP already done) vs `requireAuthNoTOTP()` (TOTP not yet required)
- Role codes: `owner`, `admin`, `admin_manager`, `admin_editor`, `advisor`, `viewer`, `hospital_admin`, `doctor`, `contributor`, `receptionist`, `operator`, `coordinator`
- Error codes returned as JSON: `AUTH_REQUIRED`, `AUTH_TOTP_REQUIRED`, `RBAC_FORBIDDEN`

### API Routes (src/app/api/)
All API routes use `NextRequest`/`NextResponse`. POST bodies are validated with Zod. Pattern:
1. Call `requireAuth()` or `requireAuthNoTOTP()` → get session ctx
2. Call `ensureRole()` if the route is role-restricted
3. Validate body with Zod
4. Query DB via Drizzle
5. Log to audit trail via [src/lib/audit.ts](src/lib/audit.ts)

Key namespaces: `/api/auth/*`, `/api/admin/*`, `/api/hospitals/*`, `/api/search/*`, `/api/book/*`, `/api/portal/*`, `/api/cron/*`, `/api/internal/*` (protected by `X-API-Key: INTERNAL_API_KEY` header)

### Data Fetching
- **Server components**: query Drizzle directly (no fetch overhead)
- **Client components**: `fetch(..., { credentials: "include", cache: "no-store" })`
- [src/hooks/useSessionHealth.ts](src/hooks/useSessionHealth.ts) — polls `/api/v1/auth/session-status` every 4 minutes via `BroadcastChannel` (one tab polls, others listen)

### AI Search
- [src/lib/gemini.ts](src/lib/gemini.ts) — intent parser; classifies query into `searchType` (symptom / doctor / hospital / treatment / lab_test), extracts specialty, location, language
- [src/lib/ai/client.ts](src/lib/ai/client.ts) — Gemini singleton with 8 s timeout and token-usage tracking
- [src/lib/search/](src/lib/search/) — provider factory; default is FTS5 (SQLite full-text); Typesense is a P3 alternative

### Internationalisation
- 10 locales: `en` (default), `hi`, `mr`, `ta`, `bn`, `ml`, `kn`, `te`, `ar`, `si`
- Cookie-based (`easyheals_locale`); client-side context in [src/i18n/LocaleContext.tsx](src/i18n/LocaleContext.tsx)
- `useTranslations()` hook from that context; translations compiled into [src/i18n/translations.ts](src/i18n/translations.ts) (292 KB)
- URL-prefix routing (next-intl) is planned for P6

### PHI & Security
- Phone numbers: AES-256-GCM encrypted (`ENCRYPTION_KEY`) + HMAC-SHA-256 hashed (`PHONE_SALT`) for lookup — **PHONE_SALT must never change** after the first patient row
- Health coach conversations / health events: separate `HEALTH_PHI_ENCRYPTION_KEY`
- [src/lib/security/phi-redactor.ts](src/lib/security/phi-redactor.ts) — masks PHI before logging
- Audit logging in [src/lib/audit.ts](src/lib/audit.ts) captures actor, action, entityType, entityId, IP

### Feature Flags
Flags live in [src/lib/config/feature-flags.ts](src/lib/config/feature-flags.ts) and are toggled via env vars and the admin API (`/api/admin/config/flags`). The `<FeatureGate flag="...">` component gates UI rendering. Active flags include: `appointment_booking`, `ai_health_coach`, `health_memory`, `wearable_sync`, `smart_reminders`, `referral_engine`, `gamification_ui`, `session_sliding`.

### Testing
- Vitest 3 with Node environment; tests in `src/tests/**/*.test.ts`; 30 s timeout per test
- Path alias `@` → `./src`

## Design Principles

### Mobile First
- Build all UI for small screens first; layer desktop styles on top with Tailwind's `sm:` / `md:` / `lg:` breakpoints
- Use `MobileBottomNav` for primary navigation on small screens; ensure tap targets are ≥ 44 px
- Test touch interactions and viewport edge-cases before considering a UI change done

### SEO
- Use [src/lib/seo.ts](src/lib/seo.ts) helpers for all `metadata` exports — they handle Open Graph, canonical URLs, hreflang, and JSON-LD structured data consistently
- Every public page must export a `generateMetadata()` function; use `robots.ts` and `sitemap.ts` at the app root for crawl control
- Prefer server-rendered content for indexable text; avoid client-only rendering for anything that should appear in search results

### Reuse
- Check [src/components/common/](src/components/common/) and [src/lib/](src/lib/) before writing new UI or utility logic
- Shared API behaviour (auth guard, Zod validation, audit logging) must go through the established patterns in [src/lib/auth.ts](src/lib/auth.ts), [src/lib/rbac.ts](src/lib/rbac.ts), and [src/lib/audit.ts](src/lib/audit.ts) — don't inline these in individual route handlers
- CSS: extend the existing Tailwind config or [src/app/globals.css](src/app/globals.css) tokens; avoid one-off inline styles

### Performance
- Prefer async server components for data fetching; move state to the client only when interactivity requires it
- Use `cache: "no-store"` only when data must be real-time; let Next.js cache static and slow-changing data by default
- Heavy AI calls (Gemini) run server-side and are guarded by the 8 s timeout in [src/lib/ai/client.ts](src/lib/ai/client.ts); don't add blocking AI calls in the critical render path
- Load fonts with `display: optional` (already configured) to prevent layout shift; use Next.js `<Image>` for all images

### Security
- Every API route that touches user or patient data must call `requireAuth()` and the appropriate `ensureRole()` before reading/writing
- Never log raw PHI — pass data through [src/lib/security/phi-redactor.ts](src/lib/security/phi-redactor.ts) first
- Validate all external input at the API boundary with Zod; don't trust client-supplied role or entity IDs
- Internal cron/fire-and-forget routes under `/api/internal/*` must verify the `X-API-Key` header against `INTERNAL_API_KEY`
- Encryption keys (`ENCRYPTION_KEY`, `HEALTH_PHI_ENCRYPTION_KEY`) and `PHONE_SALT` must exist before any patient row is written; `PHONE_SALT` is immutable once set

### Multi-lingual Support
- All user-facing strings must go through the `useTranslations()` hook — never hardcode display text in components
- Translation keys live in [src/i18n/translations.ts](src/i18n/translations.ts); add new keys to **all 10 locales** (`en`, `hi`, `mr`, `ta`, `bn`, `ml`, `kn`, `te`, `ar`, `si`) in the same commit
- Use `t("namespace.key")` for dynamic strings; only hardcode text that is a proper noun or brand name that must not be translated (e.g., "EasyHeals")
- RTL layout (Arabic `ar`) must be verified whenever adding new flex/grid layouts — use logical CSS properties (`margin-inline-start` etc.) or Tailwind's `rtl:` variant where needed
- The active locale is cookie-based (`easyheals_locale`); never read it from the URL — always use the `LocaleContext` via `useTranslations()`
- Do not use `navigator.language` or `Intl` directly for UI locale decisions — defer to the app's locale context

### Pagination
- All listing screens (hospitals, doctors, treatments, etc.) must fetch a maximum of **100 records per request**
- Server components fetch the first 100 items via ISR; the client renders a **"Load More" button** — never auto-scroll/IntersectionObserver — to fetch subsequent pages
- Public read-only listing API routes live under `/api/public/*`; they must accept `?offset=N` and return `{ data: [...], hasMore: boolean }`
- Filter option metadata (city list, specialty list) is fetched in a separate lightweight query so it covers the full dataset even when the main list is paginated
- Run `listXDirectory(limit + 1, offset)` internally and slice to `limit` — if the extra row exists, `hasMore = true`

### Smart UX
- Gate unreleased or role-restricted features behind `<FeatureGate flag="...">` rather than hiding them with CSS or conditional rendering scattered across components
- Auth-required actions (booking, health coach) should trigger `AuthBookingModal` / `ReauthModal` inline — never silently fail or redirect away
- Surface loading, empty, and error states explicitly; optimistic UI is preferred for actions the user initiates
- The `useSessionHealth` hook handles session expiry silently across tabs — don't duplicate session polling logic elsewhere

### Build Notes
- `@libsql/client` is listed under `serverExternalPackages` in [next.config.ts](next.config.ts) to prevent bundling native `.node` files on Vercel
- `ignoreBuildErrors: true` is set — TypeScript errors won't block `npm run build`, but always run `npm run typecheck` manually
- Seven legacy `/search/*` routes redirect to `/hospitals` or `/treatments` via `next.config.ts`
