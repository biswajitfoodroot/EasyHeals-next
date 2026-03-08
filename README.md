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
5. Run locally:
```bash
npm run dev
```

## Scripts
- `npm run dev` start local server
- `npm run lint` run ESLint
- `npm run typecheck` run TypeScript checks
- `npm run db:generate` generate migration SQL from schema
- `npm run db:migrate` apply migrations
- `npm run db:push` push schema directly (non-prod only)
- `npm run db:studio` open Drizzle Studio

## API foundation
- `GET /api/health` service health probe
- `GET /api/leads` list latest leads (role aware)
- `POST /api/leads` create lead with validation + audit log

Current auth mode is bootstrap header auth (`x-user-id`, `x-user-role`) for local phase-1 development.
