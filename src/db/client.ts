import { drizzle } from "drizzle-orm/libsql/http";

import { env } from "@/lib/env";
import * as schema from "@/db/schema";

export const db = drizzle({
  connection: {
    // Vercel build throws if URL is purely empty. Fallback used strictly to placate `drizzle`.
    url: env.TURSO_DATABASE_URL || "libsql://127.0.0.1",
    authToken: env.TURSO_AUTH_TOKEN,
  },
  schema,
});
