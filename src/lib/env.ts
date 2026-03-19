import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  // Required at runtime; allow empty string during Next.js static build phase
  TURSO_DATABASE_URL: z.string().default(""),
  TURSO_AUTH_TOKEN: z.string().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
  GOOGLE_AI_API_KEY: z.string().optional().default(""),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),
  GOOGLE_SEARCH_API_KEY: z.string().optional().default(""),
  GOOGLE_SEARCH_CX: z.string().optional().default(""),
  JINA_API_KEY: z.string().optional().default(""),
  MSG91_AUTH_KEY: z.string().optional().default(""),
  MSG91_TEMPLATE_ID: z.string().optional().default(""),
  // PHASE 3: Browser automation
  BROWSERLESS_API_KEY: z.string().optional().default(""),
  ENABLE_BROWSER_AUTOMATION: z.enum(["true", "false"]).optional().default("false"),

  // ── P1: Redis (Upstash) ────────────────────────────────────────────────────
  // Get from: https://console.upstash.com → Create Database → REST API keys
  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),

  // ── P1: PHI Encryption ────────────────────────────────────────────────────
  // PHONE_SALT: 32-byte hex — generate once with: openssl rand -hex 32
  // WARNING: Never change after first patient row is created. Salt change = all phone lookups break.
  PHONE_SALT: z.string().optional().default(""),
  // ENCRYPTION_KEY: 32-byte hex for AES-256-GCM — rotate every 90 days
  // Generate: openssl rand -hex 32
  ENCRYPTION_KEY: z.string().optional().default(""),
  ENCRYPTION_KEY_VERSION: z.string().optional().default("v1"),

  // ── P1: OTP / Notifications ───────────────────────────────────────────────
  // NOTIFICATION_PROVIDER: controls which SMS provider is active
  // P1 = twilio (no DLT needed), P2 = msg91 (after DLT registration)
  NOTIFICATION_PROVIDER: z.enum(["console", "twilio", "msg91"]).optional().default("console"),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_PHONE_NUMBER: z.string().optional().default(""),

  // ── P1: Observability ─────────────────────────────────────────────────────
  // Get from: https://sentry.io → Project → Settings → Client Keys
  SENTRY_DSN: z.string().optional().default(""),

  // ── P1: Search Provider ───────────────────────────────────────────────────
  // P1 = fts5 (built-in SQLite), P3 = typesense
  SEARCH_PROVIDER: z.enum(["fts5", "typesense"]).optional().default("fts5"),
  TYPESENSE_HOST: z.string().optional().default(""),
  TYPESENSE_API_KEY: z.string().optional().default(""),

  // ── P2: Payments (Razorpay) ────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),

  // ── P3: EMR (Neon Postgres — separate PHI database) ──────────────────────
  NEON_DATABASE_URL: z.string().optional().default(""),
  EMR_ENCRYPTION_KEY: z.string().optional().default(""), // 32-byte hex — separate from ENCRYPTION_KEY

  // ── P3: Consultation Room Providers ───────────────────────────────────────
  DAILY_CO_API_KEY: z.string().optional().default(""),
  WHEREBY_API_KEY: z.string().optional().default(""),

  // ── P3: Jitsi (free-tier video) ───────────────────────────────────────────
  JITSI_APP_ID: z.string().optional().default(""),
  JITSI_APP_SECRET: z.string().optional().default(""),
  JITSI_DOMAIN: z.string().optional().default("meet.jit.si"),

  // ── P3: Firebase FCM (push notifications) ────────────────────────────────
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),

  // ── P2: Payments ──────────────────────────────────────────────────────────
  PAYMENT_PROVIDER: z.enum(["console", "razorpay"]).optional().default("console"),

  // ── P5: Health Memory (separate key from phone encryption) ────────────────
  // Generate: openssl rand -hex 32  — NEVER reuse ENCRYPTION_KEY for health data
  HEALTH_PHI_ENCRYPTION_KEY: z.string().optional().default(""),
  HEALTH_PHI_KEY_VERSION: z.string().optional().default("v1"),

  // ── P5: Vercel Blob (patient document storage) ────────────────────────────
  // Get from: Vercel project → Storage → Blob → Connect Store → .env.local
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),

  // ── P5: ABHA / ABDM (Ayushman Bharat Digital Mission) ────────────────────
  // Get from: https://sandbox.abdm.gov.in/  (NHA developer portal)
  ABDM_CLIENT_ID: z.string().optional().default(""),
  ABDM_CLIENT_SECRET: z.string().optional().default(""),
  ABDM_BASE_URL: z.string().optional().default("https://sandbox.abdm.gov.in/api/v3"),

  // ── P5: Internal API security (fire-and-forget routes) ────────────────────
  INTERNAL_API_KEY: z.string().optional().default(""),
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_BASE_URL: process.env.APP_BASE_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY,
  GOOGLE_SEARCH_CX: process.env.GOOGLE_SEARCH_CX,
  JINA_API_KEY: process.env.JINA_API_KEY,
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
  BROWSERLESS_API_KEY: process.env.BROWSERLESS_API_KEY,
  ENABLE_BROWSER_AUTOMATION: process.env.ENABLE_BROWSER_AUTOMATION,
  // P1 new
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  PHONE_SALT: process.env.PHONE_SALT,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  ENCRYPTION_KEY_VERSION: process.env.ENCRYPTION_KEY_VERSION,
  NOTIFICATION_PROVIDER: process.env.NOTIFICATION_PROVIDER,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  SENTRY_DSN: process.env.SENTRY_DSN,
  SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
  TYPESENSE_HOST: process.env.TYPESENSE_HOST,
  TYPESENSE_API_KEY: process.env.TYPESENSE_API_KEY,
  // P2
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  // P3
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
  EMR_ENCRYPTION_KEY: process.env.EMR_ENCRYPTION_KEY,
  DAILY_CO_API_KEY: process.env.DAILY_CO_API_KEY,
  WHEREBY_API_KEY: process.env.WHEREBY_API_KEY,
  JITSI_APP_ID: process.env.JITSI_APP_ID,
  JITSI_APP_SECRET: process.env.JITSI_APP_SECRET,
  JITSI_DOMAIN: process.env.JITSI_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  // P5
  HEALTH_PHI_ENCRYPTION_KEY: process.env.HEALTH_PHI_ENCRYPTION_KEY,
  HEALTH_PHI_KEY_VERSION: process.env.HEALTH_PHI_KEY_VERSION,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  ABDM_CLIENT_ID: process.env.ABDM_CLIENT_ID,
  ABDM_CLIENT_SECRET: process.env.ABDM_CLIENT_SECRET,
  ABDM_BASE_URL: process.env.ABDM_BASE_URL,
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
});

export const env = {
  ...parsed,
  GOOGLE_AI_API_KEY: parsed.GOOGLE_AI_API_KEY || parsed.GEMINI_API_KEY,
};


