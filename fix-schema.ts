import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
    const tables = [
        "ingestion_sources",
        "ingestion_hospital_candidates",
        "ingestion_doctor_candidates",
        "ingestion_service_candidates",
        "ingestion_package_candidates"
    ];

    for (const table of tables) {
        try {
            await client.execute(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER`);
            console.log(`Added updated_at to ${table}`);
        } catch (e: any) {
            console.log(`Skipped ${table}: ${e.message}`);
        }
    }
}

run();
