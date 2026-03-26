
import { db } from "./src/db/client";
import { ingestionSources, ingestionJobs } from "./src/db/schema";
import { desc, eq } from "drizzle-orm";

async function check() {
    const [latestJob] = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(1);
    if (!latestJob) return;

    console.log(`Job ID: ${latestJob.id}`);
    const sources = await db.select().from(ingestionSources).where(eq(ingestionSources.jobId, latestJob.id));
    console.log("--- Crawled URLs ---");
    sources.forEach(s => {
        console.log(`URL: ${s.sourceUrl} | Type: ${s.sourceType} | Confidence: ${s.confidence}`);
    });
}

check().catch(console.error);
