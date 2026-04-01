"use client";

/**
 * FeatureGate — client-side feature flag gate
 *
 * Renders children only when the feature flag is ON.
 * Falls back to `fallback` prop (default: null) when OFF.
 *
 * Usage:
 *   <FeatureGate flag="ai_health_coach" fallback={<ComingSoonCard feature="AI Health Coach" />}>
 *     <CoachEntryButton />
 *   </FeatureGate>
 *
 * Flags are resolved via /api/public/flags (cached, public endpoint).
 * On first load the gate shows nothing until flags are resolved (avoids flash).
 */

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";

// ── Context (optional: pre-fetch all flags at layout level) ───────────────────

type FlagsMap = Record<string, boolean>;

const FlagsContext = createContext<FlagsMap | null>(null);

export function FlagsProvider({ flags, children }: { flags: FlagsMap; children: ReactNode }) {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns whether a feature flag is enabled.
 * Reads from FlagsContext if provided; otherwise returns the `defaultValue`.
 * For runtime checking from API, use isFeatureEnabled() server-side.
 */
export function useFeatureFlag(flag: string, defaultValue = false): boolean {
  const ctx = useContext(FlagsContext);
  if (ctx) return ctx[flag] ?? defaultValue;
  return defaultValue;
}

// ── Gate component ────────────────────────────────────────────────────────────

interface FeatureGateProps {
  /** Feature flag key (e.g. "ai_health_coach") */
  flag: string;
  /** Rendered when flag is OFF. Default: nothing rendered. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ flag, fallback = null, children }: FeatureGateProps) {
  const ctx = useContext(FlagsContext);

  // If flags are in context, resolve synchronously (no flicker)
  if (ctx) {
    return ctx[flag] ? <>{children}</> : <>{fallback}</>;
  }

  // Without context: fetch flags once and resolve
  return <AsyncFeatureGate flag={flag} fallback={fallback}>{children}</AsyncFeatureGate>;
}

function AsyncFeatureGate({ flag, fallback, children }: FeatureGateProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    // Read from sessionStorage cache first (flags don't change mid-session)
    const cached = sessionStorage.getItem(`ff:${flag}`);
    if (cached !== null) {
      setEnabled(cached === "1");
      return;
    }

    fetch(`/api/public/flags?key=${encodeURIComponent(flag)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => {
        const val = !!data.enabled;
        sessionStorage.setItem(`ff:${flag}`, val ? "1" : "0");
        setEnabled(val);
      })
      .catch(() => setEnabled(false));
  }, [flag]);

  // Not yet resolved — render nothing (avoid flash of wrong content)
  if (enabled === null) return null;
  return enabled ? <>{children}</> : <>{fallback}</>;
}

// ── ComingSoonCard ─────────────────────────────────────────────────────────────

export function ComingSoonCard({ feature }: { feature: string }) {
  return (
    <div
      style={{
        padding: "24px 20px",
        textAlign: "center",
        background: "#f8fafc",
        borderRadius: 12,
        border: "1px dashed #cbd5e1",
        color: "#94a3b8",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{feature}</div>
      <div style={{ fontSize: 12 }}>Coming soon — stay tuned!</div>
    </div>
  );
}
