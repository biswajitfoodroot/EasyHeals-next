# Provider Management and Home Website Architecture

## Provider Management Architecture

### 1. App Router / Page Layout
- The provider management workspace is under `src/app/provider-management`.
- It has a public login page at `src/app/provider-management/login/page.tsx`.
- Protected content lives in `src/app/provider-management/(protected)/`.
- `src/app/provider-management/(protected)/layout.tsx` enforces auth and role-based access:
  - reads auth from cookies via `getAuthFromCookies()` in `src/lib/auth.ts`
  - redirects unauthenticated users to `/provider-management/login`
  - redirects unauthorized users to `/unauthorized?from=provider-management`
  - wraps child pages with `PMShell` and `ProviderManagementNav`

### 2. Presentation Layer
- Navigation and shell:
  - `src/components/provider-management/ProviderManagementNav.tsx`
  - `src/components/provider-management/PMShell.tsx`
- Feature pages are organized by domain under the protected router:
  - `/appointments` → `PMAppointmentsClient.tsx`
  - `/providers` → `ProvidersManagementClient.tsx`
  - `/packages` → `PackagesClient.tsx`
  - `/payouts`, `/commissions`, `/subscriptions`, `/referrals`, `/agents`, `/coordinators`, `/access`, `/kyc`, `/audit-log`, `/travel`, `/patients`
- Most pages are client components that fetch backend data and render provider-facing management UI.

### 3. API / Service Layer
- Provider management features use API routes under `src/app/api/provider-management/*`.
- Client components call endpoints such as:
  - `/api/provider-management/providers`
  - `/api/provider-management/packages`
  - `/api/provider-management/agents`
  - `/api/provider-management/appointments`
  - `/api/provider-management/travel`
- These APIs handle authentication, role checks, validation, and database operations.

### 4. Auth / RBAC Layer
- `ProviderManagementLayout` enforces entry-level auth and role allowance.
- API routes enforce auth and RBAC consistently.
- Allowed roles include:
  - `owner`, `admin`, `admin_manager`, `admin_editor`, `operator`, `coordinator`

### 5. Data Layer
- The application uses Drizzle ORM and the repo's schema.
- Provider management data covers:
  - provider/hospital records
  - subscriptions and billing
  - agreements
  - referrals
  - commissions and payouts
  - KYC requests
  - field agents and coordinators
  - appointments, patients, travel cases

---

## Home Website Architecture

### 1. Root Page / Server Layer
- The home page is `src/app/page.tsx`.
- It is a Next.js server component that:
  - defines SEO metadata and JSON-LD structured data
  - fetches top hospitals using `listHospitalsDirectory(100, 0)` from `src/lib/profile-data`
  - passes normalized hospital data into `<HomePage />`

### 2. Client Home Component
- `src/components/homepage/HomePage.tsx` is a client-side component.
- It manages interactive state and behaviors:
  - language selector
  - city picker
  - mobile menu state
  - search query input
  - GPS location detection
  - login state
  - platform stats
  - city hospital results
- It calls client APIs:
  - `/api/v1/patients/me` for auth status
  - `/api/public/stats` for platform metrics
  - `/api/v1/location` for geo city lookup
  - `/api/public/hospitals-by-city` for city-based hospital results

### 3. Presentation & UX
- Styling is centralized in `src/components/homepage/homepage.module.css`.
- The page renders:
  - white theme top navigation
  - multilingual search input
  - city picker with GPS support
  - popular hospital cards
  - FAQ and trust sections
  - registration and contribute modal support

### 4. Localization Layer
- Home UI uses `useTranslations()` from `src/i18n/LocaleContext`.
- Translations are defined in `src/i18n/translations.ts`.
- Home-specific keys include `home.searchCity`, `home.useMyLocation`, `home.detecting`, `home.noCitiesFound`, etc.

### 5. SEO / Content Layer
- `src/app/page.tsx` includes rich metadata:
  - Open Graph
  - Twitter card
  - `WebSite`, `Organization`, `MedicalWebPage` JSON-LD
  - FAQ JSON-LD
- This helps search engines and AI discovery.

---

## Key Differences
- Provider management is a protected admin plane; the home website is a public marketing/search landing page.
- Provider management is organized around internal operations, RBAC, and CRUD APIs.
- Home website is organized around user discovery, localization, SEO, and public data consumption.

## Security Threats in Provider Management APIs
- Authentication is cookie-based and the provider-management routes do not show explicit CSRF protection.
  - Because state-changing requests rely on browser cookies, CSRF is a real risk unless `SameSite` / anti-CSRF headers are enforced.
- Authorization is coarse and lacks row-level enforcement.
  - Routes such as `/api/provider-management/travel` allow permitted roles to read and edit any travel case without checking ownership or assignment.
  - `providers/[id]`, `packages`, `subscriptions`, `agreements`, and `commissions` all rely on broad role checks but not resource-specific access controls.
- Input validation is weak and ad-hoc.
  - APIs parse JSON bodies with inline type assertions instead of schema validation, increasing the chance of malformed or malicious payloads.
  - `packages/route.ts`, `commissions/route.ts`, and `subscriptions/route.ts` accept free-form fields that are not normalized or constrained.
- Sensitive data exposure is possible through overly broad responses.
  - `travel/route.ts` returns patient names, phone numbers, budgets, and requirements to any allowed role.
  - `agreements/route.ts` returns hospital and doctor names for all accepted agreements.
- Audit logging is missing from these handlers.
  - Provider management operations should be auditable so changes to subscriptions, providers, commissions, travel cases, and coordinator permissions can be tracked.

## File References
- Provider management layout: `src/app/provider-management/(protected)/layout.tsx`
- Provider management nav: `src/components/provider-management/ProviderManagementNav.tsx`
- Homepage component: `src/components/homepage/HomePage.tsx`
- Homepage styles: `src/components/homepage/homepage.module.css`
- Home translations: `src/i18n/translations.ts`
- Home page route: `src/app/page.tsx`
