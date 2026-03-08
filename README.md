# EasyHeals Next

Independent greenfield codebase for EasyHeals vNext (Next.js + Turso + Drizzle).

## Stack
- Next.js App Router (TypeScript)
- Turso (libSQL/SQLite)
- Drizzle ORM + Drizzle Kit
- Mobile-first UI baseline + SEO primitives

## Local setup
1. Install dependencies:
```bash
npm install
```
2. Configure environment:
```bash
cp .env.example .env.local
```
3. Generate migrations (after schema changes):
```bash
npm run db:generate
```
4. Apply migrations:
```bash
npm run db:migrate
```
5. Seed base data (roles, admin user, hospitals, taxonomy):
```bash
npm run db:seed
```
6. Run locally:
```bash
npm run dev
```

## Scripts
- `npm run dev` start local server
- `npm run lint` run ESLint
- `npm run typecheck` run TypeScript checks
- `npm run db:generate` generate migration SQL from schema
- `npm run db:migrate` apply migrations
- `npm run db:seed` seed initial data
- `npm run db:push` push schema directly (non-prod only)
- `npm run db:studio` open Drizzle Studio

## Implemented now
- Real session-based auth (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`)
- Role-aware access control in APIs
- Hospitals CRUD APIs (`/api/hospitals`, `/api/hospitals/:id`)
- Taxonomy node CRUD APIs (`/api/taxonomy/nodes`, `/api/taxonomy/nodes/:id`)
- Admin UI (`/admin/login`, `/admin`) with create flows
- SEO discovery pages (`/hospitals`, `/hospitals/[slug]`, `/treatments`, `/treatments/[slug]`)

## Seeded admin (local)
- Email: `admin@easyheals-next.com`
- Password: `ChangeMe123!`

Change seeded credentials through `.env.local`:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
