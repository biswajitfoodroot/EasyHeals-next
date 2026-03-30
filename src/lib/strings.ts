/**
 * Normalize a raw city string from AI/DB to a clean city name.
 *
 * Handles:
 *   "Baner, Pune"                  → "Pune"
 *   "Fatima Nagar, Wanowrie, Pune" → "Pune"
 *   "Pune Camp"                    → "Pune"
 *   "411001"  (pincode only)       → "Unknown"
 *   "Maharashtra" (state name)     → "Unknown"
 *   "Bengaluru"                    → "Bengaluru" (unchanged)
 */
const INDIAN_STATES = new Set([
  "andaman & nicobar islands", "andaman and nicobar islands",
  "andaman & nicobar", "andaman and nicobar",
  "andhra pradesh", "arunachal pradesh", "assam", "bihar",
  "chhattisgarh", "goa", "gujarat", "haryana",
  "himachal pradesh", "jharkhand", "karnataka", "kerala",
  "ladakh", "lakshadweep", "madhya pradesh", "maharashtra",
  "manipur", "meghalaya", "mizoram", "nagaland",
  "odisha", "orissa", "puducherry", "pondicherry",
  "punjab", "rajasthan", "sikkim", "tamil nadu",
  "telangana", "tripura", "uttar pradesh", "uttarakhand",
  "west bengal", "india", "unknown",
]);

export function normalizeCityName(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  let city = raw.trim();

  // 1. Pure 6-digit pincode
  if (/^\d{6}$/.test(city)) return "Unknown";

  // 2. Comma-separated — walk segments from right, skip state names and pincodes
  //    "Nashik, Maharashtra"           → "Nashik"
  //    "Parab Nagar, Nashik, Maha..."  → "Nashik"
  //    "Baner, Pune"                   → "Pune"
  if (city.includes(",")) {
    const segments = city.split(",").map((s) => s.trim()).reverse();
    city = "Unknown";
    for (const seg of segments) {
      const clean = seg.replace(/\s+\d{6}$/, "").trim(); // strip trailing pincode
      if (!clean || /^\d{6}$/.test(clean)) continue;
      if (INDIAN_STATES.has(clean.toLowerCase())) continue;
      city = clean;
      break;
    }
  }

  // 3. Strip trailing pincode e.g. "Pune 411001"
  city = city.replace(/\s+\d{6}$/, "").trim();

  // 4. State names that appear alone
  if (INDIAN_STATES.has(city.toLowerCase())) return "Unknown";

  // 5. Strip locality suffixes
  city = city
    .replace(/\s+Camp$/i, "")
    .replace(/\s+Cantonment$/i, "")
    .replace(/\s+Cantt\.?$/i, "");

  return city.trim() || "Unknown";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}


/** Strip common markdown formatting to plain text for display */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/^#{1,6}\s+/gm, "")        // # headings
    .replace(/^\s*[-*+]\s+/gm, "")      // bullet points
    .replace(/^\s*\d+\.\s+/gm, "")      // numbered lists
    .replace(/`(.+?)`/g, "$1")          // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [links](url)
    .replace(/\n{3,}/g, "\n\n")         // excess newlines
    .trim();
}
