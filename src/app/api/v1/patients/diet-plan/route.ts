/**
 * POST /api/v1/patients/diet-plan — AI Weekly Diet Plan with Progress Analysis
 *
 * Accepts patient health profile, food preferences, and recent vitals.
 * Gemini analyses weekly progress trends and generates an adaptive diet plan.
 *
 * Auth:    eh_patient_session cookie
 * Premium: requirePremiumAccess (trial or paid subscription)
 *
 * Body: {
 *   height, weight, bloodGroup, conditions, allergies,   ← health profile
 *   foodPref, foodLikes, foodDislikes,                   ← diet preferences
 *   vitals: Array<{ date, weight, bp, glucose, pulse }>  ← weekly readings (optional)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requirePremiumAccess } from "@/lib/core/patient-trial";
import { withErrorHandler } from "@/lib/errors/app-error";
import { getGeminiClient, generateWithTimeout } from "@/lib/ai/client";
import { env } from "@/lib/env";

export const maxDuration = 30;

const FOOD_PREF_LABEL: Record<string, string> = {
  veg: "Vegetarian",
  non_veg: "Non-Vegetarian",
  eggetarian: "Eggetarian (Vegetarian + Eggs)",
};

interface VitalEntry { date?: string; weight?: string; bp?: string; glucose?: string; pulse?: string; }

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePatientSession(req);
  await requirePremiumAccess(session.patientId);

  const body = await req.json().catch(() => ({})) as {
    height?: string; weight?: string; bloodGroup?: string;
    conditions?: string; allergies?: string;
    foodPref?: string; foodLikes?: string; foodDislikes?: string;
    vitals?: VitalEntry[];
  };

  const profileLines = [
    body.height      ? `Height: ${body.height} cm`                          : null,
    body.weight      ? `Current Weight: ${body.weight} kg`                  : null,
    body.bloodGroup  ? `Blood Group: ${body.bloodGroup}`                    : null,
    body.conditions  ? `Medical Conditions: ${body.conditions}`             : null,
    body.allergies   ? `Allergies/Intolerances: ${body.allergies}`          : null,
    body.foodPref    ? `Diet Type: ${FOOD_PREF_LABEL[body.foodPref] ?? body.foodPref}` : null,
    body.foodLikes   ? `Preferred Foods: ${body.foodLikes}`                 : null,
    body.foodDislikes ? `Foods to Avoid: ${body.foodDislikes}`              : null,
  ].filter(Boolean).join("\n");

  // Build weekly vitals section
  const vitals = (body.vitals ?? []).slice(0, 7);
  let vitalsSection = "";
  if (vitals.length > 0) {
    const rows = vitals.map((v) => {
      const parts = [
        v.date ? `Date: ${v.date}` : null,
        v.weight ? `Weight: ${v.weight} kg` : null,
        v.bp ? `BP: ${v.bp}` : null,
        v.glucose ? `Glucose: ${v.glucose}` : null,
        v.pulse ? `Pulse: ${v.pulse}` : null,
      ].filter(Boolean).join(", ");
      return `  - ${parts}`;
    }).join("\n");

    // Calculate weight trend if available
    const weightReadings = vitals.map((v) => parseFloat(v.weight ?? "")).filter((n) => !isNaN(n));
    let weightTrend = "";
    if (weightReadings.length >= 2) {
      const diff = weightReadings[weightReadings.length - 1] - weightReadings[0];
      weightTrend = diff > 0.5 ? `Weight trend: +${diff.toFixed(1)} kg (gaining)`
                  : diff < -0.5 ? `Weight trend: ${diff.toFixed(1)} kg (losing)`
                  : "Weight trend: stable";
    }

    vitalsSection = `\nRecent Weekly Vitals (${vitals.length} readings):\n${rows}${weightTrend ? `\n${weightTrend}` : ""}`;
  }

  const prompt = `You are a clinical dietitian specialising in Indian patients. Analyse the patient's health data and create a personalised 7-day diet plan with weekly progress commentary.

Patient Health Profile:
${profileLines || "No specific health information provided."}${vitalsSection}

Your response must have TWO sections:

**SECTION 1 — WEEKLY PROGRESS ANALYSIS** (only if vitals data is provided)
- Briefly comment on weight trend, glucose readings, BP readings
- Highlight improvements or areas of concern
- Give 2-3 specific diet adjustments based on the trends
- Keep this section to 4-6 bullet points

**SECTION 2 — 7-DAY DIET PLAN**
For each day (Day 1 to Day 7), list:
- Breakfast
- Mid-morning snack
- Lunch
- Evening snack
- Dinner

Guidelines:
- Use practical Indian foods (dal, sabzi, roti, rice, idli, dosa, poha, upma, curd, fruits, etc.)
- Respect the diet type and allergies strictly
- Tailor portions and foods based on medical conditions (e.g. low sugar for diabetes, low sodium for hypertension)
- Keep each meal to 1-2 lines
- End with 3-4 practical health tips for this week`;

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

  const result = await generateWithTimeout(
    () => model.generateContent(prompt),
    25_000,
  );

  const plan = result.response.text();
  return NextResponse.json({ plan });
});
