import { db } from "./src/db/client";
import { sql } from "drizzle-orm";

async function check() {
    try {
        const info = await db.all(sql`PRAGMA table_info(ingestion_sources)`);
        console.log("Ingestion Sources Columns:", info);
    } catch (e) {
        console.error(e);
    }
}

check();
