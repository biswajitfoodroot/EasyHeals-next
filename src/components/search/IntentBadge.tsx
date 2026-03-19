import styles from "@/components/phase1/phase1.module.css";

const LANGUAGE_FLAGS: Record<string, { flag: string; label: string }> = {
  en: { flag: "🇬🇧", label: "EN" },
  english: { flag: "🇬🇧", label: "EN" },
  hi: { flag: "🇮🇳", label: "HI" },
  hindi: { flag: "🇮🇳", label: "HI" },
  mr: { flag: "🇮🇳", label: "MR" },
  marathi: { flag: "🇮🇳", label: "MR" },
  ta: { flag: "🇮🇳", label: "TA" },
  tamil: { flag: "🇮🇳", label: "TA" },
  te: { flag: "🇮🇳", label: "TE" },
  telugu: { flag: "🇮🇳", label: "TE" },
  bn: { flag: "🇧🇩", label: "BN" },
  bengali: { flag: "🇧🇩", label: "BN" },
  kn: { flag: "🇮🇳", label: "KN" },
  kannada: { flag: "🇮🇳", label: "KN" },
  ml: { flag: "🇮🇳", label: "ML" },
  malayalam: { flag: "🇮🇳", label: "ML" },
};

function getLanguageMeta(lang: string | null | undefined): { flag: string; label: string } | null {
  if (!lang) return null;
  const key = lang.toLowerCase().trim();
  return LANGUAGE_FLAGS[key] ?? { flag: "🌐", label: lang.toUpperCase().slice(0, 3) };
}

type IntentBadgeProps = {
  icon?: string;
  label: string;
  count: number;
  language?: string | null;
  confidence?: number;
};

export function IntentBadge({ icon = "✦", label, count, language, confidence }: IntentBadgeProps) {
  const langMeta = getLanguageMeta(language);
  const lowConfidence = confidence !== undefined && confidence < 0.5;

  return (
    <div className={styles.intentBadge}>
      <span>{icon}</span>
      <span>Showing results for</span>
      <strong>{label}</strong>
      <span>— {count} listings</span>
      {langMeta ? (
        <span className={styles.langPill}>
          {langMeta.flag} {langMeta.label}
        </span>
      ) : null}
      {lowConfidence ? (
        <span className={styles.lowConfidencePill} title={`Confidence: ${Math.round((confidence ?? 0) * 100)}%`}>
          ~{Math.round((confidence ?? 0) * 100)}% match
        </span>
      ) : null}
    </div>
  );
}
