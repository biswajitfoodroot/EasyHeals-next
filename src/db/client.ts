import { createClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/lib/env";
import * as schema from "@/db/schema";

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
