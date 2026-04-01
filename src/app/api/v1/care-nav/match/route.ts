/**
 * POST /api/v1/care-nav/match — AI-powered provider matching
 *
 * Patient describes symptoms/need → Gemini extracts specialty tags → vector
 * search + specialty filter over hospitals → ranked ProviderMatch list.
 *
 * Session stored encrypted in care_nav_sessions for history + analytics.
 *
 * Flag: care_nav
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, desc, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { hospitals, doctors, careNavSessions } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { getGeminiClient } from "@/lib/ai/client";
import { encryptPHI } from "@/lib/health/encryption";
import { env } from "@/lib/env";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProviderMatch {
  hospitalId: string;
  hospitalName: string;
  hospitalSlug: string;
  doctorId?: string;
  doctorName?: string;
  specialties: string[];
  matchReason: string;
  score: number;           // 0.0–1.0 (specialty match × rating weight)
  rating: number;
  city: string;
  estimatedFee?: string;
  verified: boolean;
}

// ── Gemini specialty extractor ─────────────────────────────────────────────────

async function extractSpecialtyTags(symptoms: string): Promise<string[]> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: {
          type: "object",
          properties: {
            specialties: {
              type: "array",
              items: { type: "string" },
              description: "Medical specialties best suited to treat the described symptoms",
            },
            summary: { type: "string", description: "One-line summary of the patient need" },
          },
          required: ["specialties", "summary"],
        } as any,
      },
    });

    const prompt = `You are a medical triage assistant for India.
Extract 1-4 medical specialties most appropriate for the following patient symptoms/concern.
Use standard medical specialty names (e.g. "Cardiology", "Orthopedics", "General Medicine", "Neurology").
Consider Indian healthcare context. Return JSON.

Patient input: "${symptoms}"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as { specialties: string[] };
    return Array.isArray(parsed.specialties) ? parsed.specialties.slice(0, 4) : [];
  } catch {
    return [];
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("care_nav");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null) as {
    symptoms: string;
    preferredCity?: string;
    budget?: number;
    appointmentType?: string;
  } | null;

  if (!body?.symptoms?.trim()) {
    throw new AppError("VALIDATION_ERROR", "symptoms required", "Please describe your symptoms or health concern.", 400);
  }

  const { symptoms, preferredCity, budget } = body;

  // 1. Extract specialties via Gemini
  const specialtyTags = await extractSpecialtyTags(symptoms);

  // 2. Query hospitals — filter by specialty overlap + optional city
  const conditions = [];
  if (preferredCity && preferredCity.toLowerCase() !== "all") {
    conditions.push(eq(hospitals.city, preferredCity));
  }
  conditions.push(eq(hospitals.isActive, true));

  const allHospitals = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      slug: hospitals.slug,
      specialties: hospitals.specialties,
      rating: hospitals.rating,
      city: hospitals.city,
      verified: hospitals.verified,
      feesRange: hospitals.feesRange,
    })
    .from(hospitals)
    .where(and(...conditions))
    .orderBy(desc(hospitals.rating))
    .limit(100);

  // 3. Score hospitals by specialty overlap
  const scored: ProviderMatch[] = [];
  for (const h of allHospitals) {
    const hSpecialties = (h.specialties as string[] | null) ?? [];
    const lowerSpecialties = hSpecialties.map((s) => s.toLowerCase());

    let overlapCount = 0;
    for (const tag of specialtyTags) {
      if (lowerSpecialties.some((s) => s.includes(tag.toLowerCase()) || tag.toLowerCase().includes(s))) {
        overlapCount++;
      }
    }

    // Score = specialty match ratio * rating weight (5-star scale → 0-1)
    const specialtyScore = specialtyTags.length > 0 ? overlapCount / specialtyTags.length : 0.3;
    const ratingScore = h.rating > 0 ? h.rating / 5 : 0.3;
    const score = specialtyScore * 0.7 + ratingScore * 0.3;

    if (score >= 0.2 || specialtyTags.length === 0) {
      const fees = h.feesRange as Record<string, unknown> | null;
      const estimatedFee = fees
        ? `₹${fees.min ?? "?"} – ₹${fees.max ?? "?"}`
        : undefined;

      const matchedSpecialties = specialtyTags.length > 0
        ? hSpecialties.filter((s) =>
            specialtyTags.some((t) => s.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(s.toLowerCase()))
          )
        : hSpecialties.slice(0, 2);

      const matchReason = specialtyTags.length > 0 && overlapCount > 0
        ? `Specialises in ${matchedSpecialties.slice(0, 2).join(", ")}`
        : "Highly rated general care";

      scored.push({
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalSlug: h.slug,
        specialties: hSpecialties,
        matchReason,
        score,
        rating: h.rating,
        city: h.city,
        estimatedFee,
        verified: h.verified,
      });
    }
  }

  // 4. Sort + take top 10
  const matches = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // 5. Persist session (encrypted symptoms) — fire and forget
  const matchedIds = matches.map((m) => m.hospitalId);
  void (async () => {
    try {
      const symptomsEnc = encryptPHI(symptoms);
      await db.insert(careNavSessions).values({
        patientId,
        symptomsEnc,
        matchedProviderIds: matchedIds,
      });
    } catch { /* non-fatal */ }
  })();

  return NextResponse.json({
    matches,
    specialtyTags,
    total: matches.length,
  });
});
