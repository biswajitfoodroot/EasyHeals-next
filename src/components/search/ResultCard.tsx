import Link from "next/link";

import { MonogramAvatar } from "@/components/MonogramAvatar";
import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

type ResultCardProps = {
  result: SearchResult;
  onContribute: (result: SearchResult) => void;
};

export function ResultCard({ result, onContribute }: ResultCardProps) {
  const isDoctor = result.type === "doctor";

  return (
    <article className={styles.resultCard}>
      <div className={styles.resultHead}>
        <MonogramAvatar
          name={result.name}
          specialty={isDoctor ? result.specialties[0] : undefined}
          size={40}
          borderRadius="12px"
        />
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
