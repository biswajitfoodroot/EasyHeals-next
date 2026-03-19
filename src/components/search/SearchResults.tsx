"use client";

import { useState } from "react";

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
};

const starterPrompts = [
  "I have chest pain and shortness of breath",
  "Best orthopaedic hospital in Pune",
  "Mujhe pet dard ho raha hai",
];

export function SearchResults({ intent, results, loading, onPrompt, onContribute }: SearchResultsProps) {
  const [intentConfirmed, setIntentConfirmed] = useState(false);

  const showDidYouMean =
    !intentConfirmed &&
    intent !== null &&
    intent.confidence < 0.5 &&
    results.length > 0;

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
          <h4>Start a conversation</h4>
          <p>Results appear here as you describe what you need.</p>
          <div className={styles.promptStack}>
            {starterPrompts.map((prompt) => (
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

