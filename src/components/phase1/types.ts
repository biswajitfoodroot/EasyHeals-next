export type SearchIntent = {
  language: string;
  translatedQuery: string;
  specialty: string;
  specialtyKey: string;
  symptoms: string[];
  location: string | null;
  searchType: "symptom" | "doctor_name" | "hospital_name" | "treatment" | "lab_test" | "general";
  confidence: number;
};

export type SearchResult = {
  id: string;
  type: "hospital" | "doctor";
  name: string;
  slug: string;
  city: string;
  state: string | null;
  rating: number;
  verified: boolean;
  communityVerified: boolean;
  specialties: string[];
  source: string;
  score: number;
  description: string | null;
  profileUrl: string;
  phone: string | null;
};

export type SearchAssistant = {
  answer: string;
  followUps: string[];
  clarifyQuestion: string | null;
  confidenceHint: string;
};

export type SearchMeta = {
  model: string;
  degraded: boolean;
  usedHistory: boolean;
  latencyMs: number;
};

export type SearchResponse = {
  intent: SearchIntent;
  assistant: SearchAssistant;
  meta: SearchMeta;
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
};

export type SmartListing = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  rating: string;
  reviews: string;
  kind: "hospital" | "doctor" | "lab";
};
