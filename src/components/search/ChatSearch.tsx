"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { quickPrompts } from "@/components/phase1/data";
import styles from "@/components/phase1/phase1.module.css";
// NOTE: This component uses phase1 dark styles for the chat card.
// The homepage wraps it in a white-themed container.
import type { SearchResponse } from "@/components/phase1/types";
import { useTranslations } from "@/i18n/LocaleContext";

type Message = {
  role: "assistant" | "user";
  text: string;
};

export type PatientContext = {
  name?: string;
  age?: string;
  sex?: string;
  city?: string;
  priorConditions?: string;
  phone?: string;
};

type ChatSearchProps = {
  onSearchResult: (payload: SearchResponse) => void;
  onLoadingChange: (loading: boolean) => void;
  queuedPrompt?: string | null;
  onQueuedPromptHandled?: () => void;
  isLoggedIn?: boolean;
};

const modes = [
  { key: "chat", label: "AI Chat" },
  { key: "symptom", label: "Symptoms" },
  { key: "name", label: "Name Search" },
] as const;

const languages = ["English", "Hindi", "Marathi", "Tamil", "Bengali", "Telugu", "Malayalam", "Kannada", "Arabic", "Sinhala"];

// Maps nav locale code → index in languages array
const LOCALE_TO_LANG: Record<string, number> = {
  en: 0, hi: 1, mr: 2, ta: 3, bn: 4, te: 5, ml: 6, kn: 7, ar: 8, si: 9,
};

const VOICE_LANG_MAP: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Tamil: "ta-IN",
  Bengali: "bn-IN",
  Telugu: "te-IN",
  Malayalam: "ml-IN",
  Kannada: "kn-IN",
  Arabic: "ar-SA",
  Sinhala: "si-LK",
};

const GUEST_QUESTION_LIMIT = 3;

const ANALYZING_STEPS = [
  "Analyzing your symptoms…",
  "Searching EasyHeals database…",
  "Matching hospitals & doctors…",
  "Preparing your care guidance…",
];

function AnalyzingTimer() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => {
      setElapsed((s) => s + 1);
      setStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1));
    }, 900);
    return () => clearInterval(ticker);
  }, []);

  return (
    <span style={{ fontSize: "0.75rem", color: "#8FA39A", display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{
        display: "inline-block",
        width: "0.55rem",
        height: "0.55rem",
        borderRadius: "50%",
        border: "2px solid #1B8A4A",
        borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite",
      }} />
      {ANALYZING_STEPS[step]}
      {elapsed > 4 && <span style={{ color: "#c0ccc8" }}>({elapsed}s)</span>}
    </span>
  );
}

