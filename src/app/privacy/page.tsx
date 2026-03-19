"use client";

/**
 * Patient Privacy Page — Task 3.11
 *
 * Shows:
 * - Active consents with revoke buttons
 * - Lead count
 * - "Delete my account" (right to erasure, DPDP §9 G10)
 *
 * Route: /privacy
 */

import { useState, useEffect } from "react";

interface ConsentRecord {
  id: string;
  purpose: string;
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

interface PatientData {
  patient: { id: string; city: string | null; memberSince: unknown };
  consents: ConsentRecord[];
  stats: { totalLeads: number };
}

const PURPOSE_LABELS: Record<string, string> = {
  booking_lead: "Hospital Callback Requests",
  analytics: "Usage Analytics & Personalisation",
  marketing: "Marketing Communications",
  ai_health: "AI-Powered Health Tips",
  emr_access: "Medical Record Access",
  referral: "Referral Programme",
};

export default function PrivacyPage() {
  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    fetch("/api/v1/patients/me")
      .then((r) => {
        if (r.status === 401) { setNotLoggedIn(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setNotLoggedIn(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleRevoke(purpose: string) {
    setRevoking(purpose);
    try {
      const res = await fetch("/api/v1/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      if (res.ok && data) {
        setData({
          ...data,
          consents: data.consents.map((c) =>
            c.purpose === purpose
              ? { ...c, active: false, revokedAt: new Date().toISOString() }
              : c,
          ),
        });
      }
    } finally {
      setRevoking(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/patients/me", { method: "DELETE" });
      if (res.ok) setDeleted(true);
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) {
    return (
      <div className="privacy-page">
        <div className="privacy-card">
          <div className="privacy-deleted-icon">🗑️</div>
          <h1 className="privacy-heading">Account Deletion Requested</h1>
          <p className="privacy-subtext">
            Your account has been soft-deleted. All your data will be
            permanently removed within 30 days in accordance with DPDP Act 2023.
          </p>
          <p className="privacy-subtext" style={{ marginTop: 12 }}>
            You can still browse hospitals and doctors anonymously.
          </p>
          <a href="/" className="privacy-btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>
            Back to Home
          </a>
        </div>
        <PrivacyStyles />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="privacy-page">
        <div className="privacy-card privacy-loading">
          <div className="privacy-spinner" />
          <p>Loading your privacy settings…</p>
        </div>
        <PrivacyStyles />
      </div>
    );
  }

  if (notLoggedIn) {
    return (
      <div className="privacy-page">
        <div className="privacy-card">
          <div className="privacy-icon">🔒</div>
          <h1 className="privacy-heading">Privacy Settings</h1>
          <p className="privacy-subtext">
            Please verify your phone to manage your privacy settings and data.
          </p>
          <a href="/" className="privacy-btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>
            Verify Phone
          </a>
        </div>
        <PrivacyStyles />
      </div>
    );
  }

  const activeConsents = data?.consents.filter((c) => c.active) ?? [];

  return (
    <div className="privacy-page">
      <div className="privacy-card">
        <div className="privacy-icon">🔒</div>
        <h1 className="privacy-heading">Your Privacy & Data</h1>
        <p className="privacy-subtext">
          Manage your consents and data in accordance with the Digital Personal
          Data Protection Act 2023 (DPDP).
        </p>

        {/* Stats */}
        <div className="privacy-stats-row">
          <div className="privacy-stat">
            <span className="privacy-stat-value">{activeConsents.length}</span>
            <span className="privacy-stat-label">Active Consents</span>
          </div>
          <div className="privacy-stat">
            <span className="privacy-stat-value">{data?.stats.totalLeads ?? 0}</span>
            <span className="privacy-stat-label">Callback Requests</span>
          </div>
          <div className="privacy-stat">
            <span className="privacy-stat-value">{data?.patient.city ?? "—"}</span>
            <span className="privacy-stat-label">Your City</span>
          </div>
        </div>

        {/* Consent list */}
        <h2 className="privacy-section-heading">Your Active Consents</h2>

        {data?.consents.length === 0 ? (
          <p className="privacy-subtext">No consents recorded yet.</p>
        ) : (
          <div className="privacy-consent-list">
            {data?.consents.map((c) => (
              <div key={c.id} className={`privacy-consent-row ${!c.active ? "privacy-consent-revoked" : ""}`}>
                <div className="privacy-consent-info">
                  <span className="privacy-consent-name">
                    {PURPOSE_LABELS[c.purpose] ?? c.purpose}
                  </span>
                  <span className="privacy-consent-date">
                    {c.active
                      ? `Granted ${c.grantedAt ? new Date(c.grantedAt).toLocaleDateString("en-IN") : "—"}`
                      : `Revoked ${c.revokedAt ? new Date(c.revokedAt).toLocaleDateString("en-IN") : "—"}`}
                  </span>
                </div>
                {c.active && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(c.purpose)}
                    disabled={revoking === c.purpose}
                    className="privacy-revoke-btn"
                  >
                    {revoking === c.purpose ? "Revoking…" : "Revoke"}
                  </button>
                )}
                {!c.active && (
                  <span className="privacy-revoked-badge">Revoked</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* DPDP rights */}
        <div className="privacy-rights-box">
          <h2 className="privacy-section-heading" style={{ marginTop: 0 }}>
            Your Rights under DPDP Act 2023
          </h2>
          <ul className="privacy-rights-list">
            <li>✓ Right to access your personal data</li>
            <li>✓ Right to correct inaccurate information</li>
            <li>✓ Right to erasure (delete account below)</li>
            <li>✓ Right to revoke consent at any time</li>
            <li>✓ Right to grievance redressal</li>
          </ul>
          <p className="privacy-contact">
            Questions? Email us at{" "}
            <a href="mailto:privacy@easyheals.com">privacy@easyheals.com</a>
          </p>
        </div>

        {/* Delete account */}
        <div className="privacy-delete-zone">
          <h2 className="privacy-section-heading" style={{ color: "#b91c1c", marginTop: 0 }}>
            Delete My Account
          </h2>
          <p className="privacy-subtext">
            Deletes your account and all associated data. This action schedules
            permanent deletion within 30 days. You can re-register with the same
            phone after deletion.
          </p>
          {!deleteConfirm ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="privacy-delete-btn"
            >
              Delete My Account
            </button>
          ) : (
            <div className="privacy-delete-confirm">
              <p className="privacy-delete-warning">
                ⚠️ This will soft-delete your account. Are you sure?
              </p>
              <div className="privacy-delete-actions">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="privacy-delete-confirm-btn"
                >
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="privacy-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <PrivacyStyles />
    </div>
  );
}

function PrivacyStyles() {
  return (
    <style>{`
      .privacy-page {
        min-height: 100vh;
        background: #f8fafc;
        padding: 40px 16px;
        display: flex;
        justify-content: center;
      }

      .privacy-card {
        background: #fff;
        border-radius: 20px;
        box-shadow: 0 2px 24px rgba(0,0,0,0.07);
        padding: 32px 28px;
        width: 100%;
        max-width: 600px;
        height: fit-content;
      }

      .privacy-icon, .privacy-deleted-icon {
        font-size: 2.5rem;
        text-align: center;
        display: block;
        margin-bottom: 12px;
      }

      .privacy-heading {
        font-size: 1.5rem;
        font-weight: 800;
        color: #111827;
        margin: 0 0 10px;
        text-align: center;
      }

      .privacy-subtext {
        font-size: 0.9375rem;
        color: #4b5563;
        line-height: 1.65;
        margin: 0 0 24px;
        text-align: center;
      }

      .privacy-stats-row {
        display: flex;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 28px;
      }

      .privacy-stat {
        flex: 1;
        text-align: center;
        padding: 14px 8px;
        border-right: 1px solid #e5e7eb;
      }

      .privacy-stat:last-child { border-right: none; }

      .privacy-stat-value {
        display: block;
        font-size: 1.375rem;
        font-weight: 800;
        color: #111827;
      }

      .privacy-stat-label {
        display: block;
        font-size: 0.7rem;
        color: #9ca3af;
        margin-top: 2px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .privacy-section-heading {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #374151;
        margin: 0 0 14px;
      }

      .privacy-consent-list {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 24px;
      }

      .privacy-consent-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
        gap: 12px;
      }

      .privacy-consent-row:last-child { border-bottom: none; }

      .privacy-consent-revoked {
        opacity: 0.5;
      }

      .privacy-consent-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .privacy-consent-name {
        font-size: 0.9rem;
        font-weight: 600;
        color: #111827;
      }

      .privacy-consent-date {
        font-size: 0.75rem;
        color: #9ca3af;
      }

      .privacy-revoke-btn {
        background: none;
        border: 1.5px solid #fca5a5;
        color: #dc2626;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 8px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
        font-family: inherit;
      }

      .privacy-revoke-btn:hover:not(:disabled) {
        background: #fef2f2;
      }

      .privacy-revoke-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .privacy-revoked-badge {
        font-size: 0.75rem;
        color: #9ca3af;
        font-weight: 600;
        background: #f3f4f6;
        padding: 4px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }

      .privacy-rights-box {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 24px;
      }

      .privacy-rights-list {
        font-size: 0.875rem;
        color: #166534;
        padding-left: 0;
        list-style: none;
        margin: 0 0 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .privacy-contact {
        font-size: 0.8125rem;
        color: #4b5563;
        margin: 0;
      }

      .privacy-contact a { color: #2563eb; }

      .privacy-delete-zone {
        background: #fff5f5;
        border: 1px solid #fecaca;
        border-radius: 14px;
        padding: 20px;
      }

      .privacy-delete-btn {
        background: none;
        border: 1.5px solid #dc2626;
        color: #dc2626;
        font-size: 0.9rem;
        font-weight: 700;
        padding: 10px 20px;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.15s;
        font-family: inherit;
      }

      .privacy-delete-btn:hover { background: #fef2f2; }

      .privacy-delete-warning {
        font-size: 0.875rem;
        color: #991b1b;
        margin: 0 0 14px;
        font-weight: 600;
      }

      .privacy-delete-actions { display: flex; gap: 10px; flex-wrap: wrap; }

      .privacy-delete-confirm-btn {
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 10px 18px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s;
        font-family: inherit;
      }

      .privacy-delete-confirm-btn:hover:not(:disabled) { background: #b91c1c; }
      .privacy-delete-confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .privacy-cancel-btn {
        background: none;
        border: 1.5px solid #d1d5db;
        color: #6b7280;
        border-radius: 10px;
        padding: 10px 18px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .privacy-loading {
        text-align: center;
        padding: 60px 28px;
      }

      .privacy-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e5e7eb;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: privSpin 0.7s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes privSpin { to { transform: rotate(360deg); } }

      .privacy-btn-primary {
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 12px 24px;
        font-size: 0.9375rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        text-decoration: none;
      }
    `}</style>
  );
}
