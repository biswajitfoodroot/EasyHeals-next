import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
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
});

export const env = {
  ...parsed,
  GOOGLE_AI_API_KEY: parsed.GOOGLE_AI_API_KEY || parsed.GEMINI_API_KEY,
};


