"use client";

/**
 * HealthAssistant — Adaptive mobile-first health chat UI
 *
 * Flow:
 *   Entry (4 cards) → Symptom picker → Guided Q&A → Summary card → CTA
 *   → "Get callback": conversational lead capture → Confirmation
 *   → "Find specialist": AI chat via /api/search
 *   → "WhatsApp": opens WhatsApp with pre-filled message
 *
 * Typing in the input at any point switches to free-form AI chat mode.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SYMPTOM_FLOWS,
  CITIES,
  CALL_TIMES,
  WHATSAPP_NUMBER,
  type SymptomFlow,
} from "@/data/symptom-flows";

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode =
  | "entry"
  | "symptom_picker"
  | "flowing"
  | "ai_chat"
  | "summary"
  | "lead_name"
  | "lead_phone"
  | "lead_city"
  | "lead_time"
  | "confirmed";

type SummaryCard = {
  causes: string[];
  specialist: string;
  urgencyNote: string;
};

type Msg = {
  id: string;
  role: "bot" | "user";
  text: string;
  options?: string[];
  card?: SummaryCard;      // summary card rendered below this bubble
  confirmed?: boolean;     // success bubble styling
};

type Lead = {
  name?: string;
  phone?: string;
  city?: string;
  time?: string;
  symptom?: string;
  specialist?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

let _id = 0;
function uid() { return `m${++_id}`; }

// ─── Component ─────────────────────────────────────────────────────────────

export default function HealthAssistant({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("entry");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [currentFlow, setCurrentFlow] = useState<SymptomFlow | null>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [lead, setLead] = useState<Lead>({});
  const [busy, setBusy] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // auto-scroll on every change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── Message helpers ───────────────────────────────────────────────────────

  function pushUser(text: string) {
    setMessages(p => [...p, { id: uid(), role: "user", text }]);
  }

  function pushBot(partial: Omit<Msg, "id" | "role">, delay = 650) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(p => [...p, { ...partial, id: uid(), role: "bot" }]);
    }, delay);
  }

  // ── Progress for flowing mode ─────────────────────────────────────────────

  const totalSteps = currentFlow?.questions.length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((flowStep / totalSteps) * 100) : 0;

  // ── Entry category tap ────────────────────────────────────────────────────

  const handleCategory = useCallback((cat: string) => {
    if (cat === "symptoms") {
      pushUser("I have symptoms 🤒");
      setMode("symptom_picker");
      pushBot({
        text: "What's your main symptom?",
        options: [...SYMPTOM_FLOWS.map(s => `${s.icon} ${s.label}`), "✏️ Other / describe"],
      });
    } else if (cat === "doctor") {
      pushUser("Find a doctor 👨‍⚕️");
      setMode("ai_chat");
      pushBot({ text: "Which specialty or doctor name are you looking for?" });
    } else if (cat === "hospital") {
      pushUser("Find a hospital 🏥");
      setMode("ai_chat");
      pushBot({ text: "Which city and type of hospital? (e.g. \"cardiology hospital in Pune\")" });
    } else {
      pushUser("Understand my report 📋");
      setMode("ai_chat");
      pushBot({ text: "Which report or test result would you like explained? (e.g. \"HbA1c is 7.2\", \"ECG shows ST changes\")" });
    }
  }, []);

  // ── Symptom selection ─────────────────────────────────────────────────────

  const handleSymptomPick = useCallback((option: string) => {
    pushUser(option);
    // strip leading emoji + space
    const cleanLabel = option.replace(/^[\p{Emoji}\s]+/u, "").trim();
    const matched = SYMPTOM_FLOWS.find(s => option.includes(s.label));

    if (!matched) {
      setMode("ai_chat");
      pushBot({ text: "Please describe your symptoms and I'll guide you to the right specialist." });
      return;
    }

    setCurrentFlow(matched);
    setFlowStep(0);
    setMode("flowing");
    setLead(p => ({ ...p, symptom: matched.label, specialist: matched.specialty }));

    pushBot({
      text: matched.questions[0].text,
      options: matched.questions[0].options,
    });
  }, []);

  // ── Symptom flow answer ───────────────────────────────────────────────────

  const handleFlowAnswer = useCallback((answer: string) => {
    if (!currentFlow) return;
    pushUser(answer);

    const nextStep = flowStep + 1;
    if (nextStep < currentFlow.questions.length) {
      setFlowStep(nextStep);
      pushBot({
        text: currentFlow.questions[nextStep].text,
        options: currentFlow.questions[nextStep].options,
      });
    } else {
      // All questions answered → show summary
      setMode("summary");
      pushBot({
        text: "Based on your answers, here's what I found:",
        card: {
          causes: currentFlow.conditions,
          specialist: currentFlow.specialty,
          urgencyNote: currentFlow.urgencyNote,
        },
      }, 900);
    }
  }, [currentFlow, flowStep]);

  // ── CTA actions ───────────────────────────────────────────────────────────

  const handleCTA = useCallback((action: "callback" | "find" | "whatsapp") => {
    if (action === "callback") {
      pushUser("Get a callback from expert 📞");
      setMode("lead_name");
      pushBot({ text: "I'll connect you with our care team! 😊 First, what's your name?" });

    } else if (action === "find") {
      pushUser(`Find ${currentFlow?.specialty ?? "specialist"} near me 🔍`);
      setMode("ai_chat");
      pushBot({
        text: `Which city are you in? I'll find the best ${currentFlow?.specialty ?? "specialist"} near you.`,
      });

    } else {
      // WhatsApp
      const msg = `Hi EasyHeals! I need help with ${lead.symptom ?? "a health concern"}. Please guide me.`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  }, [currentFlow, lead]);

  // ── Lead text input (name, phone) ─────────────────────────────────────────

  const handleLeadText = useCallback((value: string) => {
    if (mode === "lead_name") {
      const name = value.trim();
      if (!name) return;
      pushUser(name);
      setLead(p => ({ ...p, name }));
      setMode("lead_phone");
      pushBot({ text: `Hi ${name}! 😊 Your phone number so we can reach you?` });

    } else if (mode === "lead_phone") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10) {
        pushBot({ text: "Please enter a valid 10-digit phone number." }, 350);
        return;
      }
      pushUser(value.trim());
      setLead(p => ({ ...p, phone: digits }));
      setMode("lead_city");
      pushBot({ text: "Which city are you in?", options: CITIES });
    }
  }, [mode]);

  // ── Lead option buttons (city, time) ─────────────────────────────────────

  const handleLeadOption = useCallback(async (value: string) => {
    if (mode === "lead_city") {
      pushUser(value);
      setLead(p => ({ ...p, city: value }));
      setMode("lead_time");
      pushBot({ text: "Best time for us to call you?", options: CALL_TIMES });

    } else if (mode === "lead_time") {
      pushUser(value);
      const finalLead = { ...lead, time: value };
      setLead(finalLead);
      setMode("confirmed");
      setBusy(true);

      // Submit to /api/book (fire and forget — non-blocking)
      fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: finalLead.name ?? "Patient",
          phone: finalLead.phone,
          city: finalLead.city !== "Other city" ? finalLead.city : undefined,
          medicalSummary: [
            `Symptom: ${finalLead.symptom ?? "general health concern"}`,
            `Specialist: ${finalLead.specialist ?? "General Physician"}`,
            `Call time: ${value}`,
          ].join(" | "),
          source: "ai_chat",
        }),
      }).catch(() => {});

      setBusy(false);
      pushBot({
        text: `✅ Done! Our care team will call ${finalLead.name ?? "you"} ${value.toLowerCase()}. Trusted by 10,000+ patients 💚`,
        confirmed: true,
        options: [`View ${finalLead.specialist ?? "doctors"}`, "Ask another question"],
      }, 800);
    }
  }, [mode, lead]);

  // ── AI chat (free-form) ───────────────────────────────────────────────────

  const callSearchAPI = useCallback(async (query: string) => {
    setBusy(true);
    const history = aiHistory.slice(-6);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode: "chat", history }),
      });
      const data = await res.json();
      const answer: string = data?.assistant?.answer ?? "I couldn't find results. Please try rephrasing.";
      const followUps: string[] = (data?.assistant?.followUps ?? []).slice(0, 4);
      setAiHistory(p => [...p, { role: "user", text: query }, { role: "assistant", text: answer }]);
      pushBot({ text: answer, options: followUps.length ? followUps : undefined });
    } catch {
      pushBot({ text: "Sorry, I had trouble connecting. Please try again." });
    } finally {
      setBusy(false);
    }
  }, [aiHistory]);

  // ── Text submit ───────────────────────────────────────────────────────────

  const handleTextSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputVal.trim();
    if (!text || busy) return;
    setInputVal("");

    if (mode === "lead_name" || mode === "lead_phone") {
      handleLeadText(text);
      return;
    }

    // Switch to / stay in AI chat
    pushUser(text);
    if (mode !== "ai_chat") setMode("ai_chat");
    await callSearchAPI(text);
  }, [inputVal, busy, mode, handleLeadText, callSearchAPI]);

  // ── Option tap dispatcher ─────────────────────────────────────────────────

  const handleOption = useCallback((option: string) => {
    if (busy) return;

    if (mode === "symptom_picker") { handleSymptomPick(option); return; }
    if (mode === "flowing")        { handleFlowAnswer(option);   return; }
    if (mode === "lead_city" || mode === "lead_time") { handleLeadOption(option); return; }

    if (mode === "confirmed") {
      if (option.toLowerCase().includes("another")) {
        // Reset everything
        setMode("entry"); setMessages([]); setCurrentFlow(null);
        setFlowStep(0); setLead({}); setAiHistory([]);
      } else {
        // "View doctors" → AI search
        const q = `${lead.specialist ?? "doctor"} in ${lead.city ?? "my city"}`;
        pushUser(q);
        setMode("ai_chat");
        callSearchAPI(q);
      }
      return;
    }

    // summary CTAs
    if (mode === "summary") return; // handled by SummaryCard buttons directly

    // Default: treat option as typed query in AI chat
    pushUser(option);
    if (mode !== "ai_chat") setMode("ai_chat");
    callSearchAPI(option);
  }, [busy, mode, handleSymptomPick, handleFlowAnswer, handleLeadOption, lead, callSearchAPI]);

  // ── Derived UI ────────────────────────────────────────────────────────────

  const showInput = ["ai_chat", "lead_name", "lead_phone", "entry"].includes(mode);
  const inputPlaceholder =
    mode === "lead_name"  ? "Your name…" :
    mode === "lead_phone" ? "10-digit phone number…" :
    "Describe your concern or search…";

  // Options are only interactive on the LAST bot message
  const lastBotIdx = [...messages].reverse().findIndex(m => m.role === "bot");
  const lastBotId = lastBotIdx >= 0 ? messages[messages.length - 1 - lastBotIdx].id : null;

  return (
    <div className={`flex flex-col bg-[#f5f7f9] rounded-3xl overflow-hidden ${className ?? ""}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <span className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-lg shrink-0">🩺</span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 leading-tight">EasyHeals AI</p>
          <p className="text-xs text-green-500 leading-tight">● Online — reply in seconds</p>
        </div>
        {mode === "flowing" && totalSteps > 0 && (
          <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
            <span className="text-[11px] text-gray-400">Q {flowStep + 1} of {totalSteps}</span>
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Chat thread ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 min-h-0">

        {/* Entry screen */}
        {mode === "entry" && messages.length === 0 && (
          <EntryScreen onCategory={handleCategory} />
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const isLast = msg.id === lastBotId;
          return (
            <div key={msg.id}>
              <MessageBubble msg={msg} />

              {/* Summary card — always shown */}
              {msg.card && (
                <SummaryCard card={msg.card} onCTA={handleCTA} />
              )}

              {/* Options — only on last bot message */}
              {msg.options && isLast && !msg.card && (
                <OptionList
                  options={msg.options}
                  onSelect={handleOption}
                  confirmed={msg.confirmed}
                />
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && <TypingDots />}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      {showInput && (
        <form
          onSubmit={handleTextSubmit}
          className="shrink-0 flex items-center gap-2 px-3 py-3 bg-white border-t border-gray-100"
        >
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={inputPlaceholder}
            inputMode={mode === "lead_phone" ? "numeric" : "text"}
            autoComplete="off"
            disabled={busy}
            className="flex-1 min-w-0 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || busy}
            className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-90 transition-transform"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EntryScreen({ onCategory }: { onCategory: (id: string) => void }) {
  const categories = [
    { id: "symptoms", icon: "🤒", label: "I have symptoms",   sub: "Symptom checker" },
    { id: "doctor",   icon: "👨‍⚕️", label: "Find a doctor",    sub: "By specialty or name" },
    { id: "hospital", icon: "🏥", label: "Find hospital",     sub: "Near your city" },
    { id: "report",   icon: "📋", label: "Understand report", sub: "Explain my test result" },
  ];

  return (
    <div className="pt-1 space-y-3">
      {/* Welcome bubble */}
      <div className="flex items-end gap-2">
        <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm shrink-0 mb-0.5">🩺</span>
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[82%]">
          <p className="text-sm text-gray-800 leading-relaxed">
            Hi! 👋 I&apos;m your AI health guide.<br />
            How can I help you today?
          </p>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-2.5 ml-9">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategory(cat.id)}
            className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm text-left hover:border-green-300 hover:shadow-md active:scale-[0.97] transition-all group"
          >
            <span className="text-2xl">{cat.icon}</span>
            <p className="font-semibold text-[13px] text-gray-800 mt-2 leading-snug group-hover:text-green-700">
              {cat.label}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{cat.sub}</p>
          </button>
        ))}
      </div>

      {/* Trusted by */}
      <div className="ml-9 flex items-center gap-1.5 text-[11px] text-gray-400">
        <span className="text-green-500">✓</span> Trusted by 10,000+ patients · Verified doctors
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  // For summary messages, we show the text bubble but the card is rendered separately
  const isUser = msg.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm shrink-0 mb-0.5">🩺</span>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-green-500 text-white rounded-br-sm"
            : msg.confirmed
            ? "bg-green-50 text-green-800 border border-green-200 rounded-bl-sm"
            : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

function OptionList({
  options,
  onSelect,
  confirmed,
}: {
  options: string[];
  onSelect: (o: string) => void;
  confirmed?: boolean;
}) {
  return (
    <div className="ml-9 mt-2 flex flex-col gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.98] ${
            confirmed
              ? "bg-white text-green-700 border-green-300 hover:bg-green-50"
              : "bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:bg-green-50 hover:text-green-800"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  card,
  onCTA,
}: {
  card: NonNullable<Msg["card"]>;
  onCTA: (action: "callback" | "find" | "whatsapp") => void;
}) {
  return (
    <div className="ml-9 mt-2">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Causes */}
        <div className="bg-green-50 border-b border-green-100 px-4 py-3">
          <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-2">
            Possible causes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {card.causes.map(c => (
              <span
                key={c}
                className="bg-white text-gray-700 text-xs px-2.5 py-1 rounded-full border border-green-200"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Specialist */}
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-[11px] text-gray-400 mb-0.5">Recommended specialist</p>
          <p className="font-bold text-gray-800 text-[15px]">👨‍⚕️ {card.specialist}</p>
          {card.urgencyNote && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-2">
              {card.urgencyNote}
            </p>
          )}
        </div>

        {/* Social proof */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] text-gray-400 text-center">
            Early consultation helps avoid complications · Trusted by 10,000+ patients
          </p>
        </div>

        {/* CTAs */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <button
            onClick={() => onCTA("find")}
            className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Find {card.specialist} near me
          </button>
          <button
            onClick={() => onCTA("callback")}
            className="w-full bg-white text-green-600 border border-green-300 hover:bg-green-50 rounded-xl py-2.5 text-sm font-semibold active:scale-[0.98] transition-all"
          >
            📞 Get a callback from expert
          </button>
          <button
            onClick={() => onCTA("whatsapp")}
            className="w-full text-gray-500 hover:text-green-600 text-sm py-2 flex items-center justify-center gap-1.5 transition-colors"
          >
            💬 WhatsApp our team
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm shrink-0">🩺</span>
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
