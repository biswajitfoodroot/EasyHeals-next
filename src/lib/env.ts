import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-2.5-flash"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_BASE_URL: process.env.APP_BASE_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});
