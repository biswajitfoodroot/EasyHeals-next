/**
 * src/lib/seo-keywords.ts
 *
 * Generate SEO + AI-search keywords for a hospital.
 * These are used in:
 *   - <meta name="keywords"> for Google SEO
 *   - JSON-LD "keywords" field for structured data
 *   - Discoverability in ChatGPT, Gemini, Perplexity AI search (they use descriptions + keywords)
 */

const SPECIALTY_SYNONYMS: Record<string, string[]> = {
  "Cardiology": ["heart", "cardiac", "heart specialist", "heart treatment"],
  "Cardiothoracic Surgery": ["heart surgery", "open heart surgery", "bypass surgery"],
  "Neurology": ["brain", "neuro", "neurologist", "brain specialist", "nervous system"],
  "Neurosurgery": ["brain surgery", "spinal surgery", "neurosurgery"],
  "Orthopaedics": ["bone doctor", "joint replacement", "knee surgery", "hip replacement", "ortho"],
  "Orthopaedics & Joint Replacement": ["joint replacement", "knee replacement", "hip replacement", "bone specialist"],
  "Oncology": ["cancer treatment", "cancer hospital", "chemotherapy"],
  "Gynaecology & Obstetrics": ["gynecology", "women's health", "maternity", "delivery hospital"],
  "Paediatrics": ["child specialist", "children hospital", "paediatric care", "kids doctor"],
  "Pediatrics": ["child specialist", "children hospital", "pediatric care", "kids doctor"],
  "ENT (Ear, Nose & Throat)": ["ENT specialist", "ear nose throat", "ENT doctor"],
  "Gastroenterology": ["stomach specialist", "digestive health", "liver specialist"],
  "Nephrology": ["kidney specialist", "kidney treatment"],
  "Urology": ["urologist", "kidney stones", "prostate"],
  "Ophthalmology": ["eye hospital", "eye specialist", "cataract surgery"],
  "Dermatology": ["skin specialist", "skin hospital"],
  "Psychiatry": ["mental health", "psychiatrist"],
  "Pulmonology": ["lung specialist", "chest specialist", "respiratory"],
  "Endocrinology": ["diabetes specialist", "thyroid specialist"],
  "Rheumatology": ["arthritis specialist", "joint pain"],
  "Radiology": ["X-ray", "MRI", "CT scan", "imaging"],
  "Pathology": ["lab test", "blood test", "diagnostic lab"],
  "Dentistry": ["dental", "teeth", "dental hospital"],
  "General Medicine & Internal Medicine": ["general physician", "GP", "internal medicine"],
  "General Surgery": ["surgery hospital", "surgical care"],
  "Emergency Medicine": ["emergency care", "casualty", "trauma"],
  "Haematology": ["blood disorder", "haematology"],
  "Hepatology": ["liver specialist", "liver treatment"],
  "Plastic Surgery": ["cosmetic surgery", "reconstructive surgery"],
};

export function generateHospitalSeoKeywords(hospital: {
  name: string;
  city: string;
  state?: string | null;
  specialties?: string[] | null;
  facilities?: string[] | null;
  description?: string | null;
  type?: string;
}): string[] {
  const keywords = new Set<string>();
  const city = hospital.city;
  const state = hospital.state ?? "";
  const name = hospital.name;

  // ── Core hospital identity keywords ────────────────────────────────────────
  keywords.add(name);
  keywords.add(`${name} ${city}`);
  keywords.add(`${name} ${city} ${state}`.trim());
  keywords.add(`hospital in ${city}`);
  keywords.add(`best hospital in ${city}`);
  keywords.add(`private hospital ${city}`);
  keywords.add(`multispecialty hospital ${city}`);
  keywords.add(`hospital near me ${city}`);

  // AI search / conversational queries
  keywords.add(`best hospital in ${city} ${state}`.trim());
  keywords.add(`top rated hospital ${city}`);
  keywords.add(`book appointment ${name}`);
  keywords.add(`${name} doctors`);
  keywords.add(`${name} contact number`);
  keywords.add(`${name} address`);

  // ── Specialty-based keywords ────────────────────────────────────────────────
  const specs = hospital.specialties ?? [];
  for (const spec of specs) {
    // Direct: "Cardiology hospital Siliguri"
    keywords.add(`${spec} hospital ${city}`);
    keywords.add(`${spec} specialist ${city}`);
    keywords.add(`best ${spec} hospital ${city}`);

    // Synonyms
    const synonyms = SPECIALTY_SYNONYMS[spec] ?? [];
    for (const syn of synonyms) {
      keywords.add(`${syn} ${city}`);
      keywords.add(`${syn} hospital ${city}`);
      keywords.add(`best ${syn} ${city}`);
    }
  }

  // ── Facilities-based keywords ───────────────────────────────────────────────
  const facilities = hospital.facilities ?? [];
  for (const facility of facilities.slice(0, 15)) {
    keywords.add(`${facility} ${city}`);
  }

  // ── AI search optimization phrases ─────────────────────────────────────────
  // These match the kind of questions ChatGPT/Gemini answer
  if (specs.length > 0) {
    keywords.add(`which hospital is best for ${specs[0]} in ${city}`);
    keywords.add(`${specs[0]} treatment in ${city}`);
  }

  // Remove empty strings and limit to 50
  return [...keywords].filter(k => k.trim().length > 2).slice(0, 50);
}
