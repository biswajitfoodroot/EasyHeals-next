/**
 * Task 0.6 — Gemini AI Client Singleton (C1/C2 fix)
 *
 * Problems solved:
 *  - 13 scattered `new GoogleGenerativeAI()` instantiations → one singleton
 *  - No timeout on Gemini calls → one hung call could freeze a request forever
 *  - No cost/usage visibility → in-memory token counter exposed on /api/health
 *
 * Usage:
 *   const genAI = getGeminiClient();
 *   const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
 *   const result = await generateWithTimeout(() => model.generateContent(prompt));
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "@/lib/env";

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY ?? "");
  }
  return _client;
}

// ─── Timeout wrapper ─────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Runs an async Gemini call with a hard timeout.
 * Throws a descriptive error if the model doesn't respond in time.
 */
export async function generateWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Gemini call timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Token usage counter ─────────────────────────────────────────────────────

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  calls: number;
  lastResetAt: number;
};

let _usage: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
  lastResetAt: Date.now(),
};

export function trackTokenUsage(input: number, output: number): void {
  _usage.inputTokens += input;
  _usage.outputTokens += output;
  _usage.calls += 1;
}

export function getTokenUsage(): Readonly<TokenUsage> {
  return { ..._usage };
}

export function resetTokenUsage(): void {
  _usage = { inputTokens: 0, outputTokens: 0, calls: 0, lastResetAt: Date.now() };
}
