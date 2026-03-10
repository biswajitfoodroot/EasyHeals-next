import Link from "next/link";

import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

type ResultCardProps = {
  result: SearchResult;
  onContribute: (result: SearchResult) => void;
};

function avatarLabel(name: string) {
  const chunks = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");

  return chunks.join("") || "EH";
}

export function ResultCard({ result, onContribute }: ResultCardProps) {
  const isDoctor = result.type === "doctor";

  return (
    <article className={styles.resultCard}>
      <div className={styles.resultHead}>
        <div className={styles.resultIcon}>{isDoctor ? avatarLabel(result.name) : "??"}</div>
        <div>
          <h4>{result.name}</h4>
          <p>
            {isDoctor ? "Doctor" : "Hospital"} · ?? {result.city}
            {result.state ? `, ${result.state}` : ""}
          </p>
        </div>
        <span className={styles.verifiedPill}>{result.verified ? "? Verified" : "Community"}</span>
      </div>

      {result.specialties.length ? (
        <div className={styles.tagRow}>
          {result.specialties.slice(0, 4).map((tag, index) => (
            <span key={`${result.id}-${tag}`} className={index === 0 ? styles.tagHighlight : ""}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.resultFoot}>
        <div className={styles.ratingBlock}>
          <span className={styles.stars}>?????</span>
          <strong>{result.rating.toFixed(1)}</strong>
          <small>({Math.max(30, Math.round(result.score * 100))})</small>
        </div>
        <div className={styles.resultActions}>
          <Link href={result.profileUrl}>View Profile ?</Link>
          {result.phone ? <a href={`tel:${result.phone}`}>Call</a> : null}
          <button type="button" onClick={() => onContribute(result)}>
            Suggest Edit
          </button>
        </div>
      </div>
    </article>
  );
}
