import Link from "next/link";

import { MonogramAvatar } from "@/components/MonogramAvatar";
import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

type ResultCardProps = {
  result: SearchResult;
  onContribute: (result: SearchResult) => void;
};

export function ResultCard({ result }: ResultCardProps) {
  const isDoctor = result.type === "doctor";
  const typeIcon = isDoctor ? "\uD83D\uDC68\u200D\u2695\uFE0F" : "\uD83C\uDFE5";

  return (
    <article className={styles.resultCard}>
      {/* Top row: avatar + info + verified badge */}
      <div className={styles.resultHead}>
        <div className={styles.resultAvatar}>{typeIcon}</div>
        <div className={styles.resultInfo}>
          <h4>{result.name}</h4>
          <p className={styles.resultCity}>
            {isDoctor && result.qualifications && result.qualifications.length > 0
              ? result.qualifications.slice(0, 2).join(", ")
              : `${result.city}${result.state ? `, ${result.state}` : ""}`}
          </p>
          {isDoctor && result.yearsOfExperience && result.yearsOfExperience > 0 && (
            <p className={styles.resultMeta}>
              {result.yearsOfExperience}+ yrs experience {"\u00b7"} {result.city}
            </p>
          )}
          {result.rating > 0 && (
            <p className={styles.resultRating}>
              {"\u2605"} {result.rating.toFixed(1)}
            </p>
          )}
        </div>
        {result.verified && (
          <span className={styles.badgeVerified}>{"\u2705"} Verified</span>
        )}
      </div>

      {/* Network & community badges */}
      {(result.communityVerified || result.networkTierCode) && (
        <div className={styles.badgeRow}>
          {result.networkTierCode === "premium" && (
            <span className={styles.badgePremium}>{"✦"} EasyHeals Premium</span>
          )}
          {result.networkTierCode === "partner" && (
            <span className={styles.badgePartner}>{"✦"} EasyHeals Partner</span>
          )}
          {(!result.networkTierCode || result.networkTierCode === "basic") && result.communityVerified && (
            <span className={styles.badgeCommunity}>{"✓"} Community Verified</span>
          )}
        </div>
      )}

      {/* Specialty tags */}
      {result.specialties.length > 0 && (
        <div className={styles.tagRow}>
          {result.specialties.slice(0, 3).map((tag) => (
            <span key={`${result.id}-${tag}`}>{tag}</span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.resultActions}>
        <Link href={result.profileUrl} className={styles.resultBtnView}>
          View Profile
        </Link>
        <Link
          href={result.phone ? `tel:${result.phone}` : `${result.profileUrl}?book=1`}
          className={styles.resultBtnBook}
        >
          Book Now {"\u2192"}
        </Link>
      </div>
    </article>
  );
}
