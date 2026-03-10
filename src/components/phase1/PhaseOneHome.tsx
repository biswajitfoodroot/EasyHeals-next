"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ContributeModal } from "@/components/contribute/ContributeModal";
import { categories, smartBrowseData } from "@/components/phase1/data";
import styles from "@/components/phase1/phase1.module.css";
import { RegistrationModal } from "@/components/registration/RegistrationModal";
import { ChatSearch } from "@/components/search/ChatSearch";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchIntent, SearchResponse, SearchResult } from "@/components/phase1/types";
import { easyHealsPublicData } from "@/data/easyhealsPublicData";

const symptomAreas = [
  {
    key: "head",
    label: "Head and Brain",
    specialist: "Neurology",
    description: "Headache, seizure, memory issues, dizziness, stroke signs.",
  },
  {
    key: "heart",
    label: "Chest and Heart",
    specialist: "Cardiology",
    description: "Chest pain, palpitations, breathlessness, blood pressure concerns.",
  },
  {
    key: "joints",
    label: "Joints and Bones",
    specialist: "Orthopaedics",
    description: "Joint pain, fractures, back pain, sports injury, spine issues.",
  },
  {
    key: "abdomen",
    label: "Abdomen",
    specialist: "Gastroenterology",
    description: "Acidity, stomach pain, liver, digestion and bowel concerns.",
  },
];

function smartListingAsSearchResult(item: {
  id: string;
  name: string;
  location: string;
  tags: string[];
  rating: string;
}): SearchResult {
  const [city] = item.location.split(",").slice(-1);

  return {
    id: item.id,
    type: item.name.toLowerCase().includes("dr") ? "doctor" : "hospital",
    name: item.name,
    slug: item.id,
    city: (city ?? item.location).trim(),
    state: null,
    rating: Number(item.rating) || 0,
    verified: true,
    communityVerified: true,
    specialties: item.tags,
    source: "seed",
    score: Number(item.rating) || 0,
    description: null,
    profileUrl: item.name.toLowerCase().includes("dr") ? `/doctors/${item.id}` : `/hospitals/${item.id}`,
    phone: null,
  };
}