// Greeting text per language — shown when chat initialises or language changes
const LANG_GREETINGS: Record<string, { chat: string; symptom: string; name: string }> = {
  English:  { chat: "Hello! I am your EasyHeals AI health assistant. Tell me your symptoms and I will help guide you to the right care. What brings you here today?", symptom: "Describe your symptoms and I will help identify possible conditions, the right specialist, and tests needed.", name: "Search by hospital or doctor name. I will find their profile and help you book an appointment." },
  Hindi:    { chat: "नमस्ते! मैं आपका EasyHeals AI स्वास्थ्य सहायक हूं। अपने लक्षण बताएं और मैं सही देखभाल दिलाने में मदद करूंगा।", symptom: "अपने लक्षण विस्तार से बताएं। मैं संभावित बीमारी, सही विशेषज्ञ और जरूरी जांच सुझाऊंगा।", name: "अस्पताल या डॉक्टर का नाम टाइप करें। मैं प्रोफाइल और अपॉइंटमेंट में मदद करूंगा।" },
  Marathi:  { chat: "नमस्कार! मी तुमचा EasyHeals AI आरोग्य सहाय्यक आहे। तुमची लक्षणे सांगा, मी योग्य काळजी शोधण्यास मदत करेन।", symptom: "तुमची लक्षणे सांगा. मी शक्य रोग, योग्य तज्ञ आणि आवश्यक चाचण्या सुचवेन।", name: "रुग्णालय किंवा डॉक्टरचे नाव टाइप करा. मी प्रोफाइल आणि अपॉइंटमेंट मध्ये मदत करेन।" },
  Tamil:    { chat: "வணக்கம்! நான் உங்கள் EasyHeals AI ஆரோக்கிய உதவியாளர். உங்கள் அறிகுறிகளை சொல்லுங்கள், சரியான மருத்துவரை கண்டறிய உதவுகிறேன்।", symptom: "உங்கள் அறிகுறிகளை விவரிக்கவும். சரியான நிபுணரையும் சோதனைகளையும் பரிந்துரைக்கிறேன்।", name: "மருத்துவமனை அல்லது மருத்துவர் பெயரை தேடுங்கள். சுயவிவரமும் நியமனமும் உதவுகிறேன்।" },
  Bengali:  { chat: "নমস্কার! আমি আপনার EasyHeals AI স্বাস্থ্য সহায়তাকারী। আপনার লক্ষণ জানান, সঠিক চিকিৎসা খুঁজে পেতে সাহায্য করব।", symptom: "আপনার লক্ষণ বিস্তারিত জানান। সম্ভাব্য রোগ, বিশেষজ্ঞ এবং পরীক্ষা সুপারিশ করব।", name: "হাসপাতাল বা ডাক্তারের নাম অনুসন্ধান করুন। প্রোফাইল এবং অ্যাপয়েন্টমেন্টে সাহায্য করব।" },
  Telugu:   { chat: "నమస్కారం! నేను మీ EasyHeals AI ఆరోగ్య సహాయకుడిని. మీ లక్షణాలు చెప్పండి, సరైన వైద్యాన్ని కనుగొనడంలో సహాయం చేస్తాను।", symptom: "మీ లక్షణాలు వివరంగా చెప్పండి. సరైన నిపుణుడిని, అవసరమైన పరీక్షలను సూచిస్తాను।", name: "ఆసుపత్రి లేదా వైద్యుని పేరు వెతకండి. ప్రొఫైల్ మరియు అపాయింట్‌మెంట్‌లో సహాయం చేస్తాను।" },
  Malayalam:{ chat: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ EasyHeals AI ആരോഗ്യ സഹായകനാണ്. നിങ്ങളുടെ ലക്ഷണങ്ങൾ പറഞ്ഞുതരൂ, ശരിയായ ചികിത്സ കണ്ടെത്താൻ സഹായിക്കാം।", symptom: "ലക്ഷണങ്ങൾ വിശദമായി പറഞ്ഞുതരൂ. ശരിയായ വിദഗ്ദ്ധനെയും ആവശ്യമായ പരിശോധനകളും നിർദ്ദേശിക്കാം।", name: "ആശുപത്രി അല്ലെങ്കിൽ ഡോക്ടർ പേര് തിരയൂ. പ്രൊഫൈലും അപ്പോയ്ന്റ്മെന്റും സഹായിക്കാം।" },
  Kannada:  { chat: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ EasyHeals AI ಆರೋಗ್ಯ ಸಹಾಯಕ. ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ಹೇಳಿ, ಸರಿಯಾದ ಚಿಕಿತ್ಸೆ ಕಂಡುಹಿಡಿಯಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ।", symptom: "ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ವಿವರಿಸಿ. ಸರಿಯಾದ ತಜ್ಞ ಮತ್ತು ಅಗತ್ಯ ಪರೀಕ್ಷೆಗಳನ್ನು ಸೂಚಿಸುತ್ತೇನೆ।", name: "ಆಸ್ಪತ್ರೆ ಅಥವಾ ವೈದ್ಯರ ಹೆಸರು ಹುಡುಕಿ. ಪ್ರೊಫೈಲ್ ಮತ್ತು ಅಪಾಯಿಂಟ್ಮೆಂಟ್‌ನಲ್ಲಿ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ।" },
  Arabic:   { chat: "مرحباً! أنا مساعدك الصحي بـ EasyHeals. أخبرني بأعراضك وسأساعدك في إيجاد الرعاية المناسبة. ما الذي يقلقك اليوم؟", symptom: "صف أعراضك بالتفصيل. سأساعدك في تحديد الحالة والطبيب المناسب والفحوصات اللازمة.", name: "ابحث عن مستشفى أو طبيب. سأساعدك في العثور على الملف الشخصي وحجز موعد." },
  Sinhala:  { chat: "ආයුබෝවන්! මම ඔබේ EasyHeals AI සෞඛ්‍ය සහායකයා. ඔබේ රෝග ලක්ෂණ කියන්න, නිවැරදි ප්‍රතිකාරය සොයා ගැනීමට උදව් කරන්නම්.", symptom: "ඔබේ රෝග ලක්ෂණ විස්තරාත්මකව කියන්න. නිවැරදි විශේෂඥ සහ අවශ්‍ය පරීක්ෂාව නිර්දේශ කරන්නම්.", name: "රෝහල් හෝ වෛද්‍ය නාමය සොයන්න. ගිණුම සහ හමුවීමේ සම්බන්ධතා සොයා ගැනීමට උදව් කරන්නම්." },
};

const TAB_CONFIG = {
  chat: {
    greeting: LANG_GREETINGS.English.chat,
    placeholder: "Type symptoms, doctor name, or ask anything...",
    prompts: [
      "Chest pain since morning",
      "Mujhe seene mein dard ho raha hai",
      "Knee pain for 2 weeks",
      "High fever and fatigue",
      "I feel dizzy and nauseous",
    ],
  },
  symptom: {
    greeting: LANG_GREETINGS.English.symptom,
    placeholder: "Describe your symptoms in detail...",
    prompts: [
      "Severe headache with vomiting",
      "Chest tightness when climbing stairs",
      "Swollen knee after a fall",
      "Irregular periods and hair fall",
      "Persistent cough for 3 weeks",
    ],
  },
  name: {
    greeting: LANG_GREETINGS.English.name,
    placeholder: "Type hospital or doctor name...",
    prompts: [
      "Apollo Hospitals Pune",
      "Fortis Hospital Mumbai",
      "Dr Devi Shetty",
      "AIIMS Delhi",
      "Kokilaben Hospital",
    ],
  },
} as const;

type SearchResponseWithContext = SearchResponse & {
  patientContextUpdate?: PatientContext;
  leadCreated?: boolean;
};

export function ChatSearch({
  onSearchResult,
  onLoadingChange,
  queuedPrompt,
  onQueuedPromptHandled,
  isLoggedIn = false,
}: ChatSearchProps) {
  const { locale } = useTranslations();
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]["key"]>("chat");
  const tabCfg = TAB_CONFIG[activeMode];
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: tabCfg.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [langIndex, setLangIndex] = useState(0);
  const [followUps, setFollowUps] = useState<string[]>(tabCfg.prompts as unknown as string[]);
  const [clarifyQuestion, setClarifyQuestion] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("Gemini AI · Multilingual");
  const [listening, setListening] = useState(false);
  const [guestQuestions, setGuestQuestions] = useState(0);
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [leadCreated, setLeadCreated] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const languageLabel = useMemo(() => languages[langIndex], [langIndex]);

  // Reset chat when tab changes
  useEffect(() => {
    const cfg = TAB_CONFIG[activeMode];
    setMessages([{ role: "assistant", text: cfg.greeting }]);
    setFollowUps(cfg.prompts as unknown as string[]);
    setPatientContext({});
    setLeadCreated(false);
    setGuestQuestions(0);
    setInput("");
    setClarifyQuestion(null);
  }, [activeMode]);

  // Sync chat language with nav locale selection — also update greeting
  useEffect(() => {
    const idx = LOCALE_TO_LANG[locale];
    if (idx === undefined) return;
    setLangIndex(idx);
    const lang = languages[idx];
    const greetings = LANG_GREETINGS[lang] ?? LANG_GREETINGS.English;
    const newGreeting = greetings[activeMode];
    // Only update greeting if the chat only has the initial greeting (user hasn't started a conversation)
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", text: newGreeting }];
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatWindowRef.current?.scrollTo({ top: chatWindowRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function runQuery(text: string) {
    const query = text.trim();
    if (!query || loading) return;

    const outgoingMessage: Message = { role: "user", text: query };
    const nextMessages = [...messages, outgoingMessage];
    setMessages(nextMessages);
    setInput("");

    // Guest login gate — after GUEST_QUESTION_LIMIT questions, prompt to login
    if (!isLoggedIn) {
      const newCount = guestQuestions + 1;
      setGuestQuestions(newCount);
      if (newCount > GUEST_QUESTION_LIMIT) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `You've used your ${GUEST_QUESTION_LIMIT} free questions. Login or register to continue getting personalised AI health guidance, save your health history, and get care recommendations tailored to you.`,
          },
        ]);
        setFollowUps(["Login", "Register free"]);
        setClarifyQuestion(null);
        return;
      }
    }

    setLoading(true);
    onLoadingChange(true);

    try {
      const history = nextMessages.slice(-10).map((message) => ({
        role: message.role,
        text: message.text,
      }));

      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          history,
          language: languageLabel.toLowerCase(),
          patientContext,
          mode: activeMode,
        }),
      });

      const body = (await response.json()) as SearchResponseWithContext | { error?: string };
      if (!response.ok || !("results" in body)) {
        throw new Error("Search failed");
      }

      const srBody = body as SearchResponseWithContext;
      onSearchResult(srBody);

      // Merge any patient info the AI extracted from this exchange
      if (srBody.patientContextUpdate && Object.keys(srBody.patientContextUpdate).length > 0) {
        setPatientContext((prev) => ({ ...prev, ...srBody.patientContextUpdate }));
      }

      // Lead created confirmation
      if (srBody.leadCreated && !leadCreated) {
        setLeadCreated(true);
      }

      const assistantLines = [srBody.assistant.answer];
      if (srBody.assistant.clarifyQuestion) {
        assistantLines.push(srBody.assistant.clarifyQuestion);
      }

      setMessages((prev) => [...prev, { role: "assistant", text: assistantLines.join(" ") }]);
      setFollowUps(srBody.assistant.followUps.length ? srBody.assistant.followUps : quickPrompts);
      setClarifyQuestion(srBody.assistant.clarifyQuestion);
      setModelLabel(
        srBody.meta.degraded
          ? `Fallback mode · ${srBody.meta.latencyMs}ms`
          : `${srBody.meta.model} · ${srBody.meta.latencyMs}ms`,
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
    rec.lang = VOICE_LANG_MAP[languageLabel] ?? "en-IN";

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

  // Show login prompt buttons when gate is hit
  const showLoginGate = !isLoggedIn && guestQuestions > GUEST_QUESTION_LIMIT;

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

      <div className={styles.chatWindow} ref={chatWindowRef}>
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
          <div className={styles.messageRow} style={{ alignItems: "flex-start", gap: "0.5rem" }}>
            <span className={styles.messageAvatar}>✦</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <div className={styles.loadingDots}>
                <span />
                <span />
                <span />
              </div>
              <AnalyzingTimer />
            </div>
          </div>
        ) : null}

        {leadCreated && (
          <div style={{ padding: "0.5rem 0.75rem", background: "rgba(27,138,74,0.08)", borderRadius: "0.75rem", fontSize: "0.82rem", color: "#136836", border: "1px solid rgba(27,138,74,0.2)" }}>
            ✅ Your health profile is saved. We'll match you with the right care team.
          </div>
        )}
      </div>

      <div className={styles.quickPromptRow}>
        {showLoginGate ? (
          <>
            <Link href="/dashboard/login" style={{ padding: "0.3rem 0.8rem", borderRadius: "999px", background: "#1B8A4A", color: "#fff", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600 }}>
              Login
            </Link>
            <Link href="/dashboard/register" style={{ padding: "0.3rem 0.8rem", borderRadius: "999px", border: "1px solid #1B8A4A", color: "#1B8A4A", fontSize: "0.82rem", textDecoration: "none" }}>
              Register free
            </Link>
          </>
        ) : (
          followUps.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void runQuery(prompt)}>
              {prompt}
            </button>
          ))
        )}
      </div>

      <form className={styles.chatInputRow} onSubmit={onSubmit}>
        <textarea
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={tabCfg.placeholder}
          required
          disabled={showLoginGate}
        />
        <button
          type="button"
          className={`${styles.voiceMicBtn} ${listening ? styles.voiceActive : ""}`}
          onClick={toggleVoice}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          title={listening ? "Listening… click to stop" : "Voice input"}
          disabled={showLoginGate}
        >
          {listening ? "🔴" : "🎤"}
        </button>
        <button type="button" onClick={() => setLangIndex((prev) => (prev + 1) % languages.length)}>
          {languageLabel}
        </button>
        <button type="submit" disabled={loading || showLoginGate}>
          {loading ? "..." : "➤"}
        </button>
      </form>

      {!isLoggedIn && !showLoginGate && (
        <p style={{ margin: 0, fontSize: "0.73rem", color: "#8FA39A", textAlign: "center", padding: "0 0.5rem 0.25rem" }}>
          {GUEST_QUESTION_LIMIT - guestQuestions} free question{GUEST_QUESTION_LIMIT - guestQuestions !== 1 ? "s" : ""} remaining ·{" "}
          <Link href="/dashboard/login" style={{ color: "#1B8A4A" }}>Login</Link> for unlimited access
        </p>
      )}

      <p className={styles.modelText}>Powered by {modelLabel}</p>
    </section>
  );
}
