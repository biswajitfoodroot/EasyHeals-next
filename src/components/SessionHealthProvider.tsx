"use client";

/**
 * SessionHealthProvider — wraps dashboard pages to monitor session health
 *
 * Polls session status every 4 min via useSessionHealth().
 * Shows ReauthModal when session is about to expire or has expired.
 * Preserves page state — no redirect on expiry.
 *
 * Usage: wrap in dashboard layout.tsx
 *   <SessionHealthProvider>{children}</SessionHealthProvider>
 */

import { type ReactNode } from "react";
import { useSessionHealth } from "@/hooks/useSessionHealth";
import { ReauthModal } from "./ReauthModal";

export function SessionHealthProvider({ children }: { children: ReactNode }) {
  const { minutesRemaining, showReauth, isExpired, onReauthSuccess, dismissWarning } = useSessionHealth();

  return (
    <>
      {children}
      {showReauth && (
        <ReauthModal
          isExpired={isExpired}
          minutesRemaining={minutesRemaining}
          onSuccess={onReauthSuccess}
          onDismiss={isExpired ? undefined : dismissWarning}
        />
      )}
    </>
  );
}
