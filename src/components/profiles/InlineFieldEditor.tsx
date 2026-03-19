"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "@/i18n/LocaleContext";
import styles from "@/components/profiles/profiles.module.css";

type InlineFieldEditorProps = {
  targetType: "hospital" | "doctor";
  targetId: string;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
  onOpenHistory?: (field: string) => void;
};

function toContributionValue(field: string, value: string): unknown {
  if (["specialties", "qualifications", "languages"].includes(field.toLowerCase())) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (["consultationfee", "feemin", "feemax"].includes(field.toLowerCase())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

export function InlineFieldEditor({
  targetType,
  targetId,
  field,
  label,
  value,
  multiline,
  onOpenHistory,
}: InlineFieldEditorProps) {
  const { t } = useTranslations();
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const hasValue = useMemo(() => value.trim().length > 0, [value]);

  async function submitEdit() {
    if (!draft.trim() || busy) return;

    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          fieldChanged: field,
          oldValue: value,
          newValue: toContributionValue(field, draft),
          changeType: "update",
        }),
      });

      const body = (await response.json()) as {
        status?: string;
        reason?: string;
      };

      if (!response.ok) {
        setStatus(body.reason ?? "Edit could not be submitted.");
        return;
      }

      setStatus(body.status === "auto_approve" ? "Auto-approved" : "Edit submitted - under review");
      setOpen(false);
    } catch {
      setStatus("Edit submission failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.inlineField}>
      <div className={styles.fieldHead}>
        <div>
          <p className={styles.fieldLabel}>{label}</p>
          <p className={styles.fieldValue}>{hasValue ? value : t("common.notAvailable")}</p>
        </div>
        <div className={styles.fieldActions}>
          <button type="button" onClick={() => setOpen((prev) => !prev)} aria-label={`${t("common.edit")} ${label}`}>
            ? {t("common.edit")}
          </button>
          {onOpenHistory ? (
            <button type="button" onClick={() => onOpenHistory(field)}>{t("common.editHistory")}</button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className={styles.inlineEditor}>
          {multiline ? (
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
          ) : (
            <input value={draft} onChange={(event) => setDraft(event.target.value)} />
          )}
          <div className={styles.inlineEditorButtons}>
            <button className={styles.saveBtn} type="button" onClick={submitEdit} disabled={busy}>
              {busy ? t("common.submitting") : t("common.submit")}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {status ? <p className={styles.statusText}>{status}</p> : null}
    </div>
  );
}
