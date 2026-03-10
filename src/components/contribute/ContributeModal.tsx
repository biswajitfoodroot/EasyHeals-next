"use client";

import { useMemo, useState } from "react";

import styles from "@/components/phase1/phase1.module.css";
import type { SearchResult } from "@/components/phase1/types";

type ContributeModalProps = {
  isOpen: boolean;
  target: SearchResult | null;
  onClose: () => void;
};

const hospitalFields = [
  { key: "phone", label: "Phone Number" },
  { key: "addressLine1", label: "Address" },
  { key: "specialties", label: "Specialties" },
  { key: "feesRange", label: "Consultation Fee" },
  { key: "website", label: "Website" },
] as const;

const doctorFields = [
  { key: "phone", label: "Phone Number" },
  { key: "specialization", label: "Specialization" },
  { key: "specialties", label: "Specialties" },
  { key: "consultationFee", label: "Consultation Fee" },
  { key: "qualifications", label: "Qualifications" },
] as const;

export function ContributeModal({ isOpen, target, onClose }: ContributeModalProps) {
  const fields = target?.type === "doctor" ? doctorFields : hospitalFields;
  const [field, setField] = useState<(typeof hospitalFields)[number]["key"] | (typeof doctorFields)[number]["key"]>("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);

  const selectedField = useMemo(() => fields.find((item) => item.key === field) ?? fields[0], [field, fields]);

  if (!isOpen || !target) return null;

  async function submitContribution() {
    if (!target) return;

    if (!value.trim()) {
      alert("Please enter updated value.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        targetType: target.type,
        targetId: target.id,
        fieldChanged: field,
        oldValue: null,
        newValue:
          field === "specialties" || field === "qualifications"
            ? value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : field === "consultationFee"
              ? Number(value)
              : value,
        changeType: "update",
        contributorId: undefined,
        sourceReason: reason,
      };

      const response = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        status?: string;
        reason?: string;
        outlier?: { score: number };
      };

      if (!response.ok) {
        setResponseText(data.reason ?? "Contribution rejected by AI checks.");
        return;
      }

      setResponseText(`Edit submitted. Status: ${data.status}. Outlier score: ${data.outlier?.score ?? "n/a"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h3>Suggest an Edit</h3>
            <p>RC#3 Crowd-Sourced Listings + AI Outlier Detection</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalTarget}>
            Target: <strong>{target.name}</strong>
          </p>

          <div className={styles.fieldGrid}>
            {fields.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === field ? styles.fieldActive : ""}
                onClick={() => setField(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label>
            New {selectedField.label}
            <input value={value} onChange={(event) => setValue(event.target.value)} />
          </label>

          <label>
            Source / Reason (optional)
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>

          <div className={styles.aiHint}>
            AI outlier scoring is active. Low-risk edits may auto-approve; risky edits go to moderation.
          </div>

          <div className={styles.inlineButtons}>
            <button type="button" onClick={submitContribution} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Edit"}
            </button>
          </div>

          {responseText ? <p className={styles.responseText}>{responseText}</p> : null}
        </div>
      </div>
    </div>
  );
}
