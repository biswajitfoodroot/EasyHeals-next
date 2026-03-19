import { getGeminiClient } from "@/lib/ai/client";
import { and, eq, like, or } from "drizzle-orm";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Enriches a doctor profile using Gemini Google Search Grounding.
 * Called automatically on first profile visit (aiEnrichedAt === null).
 * Saves affiliations, bio, review summary, qualifications back to DB.
 */
export async function enrichDoctorProfile(
  doctorId: string,
  doctorName: string,
  city: string | null,
): Promise<void> {
  if (!env.GOOGLE_AI_API_KEY) return;

  // ── Step 1: Google Search Grounding ──────────────────────────────────────
  const searchModel = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    // @ts-expect-error — googleSearch tool is valid at runtime
    tools: [{ googleSearch: {} }],
  });

  const locationHint = city ? ` in ${city}, India` : " in India";

  let groundedText = "";
  try {
    const searchResult = await searchModel.generateContent(
      `Research the doctor "${doctorName}"${locationHint}. Find:
1. Which hospitals or clinics they are affiliated with (name, city)
2. Their medical specialization and qualifications / degrees
3. Years of experience
4. Summary of patient reviews and reputation
5. Any brief bio or professional background`,
    );
    groundedText =
      searchResult.response.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("\n") ?? "";
  } catch {
    // Mark as enriched (with timestamp) even on failure to avoid retrying every ISR cycle
    await db.update(doctors).set({ aiEnrichedAt: new Date(), updatedAt: new Date() }).where(eq(doctors.id, doctorId));
    return;
  }

  // ── Step 2: Extract structured entities ──────────────────────────────────
  const extractModel = getGeminiClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  });

  interface EnrichData {
    specialization?: string | null;
    qualifications?: string[];
    yearsOfExperience?: number | null;
    bio?: string | null;
    reviewSummary?: string | null;
    affiliatedHospitals?: Array<{ name: string; city?: string | null; role?: string | null }>;
  }

  let data: EnrichData = {};
  try {
    const extractResult = await extractModel.generateContent(
      `Extract structured data about Dr. ${doctorName} from this research text.

Research:
${groundedText.slice(0, 5000)}

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "specialization": "primary specialization string or null",
  "qualifications": ["MBBS", "MS", ...],
  "yearsOfExperience": number or null,
  "bio": "2–3 sentence professional bio or null",
  "reviewSummary": "2–3 sentence summary of patient reviews and reputation or null",
  "affiliatedHospitals": [
    { "name": "hospital or clinic name", "city": "city or null", "role": "role/department or null" }
  ]
}`,
    );
    const raw = extractResult.response.text();
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]) as EnrichData;
  } catch {
    data = {};
  }

  // ── Step 3: Fetch existing doctor to avoid overwriting good data ──────────
  const [existing] = await db.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  if (!existing) return;

  const update: Record<string, unknown> = {
    aiEnrichedAt: new Date(),
    updatedAt: new Date(),
  };

  if (!existing.specialization && data.specialization) update.specialization = data.specialization;
  if (
    (!existing.qualifications || (existing.qualifications as string[]).length === 0) &&
    Array.isArray(data.qualifications) &&
    data.qualifications.length > 0
  ) {
    update.qualifications = data.qualifications;
  }
  if (!existing.yearsOfExperience && data.yearsOfExperience) {
    update.yearsOfExperience = Number(data.yearsOfExperience);
  }
  if (!existing.bio && data.bio) update.bio = data.bio;
  if (data.reviewSummary) update.aiReviewSummary = data.reviewSummary;

  await db.update(doctors).set(update).where(eq(doctors.id, doctorId));

  // ── Step 4: Create affiliations for matched hospitals ─────────────────────
  if (!Array.isArray(data.affiliatedHospitals)) return;

  for (const hosp of data.affiliatedHospitals.slice(0, 6)) {
    if (!hosp.name || hosp.name.length < 3) continue;

    // Try exact name match first, then fuzzy
    const nameParts = hosp.name.split(/\s+/).filter((w) => w.length > 3);
    const conditions = nameParts.slice(0, 4).map((w) => like(hospitals.name, `%${w}%`));

    const [matched] = await db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(
        conditions.length > 0
          ? and(eq(hospitals.isActive, true), or(...conditions))
          : eq(hospitals.isActive, true),
      )
      .limit(1);

    if (!matched) continue;

    // Skip if affiliation already exists
    const [existingAff] = await db
      .select({ id: doctorHospitalAffiliations.id })
      .from(doctorHospitalAffiliations)
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, doctorId),
          eq(doctorHospitalAffiliations.hospitalId, matched.id),
        ),
      )
      .limit(1);

    if (existingAff) continue;

    await db.insert(doctorHospitalAffiliations).values({
      doctorId,
      hospitalId: matched.id,
      role: hosp.role ?? "Consultant",
      isPrimary: false,
      source: "ai_enrichment",
      isActive: true,
    });
  }
}
