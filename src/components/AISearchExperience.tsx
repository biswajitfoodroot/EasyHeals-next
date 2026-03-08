"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type SearchMode = "all" | "treatment" | "hospital" | "doctor" | "symptom" | "specialty";

type SearchResponse = {
  response: {
    answer: string;
    suggestions: string[];
    highlights: string[];
  };
  hospitals: Array<{ id: string; name: string; slug: string; city: string; state: string | null }>;
  taxonomy: Array<{ id: string; title: string; slug: string; type: string }>;
  model: string;
};

type Message = {
  role: "user" | "assistant";
  text: string;
  payload?: SearchResponse;
};

const starterPrompts = [
  "Best cardiology hospitals in Pune",
  "Affordable MRI scan options",
  "Knee replacement specialist",
  "Symptoms: persistent dry cough",
];

export default function AISearchExperience() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Pune");
  const [mode, setMode] = useState<SearchMode>("all");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi, I am EasyHeals AI Search. Ask for treatment, doctors, hospitals, or symptom guidance.",
    },
  ]);

  async function runSearch(searchText: string) {
    const trimmed = searchText.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuery("");
    setLoading(true);

    const res = await fetch("/api/search/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed, city, mode }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok || !body?.data) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I could not process that query. Please try again with a clearer treatment, specialty, or city.",
        },
      ]);
      return;
    }

    const data: SearchResponse = body.data;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: data.response.answer,
        payload: data,
      },
    ]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <section className="search-shell" aria-label="AI search console">
      <div className="search-head">
        <p className="eyebrow">AI Search</p>
        <h2>Gemini-powered discovery that feels like chat.</h2>
        <p>
          Search mode, city context, and intelligent follow-up suggestions in one interactive panel.
        </p>
      </div>

      <div className="search-controls">
        <select value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
          <option value="all">All</option>
          <option value="treatment">Treatment</option>
          <option value="hospital">Hospital</option>
          <option value="doctor">Doctor</option>
          <option value="specialty">Specialty</option>
          <option value="symptom">Symptom</option>
        </select>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          aria-label="City"
        />
      </div>

      <div className="chat-window">
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            <p>{message.text}</p>
            {message.payload ? (
              <div className="payload-grid">
                {message.payload.response.highlights.length ? (
                  <div className="payload-block">
                    <h3>Highlights</h3>
                    <ul>
                      {message.payload.response.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {message.payload.hospitals.length ? (
                  <div className="payload-block">
                    <h3>Hospitals</h3>
                    <ul>
                      {message.payload.hospitals.map((item) => (
                        <li key={item.id}>
                          <Link href={`/hospitals/${item.slug}`}>
                            {item.name} ({item.city})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {message.payload.taxonomy.length ? (
                  <div className="payload-block">
                    <h3>Related</h3>
                    <div className="mini-chips">
                      {message.payload.taxonomy.slice(0, 8).map((item) => (
                        <span key={item.id}>
                          {item.title} · {item.type}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <small className="model-note">Model: {message.payload.model}</small>
              </div>
            ) : null}
          </article>
        ))}

        {loading ? (
          <div className="typing" role="status" aria-live="polite">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>

      <div className="prompt-row">
        {starterPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => void runSearch(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="search-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything: treatment, hospital, symptom..."
          aria-label="Search query"
          required
        />
        <button disabled={loading} type="submit">
          {loading ? "Searching..." : "Ask AI"}
        </button>
      </form>
    </section>
  );
}
