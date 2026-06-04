"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { ChatSearch } from "@/components/search/ChatSearch";
import { SearchResults } from "@/components/search/SearchResults";
import { ContributeModal } from "@/components/contribute/ContributeModal";
import type { SearchIntent, SearchResponse, SearchResult } from "@/components/phase1/types";
import styles from "@/app/ask/ask.module.css";

export default function AskClient() {
  const searchParams = useSearchParams();

  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [contributeTarget, setContributeTarget] = useState<SearchResult | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [city, setCity] = useState<string | null>(null);

  // Pre-fill query from ?q= URL param
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(
    searchParams.get("q") ?? null,
  );

  // Auth state
  useEffect(() => {
    fetch("/api/v1/patients/me", { credentials: "include" })
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // City from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("eh_city") : null;
    if (saved) setCity(saved);

    function onStorage(e: StorageEvent) {
      if (e.key === "eh_city") setCity(e.newValue ?? null);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleSearch(payload: SearchResponse) {
    setIntent(payload.intent);
    setResults(payload.results);
  }

  function triggerPrompt(prompt: string) {
    setQueuedPrompt(prompt);
  }

  const hasResults = results.length > 0 || loading;

  // Fixed bottom input bar (mobile only)
  const [fixedInput, setFixedInput] = useState("");

  function handleFixedSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = fixedInput.trim();
    if (!q) return;
    setQueuedPrompt(q);
    setFixedInput("");
  }

  return (
    <div className={styles.page}>

      {/* ── Mobile: back link + title strip ── */}
      <div className={styles.mobileHeader}>
        <Link href="/" className={styles.backBtn} aria-label="Back to home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div className={styles.mobileHeaderText}>
          <span className={styles.mobileHeaderTitle}>🤖 AI Health Assistant</span>
          <span className={styles.mobileHeaderSub}>Online · Reply in seconds</span>
        </div>
        <div className={styles.mobileHeaderControls}>
          {/* Language + voice handled inside ChatSearch */}
        </div>
      </div>

      {/* ── Desktop: hero header with green gradient ── */}
      <div className={styles.desktopHero}>
        <div className={styles.desktopHeroInner}>
          <Link href="/" className={styles.desktopBackBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Home
          </Link>
          <span className={styles.desktopAskTitle}>🤖 AI Health Assistant</span>
          <span className={styles.desktopAskOnline}>Online · Powered by Gemini AI</span>
        </div>
      </div>

      {/* ── Chat + Results ── */}
      <div className={styles.layout} data-has-results={hasResults ? "true" : "false"}>

        {/* Chat column */}
        <div className={styles.chatCol}>

          <div className={styles.chatWrap}>
            <ChatSearch
              onSearchResult={handleSearch}
              onLoadingChange={setLoading}
              queuedPrompt={queuedPrompt}
              onQueuedPromptHandled={() => setQueuedPrompt(null)}
              isLoggedIn={isLoggedIn === true}
              lightTheme
            />
          </div>
        </div>

        {/* Results column */}
        <div className={styles.resultsCol}>
          {/* Mobile: results header label */}
          {hasResults && (
            <div className={styles.mobileResultsHeader}>
              {loading ? "Searching…" : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
            </div>
          )}
          <div className={styles.resultsWrap}>
            <SearchResults
              intent={intent}
              results={results}
              loading={loading}
              onPrompt={triggerPrompt}
              onContribute={setContributeTarget}
              city={city ?? undefined}
              isLoggedIn={isLoggedIn === true}
              lightTheme
            />
          </div>
        </div>
      </div>

      <ContributeModal
        isOpen={Boolean(contributeTarget)}
        target={contributeTarget}
        onClose={() => setContributeTarget(null)}
      />

      {/* ── Fixed input bar — mobile only, always reachable ── */}
      <form className={styles.fixedInputBar} onSubmit={handleFixedSubmit} role="search">
        <div className={styles.fixedInputPill}>
          <input
            type="text"
            value={fixedInput}
            onChange={(e) => setFixedInput(e.target.value)}
            placeholder="Ask a follow-up or new question…"
            className={styles.fixedInputField}
            aria-label="Ask a question"
          />
          <span className={styles.fixedInputMic}>🎤</span>
        </div>
        <button
          type="submit"
          className={styles.fixedSendBtn}
          aria-label="Send"
          disabled={loading}
        >
          {loading ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
