"use client";

import { useMemo, useState } from "react";

import { IntentBadge } from "@/components/search/IntentBadge";
import { ResultCard } from "@/components/search/ResultCard";
import styles from "@/components/phase1/phase1.module.css";
import type { SearchIntent, SearchResult } from "@/components/phase1/types";

type SearchResultsProps = {
  intent: SearchIntent | null;
  results: SearchResult[];
  loading: boolean;
  onPrompt: (prompt: string) => void;
  onContribute: (result: SearchResult) => void;
  city?: string;
  isLoggedIn?: boolean;
};

// Common health needs by city — top searches in each metro
const CITY_PROMPTS: Record<string, string[]> = {
  // India — major metros
  Mumbai: ["Best cardiologist in Mumbai", "NABH hospital in Mumbai for knee replacement", "Oncology centre in Mumbai"],
  Pune: ["Top orthopaedic hospital in Pune", "Best gynaecologist in Pune", "Diabetologist in Pune"],
  Delhi: ["Neurology specialist Delhi", "Cancer hospital in Delhi", "Best paediatric hospital Delhi"],
  Bengaluru: ["Top cardiac hospital Bangalore", "Fertility clinic in Bangalore", "Best skin specialist Bangalore"],
  Bangalore: ["Top cardiac hospital Bangalore", "Fertility clinic in Bangalore", "Best skin specialist Bangalore"],
  Chennai: ["Best cardiac centre Chennai", "Orthopaedic surgeon Chennai", "Eye hospital in Chennai"],
  Hyderabad: ["Top multi-specialty hospital Hyderabad", "Best neurologist Hyderabad", "Cancer treatment Hyderabad"],
  Kolkata: ["Best hospital in Kolkata", "Heart specialist Kolkata", "Top cancer care Kolkata"],
  Ahmedabad: ["Best hospital in Ahmedabad", "Kidney specialist Ahmedabad", "Cardiac surgeon Ahmedabad"],
  Jaipur: ["Multi-specialty hospital Jaipur", "Best orthopaedic Jaipur", "Oncology in Jaipur"],
  Nagpur: ["Top hospital in Nagpur", "Best doctor Nagpur", "Specialist clinic Nagpur"],
  Kochi: ["Best hospital in Kochi", "Cancer treatment Kochi", "Cardiac specialist Kochi"],
  Indore: ["Top hospital in Indore", "Best orthopaedic Indore", "Neurologist in Indore"],
  Lucknow: ["Best multi-specialty hospital Lucknow", "Top cardiologist Lucknow", "Fertility clinic Lucknow"],
  Visakhapatnam: ["Top hospital in Visakhapatnam", "Cardiac surgeon Vizag", "Cancer care Visakhapatnam"],
  Surat: ["Best hospital in Surat", "Cardiac specialist Surat", "Kidney treatment Surat"],
  // South Asia
  Dhaka: ["Best hospital in Dhaka", "Cardiac specialist Dhaka", "Cancer centre Dhaka"],
  Chittagong: ["Top hospital in Chittagong", "Best cardiologist Chittagong", "Kidney specialist Chittagong"],
  Colombo: ["Best hospital in Colombo", "Cardiac care Colombo", "Cancer hospital Colombo"],
  Kathmandu: ["Top hospital in Kathmandu", "Best orthopaedic Kathmandu", "Cardiac specialist Nepal"],
  Yangon: ["Best hospital in Yangon", "Specialist clinic Myanmar", "Cardiac centre Yangon"],
  Kabul: ["Best hospital in Kabul", "Medical care Afghanistan", "Specialist clinic Kabul"],
  Thimphu: ["Best hospital in Thimphu", "Medical care Bhutan", "Specialist clinic Thimphu"],
  Karachi: ["Best hospital in Karachi", "Cardiac specialist Karachi", "Cancer centre Karachi"],
  Lahore: ["Top hospital in Lahore", "Best cardiologist Lahore", "Oncology clinic Lahore"],
  // Middle East
  Dubai: ["Best hospital in Dubai", "Cardiac specialist Dubai", "Cancer centre Dubai"],
  "Abu Dhabi": ["Top hospital Abu Dhabi", "Best orthopaedic Abu Dhabi", "Oncology UAE"],
  Sharjah: ["Best hospital in Sharjah", "Medical centre Sharjah", "Specialist clinic Sharjah"],
  Muscat: ["Top hospital in Muscat", "Cardiac care Oman", "Cancer treatment Muscat"],
  Salalah: ["Best hospital in Salalah", "Medical care Salalah", "Specialist clinic Oman"],
  Riyadh: ["Best hospital in Riyadh", "Cardiac specialist Riyadh", "Cancer centre Saudi Arabia"],
  Jeddah: ["Top hospital in Jeddah", "Best cardiologist Jeddah", "Oncology clinic Jeddah"],
  "Kuwait City": ["Best hospital in Kuwait", "Cardiac care Kuwait City", "Cancer centre Kuwait"],
  Doha: ["Top hospital in Doha", "Best specialist Qatar", "Cardiac care Doha"],
  Manama: ["Best hospital in Bahrain", "Cardiac specialist Manama", "Cancer treatment Bahrain"],
  // Africa
  Nairobi: ["Best hospital in Nairobi", "Cardiac specialist Kenya", "Cancer centre Nairobi"],
  Lagos: ["Top hospital in Lagos", "Best cardiologist Lagos", "Oncology Nigeria"],
  Johannesburg: ["Best hospital in Johannesburg", "Cardiac care South Africa", "Cancer treatment Joburg"],
  Cairo: ["Top hospital in Cairo", "Cardiac specialist Egypt", "Cancer centre Cairo"],
  "Addis Ababa": ["Best hospital Addis Ababa", "Medical care Ethiopia", "Cardiac specialist Ethiopia"],
};

