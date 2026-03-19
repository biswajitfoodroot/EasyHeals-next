import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { discoverHospitalPricing } from "@/lib/ingestion";
import { db } from "@/db/client";
import {
    ingestionPackageCandidates,
    ingestionHospitalCandidates
} from "@/db/schema";
import { eq } from "drizzle-orm";

const querySchema = z.object({
    hospitalName: z.string().min(2),
    city: z.string().min(2),
    candidateId: z.string().optional(),
    jobId: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const forbidden = ensureRole(auth.role, ["owner", "admin"]);
    if (forbidden) return forbidden;

    try {
        const payload = await req.json();
        const { hospitalName, city, candidateId, jobId } = querySchema.parse(payload);

        const { packages, costs, sources } = await discoverHospitalPricing(hospitalName, city);

        // If candidateId is provided, we can auto-insert these as associated packages
        if (candidateId && jobId) {
            for (const pkg of packages) {
                await db.insert(ingestionPackageCandidates).values({
                    jobId,
                    hospitalCandidateId: candidateId,
                    packageName: pkg.packageName,
                    priceMin: pkg.priceMin,
                    priceMax: pkg.priceMax,
                    currency: pkg.currency || "INR",
                    reviewStatus: "draft",
                    applyStatus: "draft",
                    mergeAction: "review",
                });
            }
        }

        return NextResponse.json({
            data: {
                packages,
                costs,
                sources
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Pricing discovery failed" }, { status: 400 });
    }
}
