"use client";

import Link from "next/link";
import EasyHealsNetworkBadge from "./EasyHealsNetworkBadge";
import styles from "./profiles.module.css";
import { useTranslations } from "@/i18n/LocaleContext";

function colorIndex(name: string) {
  return String(name.charCodeAt(0) % 8);
}

export type HospitalMiniCardProps = {
  id: string;
  name: string;
  profileUrl: string;
  city: string;
  state?: string | null;
  rating: number;
  reviewCount?: number;
  specialties?: string[];
  verified?: boolean;
  networkTierCode?: string | null;
};

export default function HospitalMiniCard({
  name,
  profileUrl,
  city,
  state,
  rating,
  reviewCount,
  specialties = [],
  verified,
  networkTierCode,
}: HospitalMiniCardProps) {
  const { t } = useTranslations();
  const color = colorIndex(name);
  const effective = (reviewCount === 0 || reviewCount == null) && rating === 0 ? 4.0 : rating;
  const full = Math.min(5, Math.round(effective));

  return (
    <article className={styles.miniCard} data-color={color}>
      {/* Header: name / location / rating */}
      <div>
        <p className={styles.cardName}>{name}</p>
        <p className={styles.cardLocation}>{city}{state ? `, ${state}` : ""}</p>
        <span className={styles.starRow}>
          {"★".repeat(full)}{"☆".repeat(5 - full)}
          <span style={{ color: "#8FA39A", fontSize: "11px", fontWeight: 400, marginLeft: "3px" }}>
            {effective.toFixed(1)}
            {reviewCount ? ` (${reviewCount.toLocaleString("en-IN")})` : ""}
          </span>
        </span>
      </div>

      {/* Specialty tags */}
      {specialties.length > 0 && (
        <div className={styles.tagRow}>
          {specialties.slice(0, 3).map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      )}

      {/* Verified / network badge */}
      {networkTierCode ? (
        <div className={styles.networkBadgeWrap}>
          <EasyHealsNetworkBadge tierCode={networkTierCode} compact />
        </div>
      ) : verified !== undefined ? (
        <span className={styles.verifiedBadge}>
          {verified ? `✅ ${t("common.verified")}` : t("common.communityVerified")}
        </span>
      ) : null}

      {/* Action buttons */}
      <div className={styles.directoryCardFooter}>
        <Link href={profileUrl} className={styles.directoryCardView}>
          {t("home.view")}
        </Link>
        <Link href={`${profileUrl}?book=1`} className={styles.directoryCardBook}>
          {t("home.book")}
        </Link>
      </div>
    </article>
  );
}
