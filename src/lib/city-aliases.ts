/**
 * Maps picker city display names → all possible DB city value spellings.
 * Used to build LIKE queries that match regardless of historical spelling variants.
 */
const CITY_DB_ALIASES: Record<string, string[]> = {
  "Bengaluru":      ["Bengaluru", "Bangalore", "Bangaluru"],
  "Delhi":          ["Delhi", "New Delhi","Dilli"],
  "Mumbai":         ["Mumbai", "Bombay", "Navi Mumbai"],
  "Chennai":        ["Chennai", "Madras"],
  "Kolkata":        ["Kolkata", "Calcutta"],
  "Kochi":          ["Kochi", "Cochin", "Ernakulam"],
  "Hyderabad":      ["Hyderabad", "Secunderabad"],
  "Visakhapatnam":  ["Visakhapatnam", "Vizag", "Vishakhapatnam"],
  "Pune":           ["Pune", "Poona"],
  "Ahmedabad":      ["Ahmedabad", "Amdavad","Karnavati"],
  "Jaipur":         ["Jaipur"],
  "Nagpur":         ["Nagpur"],
  "Indore":         ["Indore"],
  "Lucknow":        ["Lucknow","Lucknow City"],
  "Surat":          ["Surat"],
  "Bhopal":         ["Bhopal"],
};

/** Returns all DB city name variants for a given picker city name. */
export function getCitySearchTerms(city: string): string[] {
  return CITY_DB_ALIASES[city] ?? [city];
}

/** Normalize a picker city name to its canonical DB form for equality checks. */
export function canonicalCity(city: string): string {
  const aliases = CITY_DB_ALIASES[city];
  return aliases ? aliases[0] : city;
}
