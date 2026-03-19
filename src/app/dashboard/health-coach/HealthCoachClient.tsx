"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What do my recent lab results mean?",
  "Are my blood pressure readings normal?",
  "What should I watch out for with my current medications?",
  "How can I improve my HbA1c?",
  "What questions should I ask my doctor?",
];

function formatTime(ts: string) {
  // placeholderId is Date.now().toString() — a numeric ms string, must parse as number
  const d = isNaN(Number(ts)) ? new Date(ts) : new Date(Number(ts));
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HealthCoachClient() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => { void loadConversations(); }, []);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/v1/patients/health-coach/conversations", { credentials: "include" });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.ok) {
        const j = await res.json() as { data: Conversation[] };
        setConversations(j.data);
      }
    } catch { /* non-fatal */ }
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    setInput("");
    const userMessage: Message = { role: "user", content: msg, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setStreaming(true);

    // Placeholder assistant message
    const placeholderId = Date.now().toString();
    setMessages((prev) => [...prev, { role: "assistant", content: "", ts: placeholderId }]);

    try {
      const res = await fetch("/api/v1/patients/health-coach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationId }),
      });

      if (res.status === 503) {
        setMessages((prev) => prev.map((m) =>
          m.ts === placeholderId
            ? { ...m, content: "AI Health Coach is not yet available. Please check back later." }
            : m
        ));
        return;
      }

      if (!res.ok || !res.body) {
        setMessages((prev) => prev.map((m) =>
          m.ts === placeholderId
            ? { ...m, content: "Sorry, I couldn't process your message. Please try again." }
            : m
        ));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.text) {
              fullText += parsed.text;
              setMessages((prev) => prev.map((m) =>
                m.ts === placeholderId ? { ...m, content: fullText } : m
              ));
            }
            if (parsed.error) {
              setMessages((prev) => prev.map((m) =>
                m.ts === placeholderId ? { ...m, content: `Error: ${parsed.error}` } : m
              ));
            }
          } catch { /* malformed chunk */ }
        }
      }

      void loadConversations();
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.ts === placeholderId
          ? { ...m, content: "Network error. Please check your connection and try again." }
          : m
      ));
    } finally {
      setStreaming(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setShowSidebar(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">AI Health Coach</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            History
          </button>
          <button
            onClick={startNewChat}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ background: "#1B8A4A" }}
          >
            + New Chat
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — conversation history */}
        {showSidebar && (
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Chats</p>
            </div>
            <div className="flex-1 p-2 space-y-1">
              {conversations.length === 0 && (
                <p className="text-xs text-slate-400 p-2">No conversations yet.</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setConversationId(c.id); setMessages([]); setShowSidebar(false); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 transition ${c.id === conversationId ? "bg-green-50 text-green-800" : "text-slate-600"}`}
                >
                  <p className="font-medium truncate">{c.title ?? "Conversation"}</p>
                  <p className="text-slate-400 mt-0.5">{formatDate(c.lastMessageAt)}</p>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Welcome state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
                  style={{ background: "#e6f4ed" }}>
                  🤖
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">EasyHeals AI Health Coach</h2>
                <p className="text-sm text-slate-500 mb-6 max-w-sm">
                  Ask me anything about your health. I have access to your extracted health data and can provide personalised guidance.
                </p>

                <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => void sendMessage(p)}
                      className="text-left text-sm px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition text-slate-700"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5"
                    style={{ background: "#e6f4ed" }}>
                    🤖
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                }`}
                  style={m.role === "user" ? { background: "#1B8A4A" } : {}}>
                  {m.content === "" && m.role === "assistant" ? (
                    <div className="flex gap-1 py-1">
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                  <p className={`text-xs mt-1 ${m.role === "user" ? "text-green-200" : "text-slate-400"}`}>
                    {formatTime(m.ts)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="bg-white border-t border-slate-200 p-4 shrink-0">
            <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 focus-within:border-green-300 focus-within:ring-1 focus-within:ring-green-200 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your health... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-800 resize-none outline-none max-h-32 py-1"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={streaming || !input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold disabled:opacity-40 transition"
                style={{ background: "#1B8A4A" }}
              >
                {streaming ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "↑"
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              AI can make mistakes. Always consult a doctor for medical decisions.{" "}
              <Link href="/dashboard/privacy" className="underline">Manage data consent →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
