"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/i18n/LocaleContext";
import styles from "@/components/profiles/profiles.module.css";
import panelStyles from "@/components/profiles/ReferencesEditsPanel.module.css";

type ReferenceRow = {
  fieldKey: string;
  extractedValue: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  confidence: number;
  createdAt: number | null;
};

type EditRow = {
  id: string;
  fieldChanged: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reviewedAt: Date | null;
  createdAt: Date | null;
  contributorName: string;
};

type Props = {
  entityType: "hospital" | "doctor";
  entityId: string;
};

function formatDate(d: Date | number | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  const datePart = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
}

// Deterministic pastel palette for field name badges — each field gets a stable hue.
const FIELD_PALETTES = [
  { bg: "#EDE9FE", color: "#5B21B6" }, // violet  — specialties
  { bg: "#DBEAFE", color: "#1D4ED8" }, // blue    — qualifications
  { bg: "#FEF3C7", color: "#92400E" }, // amber   — facilities
  { bg: "#FCE7F3", color: "#9D174D" }, // pink    — languages
  { bg: "#D1FAE5", color: "#065F46" }, // emerald — workinghours / consultationhours
  { bg: "#FEE2E2", color: "#991B1B" }, // red     — misc
  { bg: "#E0F2FE", color: "#075985" }, // sky
  { bg: "#FDF4FF", color: "#7E22CE" }, // purple
];

function fieldPalette(field: string | null): { bg: string; color: string } {
  if (!field) return FIELD_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < field.length; i++) hash = (hash * 31 + field.charCodeAt(i)) >>> 0;
  return FIELD_PALETTES[hash % FIELD_PALETTES.length];
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.8) return { label: "High", color: "#1B8A4A" };
  if (c >= 0.5) return { label: "Medium", color: "#D97706" };
  return { label: "Low", color: "#DC2626" };
}

function formatValue(val: Record<string, unknown> | null): string {
  if (!val) return "—";
  // Plain array stored directly (legacy path)
  if (Array.isArray(val)) return (val as string[]).join(", ");
  // Scalar wrapped as { value: "..." }
  if (typeof val.value === "string") return val.value;
  // Array field stored as single-key object { fieldName: [...] } — unwrap it
  const keys = Object.keys(val);
  if (keys.length === 1) {
    const inner = val[keys[0]];
    if (Array.isArray(inner)) return (inner as string[]).join(", ");
    if (typeof inner === "string") return inner;
  }
  return JSON.stringify(val);
}

