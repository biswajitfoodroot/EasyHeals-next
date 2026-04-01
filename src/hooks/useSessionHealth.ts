"use client";

/**
 * useSessionHealth — patient session expiry monitor
 *
 * Polls /api/v1/auth/session-status every 4 minutes.
 * Triggers re-auth modal when session has < WARNING_THRESHOLD minutes remaining.
 * BroadcastChannel syncs across tabs so only one tab shows the modal.
 *
 * Returns:
 *   { minutesRemaining, showReauth, onReauthSuccess }
 */

import { useState, useEffect, useCallback, useRef } from "react";

const POLL_INTERVAL_MS = 4 * 60 * 1000;       // check every 4 minutes
const WARNING_THRESHOLD_MIN = 10;               // show modal when < 10 min left
const CHANNEL_NAME = "easyheals-session";       // BroadcastChannel name

interface SessionStatus {
  valid: boolean;
  expiresAt?: string;
  minutesRemaining?: number;
  maxTtlExpiresAt?: string;
  code?: string;
}

interface BroadcastMsg {
  type: "SESSION_RENEWED" | "SESSION_EXPIRED" | "SESSION_WARNING";
  tabId: string;
}

export interface SessionHealthState {
  minutesRemaining: number | null;
  showReauth: boolean;
  isExpired: boolean;
  onReauthSuccess: () => void;
  dismissWarning: () => void;
}

export function useSessionHealth(): SessionHealthState {
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [showReauth, setShowReauth] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const tabId = useRef<string>(typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36));
  const channelRef = useRef<BroadcastChannel | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session-status", {
        cache: "no-store",
        credentials: "include",
      });
      const data: SessionStatus = await res.json();

      if (!data.valid) {
        setIsExpired(true);
        setShowReauth(true);
        setMinutesRemaining(0);
        channelRef.current?.postMessage({
          type: "SESSION_EXPIRED",
          tabId: tabId.current,
        } satisfies BroadcastMsg);
        return;
      }

      const mins = data.minutesRemaining ?? 999;
      setMinutesRemaining(mins);

      if (mins < WARNING_THRESHOLD_MIN) {
        setShowReauth(true);
        channelRef.current?.postMessage({
          type: "SESSION_WARNING",
          tabId: tabId.current,
        } satisfies BroadcastMsg);
      }
    } catch {
      // Network error — don't show modal, assume session OK
    }
  }, []);

  const onReauthSuccess = useCallback(() => {
    setShowReauth(false);
    setIsExpired(false);
    setMinutesRemaining(null);
    channelRef.current?.postMessage({
      type: "SESSION_RENEWED",
      tabId: tabId.current,
    } satisfies BroadcastMsg);
    // Re-check immediately after re-auth
    void checkSession();
  }, [checkSession]);

  const dismissWarning = useCallback(() => {
    setShowReauth(false);
  }, []);

  useEffect(() => {
    // Set up BroadcastChannel (skip in environments that don't support it)
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<BroadcastMsg>) => {
        const msg = event.data;
        if (msg.tabId === tabId.current) return; // ignore our own messages

        if (msg.type === "SESSION_RENEWED") {
          setShowReauth(false);
          setIsExpired(false);
          void checkSession();
        } else if (msg.type === "SESSION_EXPIRED") {
          setIsExpired(true);
          setShowReauth(true);
        }
      };

      return () => channel.close();
    }
  }, [checkSession]);

  useEffect(() => {
    // Initial check after a short delay (don't fire on page load flash)
    const initialDelay = setTimeout(() => void checkSession(), 5_000);
    const interval = setInterval(() => void checkSession(), POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [checkSession]);

  return { minutesRemaining, showReauth, isExpired, onReauthSuccess, dismissWarning };
}
