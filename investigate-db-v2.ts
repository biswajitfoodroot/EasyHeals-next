
import { db } from "./src/db/client";
import { ingestionJobs, hospitals, doctors, hospitalListingPackages, ingestionDoctorCandidates, ingestionPackageCandidates } from "./src/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

async function check() {
    console.log("--- Latest applied packages ---");
    const latestPackages = await db.select().from(hospitalListingPackages).orderBy(desc(hospitalListingPackages.updatedAt)).limit(25);

    const hospitalIds = [...new Set(latestPackages.map(p => p.hospitalId))];

    if (hospitalIds.length > 0) {
        const affectedHospitals = await db.select().from(hospitals).where(inArray(hospitals.id, hospitalIds));
        const hMap = new Map(affectedHospitals.map(h => [h.id, h]));

        latestPackages.forEach(p => {
            const h = hMap.get(p.hospitalId);
            console.log(`Package: ${p.packageName} | Hospital: ${h?.name} (${h?.city}) | ID: ${p.hospitalId} | Source: ${p.source}`);
        });
    } else {
        console.log("No packages found.");
    }

    console.log("\n--- Latest Job Details ---");
    const [latestJob] = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(1);
    if (latestJob) {
        console.log(`Job ID: ${latestJob.id}, Status: ${latestJob.status}, Summary: ${JSON.stringify(latestJob.summary)}`);

        // Check if doctors exist for this job
        const docs = await db.select().from(ingestionDoctorCandidates).where(eq(ingestionDoctorCandidates.jobId, latestJob.id));
        console.log(`Doctor candidates for job: ${docs.length}`);
        if (docs.length > 0) {
            console.log(`First doctor candidate: ${docs[0].fullName}, applyStatus: ${docs[0].applyStatus}, reviewStatus: ${docs[0].reviewStatus}`);
        }
    }
}

check().catch(console.error);
