"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { quickPrompts } from "@/components/phase1/data";
import styles from "@/components/phase1/phase1.module.css";
import type { SearchResponse } from "@/components/phase1/types";

type Message = {
  role: "assistant" | "user";
  text: string;
};

type ChatSearchProps = {
  onSearchResult: (payload: SearchResponse) => void;
  onLoadingChange: (loading: boolean) => void;
  queuedPrompt?: string | null;
  onQueuedPromptHandled?: () => void;
};

const modes = [
  { key: "chat", label: "AI Chat" },
  { key: "symptom", label: "Symptoms" },
  { key: "name", label: "Name Search" },
] as const;

const languages = ["English", "Hindi", "Marathi", "Tamil", "Telugu"];

const defaultAssistantMessage: Message = {
  role: "assistant",
  text: "Hello! I am your EasyHeals AI. Tell me your symptoms or ask for a hospital/doctor in your language.",
};

export function ChatSearch({
  onSearchResult,
  onLoadingChange,
  queuedPrompt,
  onQueuedPromptHandled,
}: ChatSearchProps) {
  const [messages, setMessages] = useState<Message[]>([defaultAssistantMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]["key"]>("chat");
  const [langIndex, setLangIndex] = useState(0);
  const [followUps, setFollowUps] = useState<string[]>(quickPrompts);
  const [clarifyQuestion, setClarifyQuestion] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("Gemini AI · Multilingual");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const languageLabel = useMemo(() => languages[langIndex], [langIndex]);

  async function runQuery(text: string) {
    const query = text.trim();
    if (!query || loading) return;

    const outgoingMessage: Message = { role: "user", text: query };
    const nextMessages = [...messages, outgoingMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    onLoadingChange(true);

    try {
      const history = nextMessages.slice(-8).map((message) => ({
        role: message.role,
        text: message.text,
      }));

      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      });

      const body = (await response.json()) as SearchResponse | { error?: string };
      if (!response.ok || !("results" in body)) {
        throw new Error("Search failed");
      }

      onSearchResult(body);

      const assistantLines = [body.assistant.answer];
      if (body.assistant.clarifyQuestion) {
        assistantLines.push(body.assistant.clarifyQuestion);
      }

      setMessages((prev) => [...prev, { role: "assistant", text: assistantLines.join(" ") }]);
      setFollowUps(body.assistant.followUps.length ? body.assistant.followUps : quickPrompts);
      setClarifyQuestion(body.assistant.clarifyQuestion);
      setModelLabel(
        body.meta.degraded
          ? `Fallback mode · ${body.meta.latencyMs}ms`
          : `${body.meta.model} · ${body.meta.latencyMs}ms`,
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I could not complete this search right now. Please retry with symptom plus city.",
        },
      ]);
      setModelLabel("Search unavailable · retry");
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  }

  useEffect(() => {
    if (!queuedPrompt) return;
    void runQuery(queuedPrompt);
    onQueuedPromptHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedPrompt]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runQuery(input);
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR =
      (typeof window !== "undefined" &&
        ((window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) ||
      null;

    if (!SR) {
      setModelLabel("Voice input not supported in this browser");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";

    rec.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      void runQuery(transcript);
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    rec.start();
    recognitionRef.current = rec as { stop: () => void };
    setListening(true);
  }

  return (
    <section className={styles.chatCard}>
      <div className={styles.chatTabs} role="tablist" aria-label="Search mode">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            role="tab"
            aria-selected={activeMode === mode.key}
            className={activeMode === mode.key ? styles.tabActive : ""}
            onClick={() => setActiveMode(mode.key)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className={styles.chatWindow}>
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : ""}`}
          >
            <span className={styles.messageAvatar}>{message.role === "assistant" ? "✦" : "U"}</span>
            <p>{message.text}</p>
          </article>
        ))}

        {loading ? (
          <div className={styles.loadingDots}>
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>

      {clarifyQuestion ? <p className={styles.clarifyText}>Need detail: {clarifyQuestion}</p> : null}

      <div className={styles.quickPromptRow}>
        {followUps.map((prompt) => (
          <button key={prompt} type="button" onClick={() => void runQuery(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className={styles.chatInputRow} onSubmit={onSubmit}>
        <textarea
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type symptoms, doctor name, or ask anything..."
          required
        />
        <button
          type="button"
          className={`${styles.voiceMicBtn} ${listening ? styles.voiceActive : ""}`}
          onClick={toggleVoice}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          title={listening ? "Listening… click to stop" : "Voice input"}
        >
          {listening ? "🔴" : "🎤"}
        </button>
        <button type="button" onClick={() => setLangIndex((prev) => (prev + 1) % languages.length)}>
          {languageLabel}
        </button>
        <button type="submit" disabled={loading}>
          {loading ? "..." : "➤"}
        </button>
      </form>

      <p className={styles.modelText}>Powered by {modelLabel}</p>
    </section>
  );
}
