/**
 * Task 1.3 — AppError framework
 *
 * - Full error code taxonomy (14 prefixes, 40 codes) per HLD §7.1
 * - AppError class with statusCode + isOperational flag
 * - withErrorHandler() wraps route handlers with structured error responses
 * - Unexpected errors reported to Sentry (PHI-redacted) if SENTRY_DSN is set
 */

import { phiRedact } from "@/lib/security/phi-redactor";

// ─── Error Code Taxonomy ──────────────────────────────────────────────────────

export type ErrorCode =
  // AUTH_ — Authentication / authorisation (401/403)
  | "AUTH_OTP_EXPIRED"
  | "AUTH_INVALID_TOKEN"
  | "AUTH_FORBIDDEN"
  | "AUTH_SESSION_EXPIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "AUTH_TOTP_REQUIRED"    // session exists but TOTP not yet validated (owner/admin)
  | "AUTH_TOTP_INVALID"     // TOTP code rejected
  | "AUTH_TOTP_NOT_SETUP"   // owner/admin has not enrolled TOTP yet
  // CONSENT_ — Consent violations (403/451)
  | "CONSENT_MISSING"
  | "CONSENT_PURPOSE_MISMATCH"
  | "CONSENT_REVOKED"
  // SEARCH_ — Search errors (400/429)
  | "SEARCH_INTENT_FAILED"
  | "SEARCH_NO_RESULTS"
  | "SEARCH_RATE_LIMITED"
  // LEAD_ — Lead / callback errors (422/409)
  | "LEAD_CONSENT_REQUIRED"
  | "LEAD_DUPLICATE"
  | "LEAD_HOSPITAL_INACTIVE"
  // BOOK_ — Appointment booking P2 (409/422) — codes exist in P1, feature-flagged
  | "BOOK_SLOT_TAKEN"
  | "BOOK_PATIENT_BLACKOUT"
  | "BOOK_HOSPITAL_CLOSED"
  // AI_ — AI operation errors (503/429)
  | "AI_QUOTA_EXCEEDED"
  | "AI_PROVIDER_DOWN"
  | "AI_COST_LIMIT"
  | "AI_CACHE_MISS"
  // NOTIFY_ — Notification errors (422/500)
  | "NOTIFY_WA_TEMPLATE_REJECTED"
  | "NOTIFY_OPT_OUT"
  | "NOTIFY_DLT_INVALID"
  // PHI_ — Clinical / privacy (403/451)
  | "PHI_ACCESS_DENIED"
  | "PHI_CONSENT_MISSING"
  | "PHI_AUDIT_REQUIRED"
  // GAME_ — Gamification (409/429)
  | "GAME_EVENT_DUPLICATE"
  | "GAME_PROOF_INVALID"
  | "GAME_CAP_HIT"
  | "GAME_ABUSE_FLAGGED"
  // INGEST_ — Ingestion / moderation (422/500)
  | "INGEST_SOURCE_UNREACHABLE"
  | "INGEST_CONFIDENCE_TOO_LOW"
  | "INGEST_CONFLICT"
  // CRM_ — CRM / lead integration (404/422)
  | "CRM_LEAD_NOT_FOUND"
  | "CRM_STATUS_INVALID_TRANSITION"
  | "CRM_WEBHOOK_FAILED"
  // RATE_ — Rate limiting (429)
  | "RATE_SEARCH_EXCEEDED"
  | "RATE_OTP_FLOOD"
  | "RATE_LEAD_FLOOD"
  // DB_ — Database (404/500)
  | "DB_UNIQUE_VIOLATION"
  | "DB_NOT_FOUND"
  | "DB_MIGRATION_PENDING"
  // SYS_ — System / unexpected (500)
  | "SYS_UNHANDLED"
  | "SYS_CONFIG_MISSING"
  | "SYS_HEALTH_DEGRADED";

// ─── Default HTTP status codes per error prefix ───────────────────────────────

const STATUS_BY_PREFIX: Record<string, number> = {
  AUTH_: 401,
  CONSENT_: 403,
  SEARCH_: 400,
  LEAD_: 422,
  BOOK_: 409,
  AI_: 503,
  NOTIFY_: 422,
  PHI_: 403,
  GAME_: 409,
  INGEST_: 422,
  CRM_: 404,
  RATE_: 429,
  DB_: 500,
  SYS_: 500,
};

function defaultStatusCode(code: ErrorCode): number {
  for (const [prefix, status] of Object.entries(STATUS_BY_PREFIX)) {
    if (code.startsWith(prefix)) return status;
  }
  return 500;
}

// ─── AppError Class ───────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage?: string,
    statusCode?: number,
    context?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage ?? message;
    this.statusCode = statusCode ?? defaultStatusCode(code);
    this.context = context;
    this.isOperational = isOperational;
    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── PHI-safe structured logger (console-based; swap for pino/winston later) ──

export const logger = {
  info(data: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "test") {
      console.info(JSON.stringify(phiRedact(data) as object));
    }
  },
  warn(data: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "test") {
      console.warn(JSON.stringify(phiRedact(data) as object));
    }
  },
  error(data: Record<string, unknown>): void {
    console.error(JSON.stringify(phiRedact(data) as object));
  },
};

// ─── Sentry helper (no-op if @sentry/nextjs not installed) ───────────────────

async function reportToSentry(err: unknown): Promise<void> {
  try {
    // Dynamic import — graceful no-op if @sentry/nextjs is not installed
    const loader = Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const sentry = await loader("@sentry/nextjs").catch(() => null) as
      | { captureException: (e: unknown) => void }
      | null;
    if (sentry?.captureException) {
      sentry.captureException(phiRedact(err));
    }
  } catch {
    // Sentry unavailable — log locally only
  }
}

// ─── withErrorHandler wrapper ─────────────────────────────────────────────────

import { NextRequest } from "next/server";

type RouteHandler<T = any> = (
  req: NextRequest,
  ctx: T,
) => Promise<Response>;

/**
 * Wraps a Next.js route handler with structured AppError handling.
 *
 * Usage:
 *   export const GET = withErrorHandler(async (req) => { ... });
 *   export const POST = withErrorHandler(async (req) => { ... });
 */
export function withErrorHandler<T = any>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        if (!err.isOperational) {
          await reportToSentry(err);
          logger.error({
            code: err.code,
            message: err.message,
            context: err.context,
          });
        }
        return Response.json(
          { error: { code: err.code, message: err.userMessage } },
          { status: err.statusCode },
        );
      }

      // Unexpected (non-operational) error
      await reportToSentry(err);
      logger.error({ code: "SYS_UNHANDLED", err });

      return Response.json(
        { error: { code: "SYS_UNHANDLED", message: "An unexpected error occurred" } },
        { status: 500 },
      );
    }
  };
}