export default function PhaseOneHome() {
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [contributeTarget, setContributeTarget] = useState<SearchResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["key"]>("hospital");
  const [activeSymptomArea, setActiveSymptomArea] = useState(symptomAreas[0]);

  const smartCards = useMemo(
    () => smartBrowseData[activeCategory] ?? smartBrowseData.hospital,
    [activeCategory],
  );

  function handleSearch(payload: SearchResponse) {
    setIntent(payload.intent);
    setResults(payload.results);
  }

  function triggerPrompt(prompt: string) {
    setQueuedPrompt(prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusChat() {
    document.getElementById("eh-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.brand}>
            <span>E</span>
            <strong>
              Easy<b>Heals</b>
            </strong>
          </Link>

          <button type="button" className={styles.navPill} onClick={focusChat}>
            <i>?</i>
            <span>Ask anything - chest pain, knee surgeon, MRI near me...</span>
            <small>AI</small>
          </button>

          <nav className={styles.topNavLinks}>
            <Link href="/treatments">Treatments</Link>
            <Link href="/symptoms">Symptoms</Link>
            <Link href="/hospitals">Hospitals</Link>
            <Link href="/doctors">Doctors</Link>
          </nav>

          <button type="button" className={styles.navCta} onClick={() => setRegistrationOpen(true)}>
            List Hospital Free
          </button>
        </div>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroOrbs} aria-hidden="true">
          <div className={`${styles.orb} ${styles.orbOne}`} />
          <div className={`${styles.orb} ${styles.orbTwo}`} />
          <div className={`${styles.orb} ${styles.orbThree}`} />
        </div>
        <div className={styles.heroGrid} aria-hidden="true" />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.heroLabel}>AI-Powered Healthcare Search</span>
            <h1>
              Tell us what
              <br />
              you need. We will
              <br />
              find the <em>right care</em>.
            </h1>
            <p>
              Describe symptoms in Hindi, Tamil, Marathi or English. Our AI maps your needs to
              the best doctors and hospitals instantly.
            </p>

            <div id="eh-chat">
              <ChatSearch
                onSearchResult={handleSearch}
                onLoadingChange={setLoading}
                queuedPrompt={queuedPrompt}
                onQueuedPromptHandled={() => setQueuedPrompt(null)}
              />
            </div>

            <div className={styles.heroStats}>
              <article>
                <strong>12k+</strong>
                <span>Hospitals</span>
              </article>
              <article>
                <strong>50+</strong>
                <span>Cities</span>
              </article>
              <article>
                <strong>9 lang</strong>
                <span>Languages</span>
              </article>
              <article>
                <strong>4.8?</strong>
                <span>Patient Rating</span>
              </article>
            </div>
          </div>

          <div className={styles.heroRight}>
            <SearchResults
              intent={intent}
              results={results}
              loading={loading}
              onPrompt={triggerPrompt}
              onContribute={setContributeTarget}
            />

            <div className={styles.trustRow}>
              <span>HIPAA Compliant</span>
              <span>Verified Listings</span>
              <span>Free to Use</span>
              <span>9 Languages</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.quickSection}>
        <div className={styles.sectionHeader}>
          <span>RC#4 Pan India Private Coverage</span>
          <h2>What are you looking for?</h2>
          <p>Government hospitals are excluded by rule in this phase.</p>
        </div>
        <div className={styles.quickGrid}>
          <Link href="/hospitals">Hospitals</Link>
          <Link href="/doctors">Doctors</Link>
          <Link href="/hospitals">Lab Tests</Link>
          <Link href="/treatments">Treatments</Link>
          <Link href="/symptoms">Symptoms</Link>
          <button type="button" onClick={() => setRegistrationOpen(true)}>
            List Hospital (Free)
          </button>
        </div>
      </section>

      <section className={styles.smartSection}>
        <div className={styles.sectionHeader}>
          <span>RC#3 Crowd Listings + AI Outlier Detection</span>
          <h2>Top rated near you</h2>
          <p>Community updates are scored before approval.</p>
        </div>

        <div className={styles.smartLayout}>
          <aside className={styles.smartNav}>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                className={activeCategory === category.key ? styles.smartNavActive : ""}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </aside>

          <div className={styles.smartCards}>
            {smartCards.map((card) => (
              <article key={card.id}>
                <h3>{card.name}</h3>
                <p>{card.location}</p>
                <div className={styles.tagRow}>
                  {card.tags.map((tag) => (
                    <span key={`${card.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
                <div className={styles.smartFoot}>
                  <span>
                    {card.rating} ({card.reviews})
                  </span>
                  <button type="button" onClick={() => setContributeTarget(smartListingAsSearchResult(card))}>
                    Suggest Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.symptomSection}>
        <div className={styles.sectionHeader}>
          <span>RC#1 Symptom to Specialist Mapping</span>
          <h2>Not sure which specialist you need?</h2>
          <p>Select body area and get suggested specialty instantly.</p>
        </div>

        <div className={styles.symptomLayout}>
          <div className={styles.areaButtons}>
            {symptomAreas.map((area) => (
              <button
                key={area.key}
                type="button"
                className={activeSymptomArea.key === area.key ? styles.areaActive : ""}
                onClick={() => setActiveSymptomArea(area)}
              >
                {area.label}
              </button>
            ))}
          </div>
          <article className={styles.symptomPanel}>
            <h3>{activeSymptomArea.specialist}</h3>
            <p>{activeSymptomArea.description}</p>
            <button type="button" onClick={() => triggerPrompt(`Need ${activeSymptomArea.specialist} specialist`)}>
              Find {activeSymptomArea.specialist}
            </button>
          </article>
        </div>
      </section>

      <section className={styles.registerSection}>
        <div>
          <span>RC#6 Self Registration</span>
          <h2>List your hospital. It is free.</h2>
          <p>
            OTP verified onboarding, free basic tier, and activation in minutes. Zero manual admin
            dependency.
          </p>
        </div>
        <button type="button" onClick={() => setRegistrationOpen(true)}>
          Start Registration
        </button>
      </section>

      <footer className={styles.footer}>
        <strong>EasyHeals Technologies Pvt. Ltd.</strong>
        <p>
          {easyHealsPublicData.contact.phone} - {easyHealsPublicData.contact.email} - {easyHealsPublicData.contact.address}
        </p>
      </footer>

      <RegistrationModal isOpen={registrationOpen} onClose={() => setRegistrationOpen(false)} />
      <ContributeModal
        isOpen={Boolean(contributeTarget)}
        target={contributeTarget}
        onClose={() => setContributeTarget(null)}
      />
    </main>
  );
}


