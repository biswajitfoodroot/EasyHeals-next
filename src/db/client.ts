import { drizzle } from "drizzle-orm/libsql/http";

import { env } from "@/lib/env";
import * as schema from "@/db/schema";

export const db = drizzle({
  connection: {
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  },
  schema,
});