export function ReferencesEditsPanel({ entityType, entityId }: Props) {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<"edits" | "references">("edits");

  const [edits, setEdits] = useState<EditRow[]>([]);
  const [editsLoading, setEditsLoading] = useState(false);
  const [editsHasMore, setEditsHasMore] = useState(false);
  const [editsOffset, setEditsOffset] = useState(0);

  const [refs, setRefs] = useState<Record<string, ReferenceRow[]>>({});
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsLoaded, setRefsLoaded] = useState(false);

  const loadEdits = useCallback(async (offset: number) => {
    setEditsLoading(true);
    try {
      const res = await fetch(
        `/api/public/${entityType}s/${entityId}/edits?offset=${offset}&limit=20`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = await res.json() as { data: EditRow[]; hasMore: boolean };
      setEdits((prev) => offset === 0 ? json.data : [...prev, ...json.data]);
      setEditsHasMore(json.hasMore);
      setEditsOffset(offset + json.data.length);
    } finally {
      setEditsLoading(false);
    }
  }, [entityType, entityId]);

  const loadRefs = useCallback(async () => {
    if (refsLoaded) return;
    setRefsLoading(true);
    try {
      const res = await fetch(`/api/public/${entityType}s/${entityId}/references`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json() as { data: Record<string, ReferenceRow[]> };
      setRefs(json.data);
      setRefsLoaded(true);
    } finally {
      setRefsLoading(false);
    }
  }, [entityType, entityId, refsLoaded]);

  useEffect(() => {
    loadEdits(0);
  }, [loadEdits]);

  useEffect(() => {
    if (activeTab === "references") loadRefs();
  }, [activeTab, loadRefs]);

  const refFields = Object.keys(refs);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderIcon}>📋</div>
        <div>
          <h2 className={styles.panelTitle}>{t("profile.refsEditsTitle")}</h2>
          <p className={styles.panelHint}>{t("profile.refsEditsHint")}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className={panelStyles.tabBar}>
        <button
          type="button"
          className={`${panelStyles.tabBtn} ${activeTab === "edits" ? panelStyles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("edits")}
        >
          {t("profile.tabEdits")}
          {edits.length > 0 && <span className={panelStyles.tabCount}>{edits.length}</span>}
        </button>
        <button
          type="button"
          className={`${panelStyles.tabBtn} ${activeTab === "references" ? panelStyles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("references")}
        >
          {t("profile.tabReferences")}
          {refFields.length > 0 && <span className={panelStyles.tabCount}>{refFields.length}</span>}
        </button>
      </div>

      {/* Edits tab */}
      {activeTab === "edits" && (
        <div className={panelStyles.tabContent}>
          {editsLoading && edits.length === 0 ? (
            <p className={panelStyles.emptyMsg}>{t("common.loading")}</p>
          ) : edits.length === 0 ? (
            <p className={panelStyles.emptyMsg}>{t("profile.noEditsYet")}</p>
          ) : (
            <ol className={panelStyles.timeline}>
              {edits.map((edit) => (
                <li key={edit.id} className={panelStyles.timelineItem}>
                  <div className={panelStyles.timelineDot} />
                  <div className={panelStyles.timelineBody}>
                    <div className={panelStyles.timelineHeader}>
                      <span
                        className={panelStyles.fieldBadge}
                        style={{ background: fieldPalette(edit.fieldChanged).bg, color: fieldPalette(edit.fieldChanged).color }}
                      >
                        {edit.fieldChanged ?? "—"}
                      </span>
                      <span className={panelStyles.timelineMeta}>
                        {edit.contributorName} · {formatDate(edit.reviewedAt ?? edit.createdAt)}
                      </span>
                    </div>
                    <div className={panelStyles.timelineDiff}>
                      {edit.oldValue !== null && (
                        <span className={panelStyles.diffOld}>{formatValue(edit.oldValue)}</span>
                      )}
                      {edit.oldValue !== null && (
                        <span className={panelStyles.diffArrow}>→</span>
                      )}
                      <span className={panelStyles.diffNew}>{formatValue(edit.newValue)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {editsHasMore && (
            <button
              type="button"
              className={panelStyles.loadMoreBtn}
              onClick={() => loadEdits(editsOffset)}
              disabled={editsLoading}
            >
              {editsLoading ? t("common.loading") : t("common.loadMore")}
            </button>
          )}
        </div>
      )}

      {/* References tab */}
      {activeTab === "references" && (
        <div className={panelStyles.tabContent}>
          {refsLoading ? (
            <p className={panelStyles.emptyMsg}>{t("common.loading")}</p>
          ) : refFields.length === 0 ? (
            <p className={panelStyles.emptyMsg}>{t("profile.noRefsYet")}</p>
          ) : (
            <div className={panelStyles.refList}>
              {refFields.map((field) => (
                <div key={field} className={panelStyles.refGroup}>
                  <div className={panelStyles.refFieldLabel}>{field}</div>
                  {refs[field].map((r, i) => {
                    const conf = confidenceLabel(r.confidence);
                    return (
                      <div key={i} className={panelStyles.refRow}>
                        <div className={panelStyles.refMeta}>
                          <span
                            className={panelStyles.confidenceBadge}
                            style={{ color: conf.color, borderColor: conf.color }}
                          >
                            {conf.label}
                          </span>
                          {r.sourceType && (
                            <span className={panelStyles.sourceType}>{r.sourceType.replace(/_/g, " ")}</span>
                          )}
                          <span className={panelStyles.refDate}>{formatDate(r.createdAt)}</span>
                        </div>
                        {r.extractedValue && (
                          <p className={panelStyles.refExtracted}>{r.extractedValue}</p>
                        )}
                        {r.sourceUrl && (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={panelStyles.refLink}
                          >
                            {r.sourceUrl.replace(/^https?:\/\//, "").split("/")[0]}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
