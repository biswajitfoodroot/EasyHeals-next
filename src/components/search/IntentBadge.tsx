import styles from "@/components/phase1/phase1.module.css";

type IntentBadgeProps = {
  icon?: string;
  label: string;
  count: number;
  language?: string | null;
};

export function IntentBadge({ icon = "?", label, count, language }: IntentBadgeProps) {
  return (
    <div className={styles.intentBadge}>
      <span>{icon}</span>
      <span>Showing results for</span>
      <strong>{label}</strong>
      <span>- {count} listings found</span>
      {language ? <em> · {language.toUpperCase()} detected</em> : null}
    </div>
  );
}

