/**
 * POST /api/v1/care-nav/triage — Symptom triage + care navigation
 *
 * Free for all authenticated patients (drives engagement → upgrades).
 * Uses Gemini to classify urgency, recommend specialists, flag red flags.
 * Falls back to rule-based heuristics if Gemini is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { requirePatientSession } from "@/lib/core/patient-session";
import { env } from "@/lib/env";
import { getGeminiClient } from "@/lib/ai/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UrgencyLevel = "emergency" | "urgent" | "routine" | "self_care";

export interface TriageResult {
  urgency: UrgencyLevel;
  urgencyLabel: string;
  urgencyColor: "red" | "orange" | "yellow" | "green";
  urgencyIcon: string;
  specialists: Array<{ specialty: string; reason: string }>;
  redFlags: string[];
  selfCare: string[];
  disclaimer: string;
}

// ── Urgency metadata ──────────────────────────────────────────────────────────

const URGENCY_META: Record<UrgencyLevel, { label: string; color: "red" | "orange" | "yellow" | "green"; icon: string }> = {
  emergency: { label: "Go to ER immediately", color: "red", icon: "🚨" },
  urgent:    { label: "See a doctor today", color: "orange", icon: "⚠️" },
  routine:   { label: "Book appointment this week", color: "yellow", icon: "📅" },
  self_care: { label: "Home care is likely fine", color: "green", icon: "✅" },
};

// ── Rule-based fallback ────────────────────────────────────────────────────────

const EMERGENCY_PATTERNS = /(chest pain|heart attack|stroke|can't breathe|unconscious|severe bleeding|collapse|anaphylaxis|seizure|sudden blindness|chhati mein dard)/i;
const URGENT_PATTERNS    = /(high fever|difficulty breathing|severe pain|vomiting blood|head injury|broken bone|urinary tract infection|appendicitis|tez bukhar)/i;
const SELF_CARE_PATTERNS = /(mild cold|runny nose|sore throat|minor cut|headache|fatigue|common cough|slight fever|body ache)/i;

function heuristicTriage(symptoms: string): TriageResult {
  let urgency: UrgencyLevel = "routine";

  if (EMERGENCY_PATTERNS.test(symptoms)) urgency = "emergency";
  else if (URGENT_PATTERNS.test(symptoms)) urgency = "urgent";
  else if (SELF_CARE_PATTERNS.test(symptoms)) urgency = "self_care";

  const meta = URGENCY_META[urgency];

  const specialists: Array<{ specialty: string; reason: string }> = [];
  if (/(heart|chest|cardio)/.test(symptoms)) specialists.push({ specialty: "Cardiologist", reason: "Symptoms suggest cardiac involvement" });
  if (/(breath|lung|cough|asthma)/.test(symptoms)) specialists.push({ specialty: "Pulmonologist", reason: "Respiratory symptoms detected" });
  if (/(stomach|abdomen|nausea|vomit|digestion)/.test(symptoms)) specialists.push({ specialty: "Gastroenterologist", reason: "Gastrointestinal symptoms" });
  if (/(joint|knee|back|bone|spine)/.test(symptoms)) specialists.push({ specialty: "Orthopaedician", reason: "Musculoskeletal symptoms" });
  if (/(head|brain|neuro|dizzy|memory|seizure)/.test(symptoms)) specialists.push({ specialty: "Neurologist", reason: "Neurological symptoms" });
  if (specialists.length === 0) specialists.push({ specialty: "General Physician", reason: "Initial evaluation recommended" });

  return {
    urgency,
    urgencyLabel: meta.label,
    urgencyColor: meta.color,
    urgencyIcon: meta.icon,
    specialists: specialists.slice(0, 3),
    redFlags: [],
    selfCare: urgency === "self_care" ? ["Rest and stay hydrated", "Monitor temperature", "OTC paracetamol if needed"] : [],
    disclaimer: "This is AI-assisted triage only, not a medical diagnosis. Always consult a qualified doctor.",
  };
}

// ── Gemini triage ─────────────────────────────────────────────────────────────

function safeParseTriage(text: string): TriageResult | null {
  const stripped = text.includes("```") ? text.replace(/```json|```/g, "").trim() : text.trim();
  try {
    const p = JSON.parse(stripped) as Partial<TriageResult & { urgency: string }>;
    if (!p.urgency) return null;
    const urgency = (["emergency", "urgent", "routine", "self_care"].includes(p.urgency as string)
      ? p.urgency
      : "routine") as UrgencyLevel;
    const meta = URGENCY_META[urgency];
    return {
      urgency,
      urgencyLabel: typeof p.urgencyLabel === "string" ? p.urgencyLabel : meta.label,
      urgencyColor: meta.color,
      urgencyIcon: meta.icon,
      specialists: Array.isArray(p.specialists) ? p.specialists.slice(0, 3) : [],
      redFlags: Array.isArray(p.redFlags) ? p.redFlags.slice(0, 5) : [],
      selfCare: Array.isArray(p.selfCare) ? p.selfCare.slice(0, 5) : [],
      disclaimer: "This is AI-assisted triage only, not a medical diagnosis. Always consult a qualified doctor.",
    };
  } catch {
    return null;
  }
}

async function geminiTriage(symptoms: string, age?: number, gender?: string): Promise<TriageResult> {
  const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });

  const prompt = [
    "You are a clinical triage assistant for India. Analyze the patient's symptoms and return ONLY valid JSON.",
    "",
    "JSON schema:",
    '{ "urgency": "emergency"|"urgent"|"routine"|"self_care",',
    '  "urgencyLabel": "short label for the patient",',
    '  "specialists": [{ "specialty": "...", "reason": "..." }],  // max 3',
    '  "redFlags": ["..."],   // warning signs to watch for, max 5',
    '  "selfCare": ["..."]    // actionable home tips, max 5 (only if routine/self_care) }',
    "",
    "Urgency definitions:",
    "  emergency — life-threatening, go to ER now (chest pain, stroke, severe breathing difficulty, major trauma)",
    "  urgent    — needs doctor today (high fever 103°F+, moderate pain, suspected infection, fall in elderly)",
    "  routine   — see a doctor this week (mild chronic symptoms, persistent non-severe symptoms)",
    "  self_care — can manage at home (mild cold, minor headache, slight fatigue without fever)",
    "",
    `Patient symptoms: ${symptoms}`,
    age   ? `Patient age: ${age}` : "",
    gender ? `Patient gender: ${gender}` : "",
    "",
    "Indian context: patient is in India. Recommend specialists available at Indian hospitals.",
    "Return ONLY the JSON object, no explanation.",
  ].filter(Boolean).join("\n");

  const result = await model.generateContent(prompt);
  return safeParseTriage(result.response.text()) ?? heuristicTriage(symptoms);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requirePatientSession(req);

  const body = (await req.json()) as { symptoms?: string; age?: number; gender?: string };
  const symptoms = (body.symptoms ?? "").trim();

  if (!symptoms || symptoms.length < 3) {
    throw new AppError("SEARCH_INTENT_FAILED", "Symptoms required", "Please describe your symptoms.", 400);
  }
  if (symptoms.length > 1000) {
    throw new AppError("SEARCH_INTENT_FAILED", "Too long", "Please keep your description under 1000 characters.", 400);
  }

  let result: TriageResult;

  if (env.GOOGLE_AI_API_KEY) {
    try {
      result = await geminiTriage(symptoms, body.age, body.gender);
    } catch {
      result = heuristicTriage(symptoms);
    }
  } else {
    result = heuristicTriage(symptoms);
  }

  return NextResponse.json({ data: result });
});
