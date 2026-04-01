"use client";

// Web Speech API — declare interfaces for cross-browser support
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognitionResult { readonly [index: number]: SpeechRecognitionAlternative; readonly length: number; }
interface SpeechRecognitionResultList { readonly [index: number]: SpeechRecognitionResult; readonly length: number; }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

/**
 * CoachTab — AI Health Coach Chat Interface
 *
 * Full-screen mobile chat UI with:
 * - SSE streaming responses from /api/v1/patients/health-coach
 * - Context chips (quick prompts based on recent health context)
 * - Conversation history (last session)
 * - Voice input button (Web Speech API)
 * - Thumbs up/down feedback on responses
 * - Language toggle (EN / HI)
 *
 * The AI is grounded in the patient's health memory (RAG).
 */

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  role: "user" | "model";
  content: string;
  ts: string;
  streaming?: boolean;
  turnIndex?: number;  // index of this model turn (for feedback)
}

const CONTEXT_CHIPS = [
  "Explain my last lab report",
  "What should I know about my condition?",
  "Tips to manage my medications",
  "When should I see a doctor?",
  "How can I improve my health?",
];

export function CoachTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Voice input (Web Speech API)
  function toggleVoice() {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {  // eslint-disable-line no-undef
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput((prev) => prev ? prev + " " + transcript : transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }

  async function send(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    // Turn index = number of model messages so far (0-based)
    const currentTurnIndex = messages.filter((m) => m.role === "model").length;

    const userMsg: ChatMessage = { role: "user", content: text, ts: new Date().toISOString() };
    const streamingMsg: ChatMessage = { role: "model", content: "", ts: new Date().toISOString(), streaming: true, turnIndex: currentTurnIndex };

    setMessages((prev) => [...prev, userMsg, streamingMsg]);

    try {
      const res = await fetch("/api/v1/patients/health-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) {
        const d = await res.json();
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setError(d.error ?? "AI unavailable. Try again.");
        setSending(false);
        return;
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string; conversationId?: string };
            if (parsed.error) { setError(parsed.error); break; }
            if (parsed.conversationId) setConversationId(parsed.conversationId);
            if (parsed.text) {
              fullText += parsed.text;
              setMessages((prev) =>
                prev.map((m) => m.streaming ? { ...m, content: fullText } : m)
              );
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      // Finalize streaming message
      setMessages((prev) =>
        prev.map((m) => m.streaming ? { ...m, content: fullText, streaming: false } : m)
      );
    } catch {
      setMessages((prev) => prev.filter((m) => !m.streaming));
      setError("Network error. Check your connection.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const hasSpeechRecognition = typeof window !== "undefined" &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 160px)", minHeight: 400 }}>
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", overscrollBehavior: "contain" }}>
        {messages.length === 0 && !sending && (
          <div style={{ padding: "24px 0" }}>
            {/* Welcome */}
            <div style={{
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              color: "#fff",
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>👋</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Hi, I&apos;m your Health Coach</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Ask me anything about your health. I have access to your health history and can give you personalized guidance.
              </div>
            </div>

            {/* Context chips */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Quick questions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CONTEXT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    textAlign: "left",
                    fontSize: 13,
                    color: "#374151",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} conversationId={conversationId} />
        ))}

        {error && (
          <div style={{ padding: "8px 14px", background: "#fef2f2", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid #f1f5f9",
        background: "#fff",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
          placeholder="Ask about your health..."
          rows={1}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 14,
            resize: "none",
            outline: "none",
            maxHeight: 100,
            overflowY: "auto",
            lineHeight: 1.4,
            color: "#0f172a",
          }}
        />

        {/* Voice input */}
        {hasSpeechRecognition && (
          <button
            onClick={toggleVoice}
            aria-label="Voice input"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1.5px solid",
              borderColor: isListening ? "#ef4444" : "#e2e8f0",
              background: isListening ? "#fef2f2" : "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 18,
            }}
          >
            {isListening ? "🔴" : "🎤"}
          </button>
        )}

        {/* Send */}
        <button
          onClick={() => void send()}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: (!input.trim() || sending) ? "#e2e8f0" : "#0f766e",
            color: (!input.trim() || sending) ? "#94a3b8" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: (!input.trim() || sending) ? "not-allowed" : "pointer",
            flexShrink: 0,
            fontSize: 18,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message, conversationId }: { message: ChatMessage; conversationId: string | null }) {
  const isUser = message.role === "user";
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function submitFeedback(rating: "up" | "down") {
    if (feedback || message.streaming || message.turnIndex === undefined || !conversationId) return;
    setFeedback(rating);
    await fetch("/api/v1/patients/health-coach/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversationId, turnIndex: message.turnIndex, rating }),
    }).catch(() => null);
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 10,
    }}>
      {!isUser && (
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          marginRight: 8,
          flexShrink: 0,
          alignSelf: "flex-end",
        }}>
          🤖
        </div>
      )}
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
          background: isUser ? "#0f766e" : "#f8fafc",
          color: isUser ? "#fff" : "#0f172a",
          fontSize: 14,
          lineHeight: 1.5,
          border: isUser ? "none" : "1px solid #f1f5f9",
        }}>
          {message.streaming ? (
            <span>
              {message.content}
              <span style={{ animation: "blink 1s infinite", marginLeft: 2, opacity: 0.5 }}>▌</span>
            </span>
          ) : (
            <FormattedText text={message.content} />
          )}
        </div>

        {/* Thumbs feedback — only on completed model messages */}
        {!isUser && !message.streaming && message.turnIndex !== undefined && conversationId && (
          <div style={{ display: "flex", gap: 4, paddingLeft: 2 }}>
            <button
              onClick={() => void submitFeedback("up")}
              title="Helpful"
              style={{
                background: "none", border: "none", cursor: feedback ? "default" : "pointer",
                fontSize: 14, opacity: feedback === "up" ? 1 : feedback === "down" ? 0.3 : 0.5,
                padding: "2px 4px",
              }}
            >
              👍
            </button>
            <button
              onClick={() => void submitFeedback("down")}
              title="Not helpful"
              style={{
                background: "none", border: "none", cursor: feedback ? "default" : "pointer",
                fontSize: 14, opacity: feedback === "down" ? 1 : feedback === "up" ? 0.3 : 0.5,
                padding: "2px 4px",
              }}
            >
              👎
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  // Simple markdown-like formatting: bold **text**, bullet points
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith("• ") || line.startsWith("- ")) {
          return <div key={i} style={{ paddingLeft: 12, marginBottom: 2 }}>• {line.slice(2)}</div>;
        }
        // Bold **text**
        const parts = line.split(/\*\*(.*?)\*\*/);
        return (
          <div key={i} style={{ marginBottom: i < lines.length - 1 ? 4 : 0 }}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
            )}
          </div>
        );
      })}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
