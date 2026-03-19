import { env } from "@/lib/env";
import { getGeminiClient } from "@/lib/ai/client";

export interface SearchIntent {
  language: string;
  translatedQuery: string;
  specialty: string;
  specialtyKey: string;
  symptoms: string[];
  location: string | null;
  city: string | null;
  entity: string | null;
  searchType: "symptom" | "doctor_name" | "hospital_name" | "treatment" | "lab_test" | "general";
  confidence: number;
}

type SpecialtyRule = {
  specialty: string;
  specialtyKey: string;
  pattern: RegExp;
};

const SPECIALTY_RULES: SpecialtyRule[] = [
  {
    specialty: "Cardiology",
    specialtyKey: "cardiology",
    pattern: /(heart|cardio|chest pain|angioplasty|bypass|palpitation|seene|chhati|hriday)/i,
  },
  {
    specialty: "Orthopaedics",
    specialtyKey: "ortho",
    pattern: /(knee|joint|bone|fracture|spine|ortho|arthritis|ghutna|haddi)/i,
  },
  {
    specialty: "Neurology",
    specialtyKey: "neurology",
    pattern: /(headache|neuro|stroke|epilepsy|brain|memory|seizure|sir dard|dimag)/i,
  },
  {
    specialty: "Maternity",
    specialtyKey: "maternity",
    pattern: /(pregnan|gyn|delivery|ivf|fertility|period|pcod|garbh|mahila)/i,
  },
  {
    specialty: "Oncology",
    specialtyKey: "oncology",
    pattern: /(cancer|tumou?r|oncolog|chemo|radiation|biopsy)/i,
  },
  {
    specialty: "Diagnostics",
    specialtyKey: "diagnostic",
    pattern: /(mri|ct scan|x-?ray|blood test|lab test|diagnostic|scan)/i,
  },
  {
    specialty: "General Medicine",
    specialtyKey: "general",
    pattern: /.*/i,
  },
];

const CITY_HINTS = [
  "Pune",
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Nagpur",
];

function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hindi";
  if (/[\u0980-\u09FF]/.test(text)) return "bengali";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gujarati";
  if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kannada";
  if (/[\u0D00-\u0D7F]/.test(text)) return "malayalam";
  return "english";
}

function detectSearchType(query: string): SearchIntent["searchType"] {
  if (/(dr\.?\s|doctor|consultant|specialist)/i.test(query)) return "doctor_name";
  if (/(hospital|clinic|care center|medical college)/i.test(query)) return "hospital_name";
  if (/(scan|blood test|lab|diagnostic)/i.test(query)) return "lab_test";
  if (/(surgery|therapy|treatment|operation|procedure)/i.test(query)) return "treatment";
  if (/(pain|fever|rash|cough|vomit|weak|breath|symptom|dard|bukhar|khansi)/i.test(query)) {
    return "symptom";
  }
  return "general";
}

function heuristicIntent(query: string): SearchIntent {
  const normalized = query.trim();
  const rule =
    SPECIALTY_RULES.find((item) => item.pattern.test(normalized)) ??
    SPECIALTY_RULES[SPECIALTY_RULES.length - 1];
  const location =
    CITY_HINTS.find((city) => new RegExp(`\\b${city}\\b`, "i").test(normalized)) ?? null;

  return {
    language: detectLanguage(normalized),
    translatedQuery: normalized,
    specialty: rule.specialty,
    specialtyKey: rule.specialtyKey,
    symptoms: normalized
      .split(/[,.;]|\band\b|\bwith\b|\bor\b/gi)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 2)
      .slice(0, 5),
    location,
    city: location,
    entity: null,
    searchType: detectSearchType(normalized),
    confidence: 0.65,
  };
}

function safeIntentParse(text: string): SearchIntent | null {
  const stripped = text.includes("```") ? text.replace(/```json|```/g, "").trim() : text.trim();

  try {
    const parsed = JSON.parse(stripped) as Partial<SearchIntent>;
    if (!parsed || !parsed.specialtyKey || !parsed.specialty || !parsed.translatedQuery) {
      return null;
    }

    return {
      language: parsed.language ?? "english",
      translatedQuery: parsed.translatedQuery,
      specialty: parsed.specialty,
      specialtyKey: parsed.specialtyKey,
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.slice(0, 6) : [],
      location: parsed.location ?? null,
      city: parsed.city ?? parsed.location ?? null,
      entity: parsed.entity ?? null,
      searchType: parsed.searchType ?? "general",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.75,
    };
  } catch {
    return null;
  }
}

export async function extractSearchIntent(query: string, city?: string): Promise<SearchIntent> {
  const fallback = heuristicIntent(query);

  if (!env.GOOGLE_AI_API_KEY) {
    return fallback;
  }

  try {
    const model = getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });

    const prompt = [
      "Extract healthcare search intent for India.",
      "Return ONLY valid JSON with keys: language, translatedQuery, specialty, specialtyKey, symptoms, location, searchType, confidence.",
      'searchType must be one of: "symptom", "doctor_name", "hospital_name", "treatment", "lab_test", "general".',
      "specialtyKey should be lowercase short key like cardiology, ortho, neurology, maternity, oncology, diagnostic, general.",
      "If query is already English, translatedQuery must equal original intent query cleaned.",
      `User query: ${query}`,
      city ? `User city context: ${city}` : "",
    ].filter(Boolean).join("\n");

    const response = await model.generateContent(prompt);
    const parsed = safeIntentParse(response.response.text());

    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

