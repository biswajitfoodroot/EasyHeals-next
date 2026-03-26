
import { db } from "./src/db/client";
import { ingestionJobs, hospitals, doctors, hospitalListingPackages, ingestionDoctorCandidates, ingestionPackageCandidates } from "./src/db/schema";
import { desc, eq } from "drizzle-orm";

async function check() {
    console.log("--- Latest Ingestion Job ---");
    const latestJob = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(1);
    console.log(JSON.stringify(latestJob, null, 2));

    if (latestJob.length > 0) {
        const jobId = latestJob[0].id;
        console.log(`\n--- Candidates for Job ${jobId} ---`);
        const doctorCandidates = await db.select().from(ingestionDoctorCandidates).where(eq(ingestionDoctorCandidates.jobId, jobId));
        const packageCandidates = await db.select().from(ingestionPackageCandidates).where(eq(ingestionPackageCandidates.jobId, jobId));
        console.log(`Doctor Candidates: ${doctorCandidates.length}`);
        console.log(`Package Candidates: ${packageCandidates.length}`);

        if (doctorCandidates.length > 0) {
            console.log("Sample Doctor Candidate:", JSON.stringify(doctorCandidates[0], null, 2));
        }
    }

    console.log("\n--- Hospitals with 'Manipal' in name ---");
    const manipalHospitals = await db.select().from(hospitals).where(eq(hospitals.name, "Manipal Hospital")); // Try exact first or like
    // Actually let's use LIKE if possible, but Drizzle LIKE needs more imports
    const allHospitals = await db.select().from(hospitals).limit(100);
    const filtered = allHospitals.filter(h => h.name.includes("Manipal") || h.slug.includes("manipal"));
    console.log(JSON.stringify(filtered, null, 2));

    if (filtered.length > 0) {
        const hospitalId = filtered[0].id;
        console.log(`\n--- Packages for Hospital ID ${hospitalId} (${filtered[0].name}) ---`);
        const packages = await db.select().from(hospitalListingPackages).where(eq(hospitalListingPackages.hospitalId, hospitalId));
        console.log(`Total Packages: ${packages.length}`);
        if (packages.length > 0) {
            console.log("Sample Package:", JSON.stringify(packages[0], null, 2));
        }
    }
}

check().catch(console.error);
