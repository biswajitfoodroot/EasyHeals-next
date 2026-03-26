
import { db } from "./src/db/client";
import { hospitals, hospitalListingPackages, doctors, doctorHospitalAffiliations } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function merge() {
    const stayId = "a1c8b2ad-de5e-4546-8a90-9c87585d7bca"; // Manipal Hospitals Baner
    const moveFromId = "c32ec177-0880-43da-9114-f504858a784f"; // Manipal Hospitals (Pune)

    console.log(`Merging ${moveFromId} into ${stayId}...`);

    // Move packages
    await db.update(hospitalListingPackages)
        .set({ hospitalId: stayId })
        .where(eq(hospitalListingPackages.hospitalId, moveFromId));

    // Move affiliations
    await db.update(doctorHospitalAffiliations)
        .set({ hospitalId: stayId })
        .where(eq(doctorHospitalAffiliations.hospitalId, moveFromId));

    // Update website to the more specific one if needed
    await db.update(hospitals)
        .set({
            website: "https://www.manipalhospitals.com/baner/",
            isActive: true,
            updatedAt: new Date()
        })
        .where(eq(hospitals.id, stayId));

    // Delete the duplicate
    await db.delete(hospitals).where(eq(hospitals.id, moveFromId));

    console.log("Merge complete.");
}

merge().catch(console.error);
