"use client";

/**
 * ConsentModal — Task 3.1
 *
 * DPDP-compliant consent modal. Key rules:
 * - CANNOT be dismissed by clicking outside or pressing Escape
 * - Two clear choices: "I Agree & Continue" | "No Thanks"
 * - Analytics checkbox is UNCHECKED by default (DPDP rule — cannot pre-tick)
 * - "No Thanks" exits the form entirely (no PII captured)
 * - Mobile: full-screen overlay (no card, full viewport)
 *
 * Ref: PLAN.md UX-1, HLD §2.3, ARCHITECTURE.md §A
 */

import { useState } from "react";

interface ConsentModalProps {
  hospitalName: string;
  onAgree: (includeAnalytics: boolean) => void;
  onDecline: () => void;
}

export default function ConsentModal({
  hospitalName,
  onAgree,
  onDecline,
}: ConsentModalProps) {
  const [includeAnalytics, setIncludeAnalytics] = useState(false); // MUST default false per DPDP
  const [loading, setLoading] = useState(false);

  async function handleAgree() {
    setLoading(true);
    try {
      await onAgree(includeAnalytics);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="eh-consent-overlay"
      // Intentionally no onClick — modal cannot be dismissed by clicking outside
      aria-modal="true"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
    >
      <div className="eh-consent-card">
        {/* Header */}
        <div className="eh-consent-header">
          <span className="eh-consent-icon" aria-hidden="true">🏥</span>
          <h2 id="consent-title" className="eh-consent-title">
            Request a Callback
          </h2>
        </div>

        {/* Body */}
        <div className="eh-consent-body">
          <p id="consent-desc" className="eh-consent-desc">
            EasyHeals will share your contact with{" "}
            <strong>{hospitalName}</strong> so they can call you back to discuss
            your health query.
          </p>

          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="eh-consent-privacy-link"
          >
            📋 Read our Privacy Policy ›
          </a>

          {/* Divider */}
          <div className="eh-consent-divider" />

          {/* Analytics opt-in — intentionally unchecked */}
          <label className="eh-consent-analytics-label">
            <input
              type="checkbox"
              checked={includeAnalytics}
              onChange={(e) => setIncludeAnalytics(e.target.checked)}
              className="eh-consent-checkbox"
              id="consent-analytics-checkbox"
            />
            <span>
              Also allow EasyHeals to use my search history to show relevant
              health tips{" "}
              <span className="eh-consent-optional">(optional)</span>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="eh-consent-actions">
          <button
            type="button"
            id="consent-agree-btn"
            onClick={handleAgree}
            disabled={loading}
            className="eh-consent-btn-primary"
          >
            {loading ? (
              <span className="eh-consent-spinner" aria-hidden="true" />
            ) : null}
            {loading ? "Please wait…" : "I Agree & Continue"}
          </button>

          <button
            type="button"
            id="consent-decline-btn"
            onClick={onDecline}
            disabled={loading}
            className="eh-consent-btn-secondary"
          >
            No Thanks
          </button>
        </div>

        {/* DPDP footnote */}
        <p className="eh-consent-footnote">
          You can revoke consent at any time from your privacy settings.
        </p>
      </div>

      <style>{`
        .eh-consent-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          padding: 0;
        }

        @media (min-width: 640px) {
          .eh-consent-overlay {
            align-items: center;
            padding: 1rem;
          }
        }

        .eh-consent-card {
          background: #fff;
          border-radius: 20px 20px 0 0;
          width: 100%;
          max-width: 480px;
          padding: 24px;
          box-shadow: 0 -4px 32px rgba(0,0,0,0.18);
          animation: slideUp 0.25s ease-out;
        }

        @media (min-width: 640px) {
          .eh-consent-card {
            border-radius: 20px;
            animation: fadeIn 0.2s ease-out;
          }
        }

        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .eh-consent-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .eh-consent-icon {
          font-size: 1.5rem;
        }

        .eh-consent-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .eh-consent-body {
          margin-bottom: 20px;
        }

        .eh-consent-desc {
          font-size: 0.9375rem;
          color: #374151;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .eh-consent-privacy-link {
          font-size: 0.8125rem;
          color: #2563eb;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 16px;
        }

        .eh-consent-privacy-link:hover {
          text-decoration: underline;
        }

        .eh-consent-divider {
          height: 1px;
          background: #e5e7eb;
          margin-bottom: 16px;
        }

        .eh-consent-analytics-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.875rem;
          color: #4b5563;
          line-height: 1.5;
          cursor: pointer;
        }

        .eh-consent-checkbox {
          margin-top: 2px;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .eh-consent-optional {
          color: #9ca3af;
          font-size: 0.8125rem;
        }

        .eh-consent-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }

        .eh-consent-btn-primary {
          width: 100%;
          padding: 13px 20px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
        }

        .eh-consent-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .eh-consent-btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .eh-consent-btn-secondary {
          width: 100%;
          padding: 11px 20px;
          background: transparent;
          color: #6b7280;
          border: 1.5px solid #d1d5db;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          font-family: inherit;
        }

        .eh-consent-btn-secondary:hover:not(:disabled) {
          border-color: #9ca3af;
          color: #374151;
        }

        .eh-consent-footnote {
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
          margin: 0;
        }

        .eh-consent-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