const DEFAULT_GUEST_PROMPTS = [
  "I have chest pain and shortness of breath",
  "Best orthopaedic hospital near me",
  "Mujhe pet dard ho raha hai",
  "Find a gynaecologist near me",
];

const LOGGED_IN_PROMPTS = [
  "Check my vitals and suggest a specialist",
  "Find a doctor for my next appointment",
  "Best hospital near me based on my condition",
  "I need a follow-up for my chronic condition",
];

export function SearchResults({ intent, results, loading, onPrompt, onContribute, city, isLoggedIn }: SearchResultsProps) {
  const [intentConfirmed, setIntentConfirmed] = useState(false);

  const showDidYouMean =
    !intentConfirmed &&
    intent !== null &&
    intent.confidence < 0.5 &&
    results.length > 0;

  // Build intelligent contextual prompts
  const smartPrompts = useMemo(() => {
    if (isLoggedIn) {
      // Logged-in patient: personalised prompts + city
      const citySpecific = city && CITY_PROMPTS[city] ? CITY_PROMPTS[city].slice(0, 2) : [];
      return [...LOGGED_IN_PROMPTS.slice(0, 2), ...citySpecific].slice(0, 4);
    }
    // Guest: city-specific if detected, else defaults
    if (city && CITY_PROMPTS[city]) {
      return CITY_PROMPTS[city];
    }
    return DEFAULT_GUEST_PROMPTS;
  }, [city, isLoggedIn]);

  const emptyTitle = isLoggedIn
    ? "What would you like to find today?"
    : city
      ? `Finding care near ${city}`
      : "Start a conversation";

  const emptySubtitle = isLoggedIn
    ? "Based on your health profile and location."
    : city
      ? `Tap a suggestion or describe your symptoms to find the best care in ${city}.`
      : "Results appear here as you describe what you need.";

  return (
    <section className={styles.resultsPanel} aria-label="Live search results">
      <div className={styles.resultsHead}>
        <h3>Live Results</h3>
        <span>{results.length}</span>
        <button type="button">Sort ↕</button>
      </div>

      {intent ? <IntentBadge label={intent.specialty} count={results.length} language={intent.language} confidence={intent.confidence} /> : null}

      {showDidYouMean ? (
        <div className={styles.didYouMean}>
          <span>🤔 Did you mean:</span>
          <strong>{intent.specialty}</strong>
          <span className={styles.didYouMeanSub}>({results.length} results found)</span>
          <button type="button" className={styles.didYouMeanBtn} onClick={() => setIntentConfirmed(true)}>
            Yes, show results
          </button>
          <button type="button" className={styles.didYouMeanDismiss} onClick={() => setIntentConfirmed(true)}>
            Show anyway
          </button>
        </div>
      ) : null}

      {!loading && results.length === 0 ? (
        <div className={styles.emptyState}>
          <h4>{emptyTitle}</h4>
          <p>{emptySubtitle}</p>
          <div className={styles.promptStack}>
            {smartPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className={styles.skeletonList}>
          <div />
          <div />
          <div />
        </div>
      ) : null}

      {!loading && results.length && !showDidYouMean ? (
        <div className={styles.resultList}>
          {results.map((item) => (
            <ResultCard key={item.id} result={item} onContribute={onContribute} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
