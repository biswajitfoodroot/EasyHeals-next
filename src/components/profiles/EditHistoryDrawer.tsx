"use client";

import { useEffect, useState } from "react";

import styles from "@/components/profiles/profiles.module.css";

type ContributionHistory = {
  id: string;
  fieldChanged: string | null;
  oldValue: unknown;
  newValue: unknown;
  status: string;
  outlierScore: number;
  rejectReason: string | null;
  createdAt: string | null;
};

type EditHistoryDrawerProps = {
  open: boolean;
  targetType: "hospital" | "doctor";
  targetId: string;
  field: string | null;
  onClose: () => void;
};

function toLabel(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function EditHistoryDrawer({ open, targetType, targetId, field, onClose }: EditHistoryDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ContributionHistory[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          targetType,
          targetId,
          status: "all",
          limit: "80",
        });

        const response = await fetch(`/api/contribute?${params.toString()}`);
        const body = (await response.json()) as { data?: ContributionHistory[] };

        if (cancelled) return;

        const filtered = (body.data ?? []).filter((item) => !field || item.fieldChanged === field);
        setItems(filtered);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [field, open, targetId, targetType]);

  if (!open) return null;

  return (
    <aside className={styles.drawerOverlay} onClick={onClose}>
      <section className={styles.drawer} onClick={(event) => event.stopPropagation()}>
        <header className={styles.drawerHeader}>
          <div>
            <h3>Edit History</h3>
            <p className={styles.fieldLabel}>{field ? `${field} changes` : "All changes"}</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.timeline}>
          {loading ? <p className={styles.fieldValue}>Loading history...</p> : null}
          {!loading && items.length === 0 ? <p className={styles.fieldValue}>No history available.</p> : null}

          {!loading
            ? items.map((item) => (
                <article key={item.id} className={styles.timelineItem}>
                  <h4>{item.fieldChanged ?? "Field update"}</h4>
                  <p>
                    <strong>Old:</strong> {toLabel(item.oldValue)}
                  </p>
                  <p>
                    <strong>New:</strong> {toLabel(item.newValue)}
                  </p>
                  <div className={styles.timelineMeta}>
                    <span>Status: {item.status}</span>
                    <span>AI Score: {item.outlierScore}</span>
                    {item.createdAt ? <span>{new Date(item.createdAt).toLocaleString()}</span> : null}
                  </div>
                  {item.rejectReason ? <p>Reason: {item.rejectReason}</p> : null}
                </article>
              ))
            : null}
        </div>
      </section>
    </aside>
  );
}
