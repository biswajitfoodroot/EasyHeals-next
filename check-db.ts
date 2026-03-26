import { db } from "./src/db/client";
import { sql } from "drizzle-orm";

async function check() {
    try {
        const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`);
        console.log("Tables:", tables);

        const hospitalCols = await db.all(sql`PRAGMA table_info(hospitals)`);
        console.log("Hospital Columns:", hospitalCols);
    } catch (e) {
        console.error(e);
    }
}

check();
