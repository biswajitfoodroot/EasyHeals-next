import { NextRequest, NextResponse } from "next/server";
// Note: do NOT import from Node's 'crypto' — middleware runs in Edge runtime.
// globalThis.crypto.randomUUID() is available in Edge/Web Crypto API.

/**
 * SECURITY MODEL (read before modifying):
 * This middleware is a REDIRECT GUARD only — it checks cookie presence
 * to redirect unauthenticated users to /admin/login before the page renders.
 * It does NOT validate session tokens (requires a DB round-trip).
 *
 * ACTUAL AUTH ENFORCEMENT happens inside each route handler via requireAuth()
 * (src/lib/auth.ts), which validates the token hash against the DB.
 *
 * Do NOT add business logic here assuming the session is valid.
 *
 * P1 ADDITIONS (Task 3.9):
 * - X-Request-Id header on every response (for distributed tracing)
 * - Rate limit headers on /api/v1/leads (enforce in route handler, signal here)
 * - Bot check: honeypot field signaled via header for downstream handlers
 */

const ADMIN_COOKIE = "easyheals_next_session";
const ADMIN_COOKIE_V2 = "eh_admin_session"; // new name (Task 1.2b migration)
const PATIENT_COOKIE = "eh_patient_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = globalThis.crypto.randomUUID();

  // ── Admin route guard ───────────────────────────────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session =
      req.cookies.get(ADMIN_COOKIE_V2)?.value ??
      req.cookies.get(ADMIN_COOKIE)?.value;

    if (!session) {
      const redirectUrl = new URL("/admin/login", req.url);
      const response = NextResponse.redirect(redirectUrl);
      response.headers.set("X-Request-Id", requestId);
      return response;
    }
  }

  // ── Patient dashboard route guard ──────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const session = req.cookies.get(PATIENT_COOKIE)?.value;
    if (!session) {
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set("next", pathname);
      const response = NextResponse.redirect(redirectUrl);
      response.headers.set("X-Request-Id", requestId);
      return response;
    }
  }

  // ── Pass through all other routes ──────────────────────────────────────────
  const response = NextResponse.next();

  // X-Request-Id for distributed tracing
  response.headers.set("X-Request-Id", requestId);

  // x-pathname — lets server component layouts detect current path (e.g. portal login bypass)
  response.headers.set("x-pathname", pathname);

  // Security headers (supplement next.config.ts)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|robots.txt|sitemap.xml).*)",
  ],
};
