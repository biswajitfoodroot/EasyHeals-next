/**
 * Bot Guard (Task 3.8)
 *
 * Three-signal bot detection:
 *   1. Headless browser User-Agent detection
 *   2. Request cadence: < 500ms from same IP → suspect
 *   3. Honeypot: if x-bot-trap header is set → bot (middleware can inject this)
 *
 * All signals are ADVISORY — do not block outright (patient-safe).
 * - Verified bot: log + return { isBot: true, reason }
 * - Route handler decides whether to block or rate-limit
 *
 * Redis key: bot:cadence:{ipHash}  → INCR with 500ms TTL
 */
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { redisGet, redisSet } from "@/lib/core/redis";

// Known headless browser / scraper UA signatures (very conservative — major offenders only)
const HEADLESS_SIGNATURES = [
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "selenium",
  "webdriver",
  "htmlunit",
  "python-requests",
  "go-http-client",
  "curl/",
  "wget/",
  "libwww-perl",
  "scrapy",
];

export interface BotCheckResult {
  isBot: boolean;
  reason?: string;
  signal?: "ua" | "cadence" | "honeypot";
}

/**
 * Check if the request appears to be from a bot.
 * Safe to call on every request — Redis incr is very fast.
 */
export async function checkBotSignature(req: NextRequest): Promise<BotCheckResult> {
  // 1. Honeypot header — middleware can add x-bot-trap if form honeypot was filled
  if (req.headers.get("x-bot-trap") === "1") {
    return { isBot: true, reason: "Honeypot triggered", signal: "honeypot" };
  }

  // 2. User-Agent check
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  if (!ua) {
    return { isBot: true, reason: "Missing User-Agent", signal: "ua" };
  }
  for (const sig of HEADLESS_SIGNATURES) {
    if (ua.includes(sig)) {
      return { isBot: true, reason: `Headless UA: ${sig}`, signal: "ua" };
    }
  }

  // 3. Cadence check — requests < 500ms apart from same IP (very aggressive scraping pattern)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const cadenceKey = `bot:cadence:${ipHash}`;

  const existing = await redisGet<string>(cadenceKey);
  if (existing) {
    // Still within 500ms window → cadence bot signal
    return { isBot: true, reason: "Request cadence too fast", signal: "cadence" };
  }

  // Set a 500ms window marker (TTL in seconds — use 1s minimum possible with Upstash)
  // Note: Upstash minimum TTL is 1 second. For sub-second cadence detection,
  // we use 1s as a pragmatic proxy, which catches > 1 req/sec patterns.
  await redisSet(cadenceKey, "1", 1);

  return { isBot: false };
}
