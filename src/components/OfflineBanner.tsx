"use client";

import { useState, useEffect } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setOffline(true);
      setWasOffline(true);
      setShowBack(false);
    }

    function handleOnline() {
      setOffline(false);
      if (wasOffline) {
        setShowBack(true);
        const t = setTimeout(() => setShowBack(false), 3000);
        return () => clearTimeout(t);
      }
    }

    // Initialise from current state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setWasOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, [wasOffline]);

  if (!offline && !showBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 66,          // just below the fixed nav header
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9995,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "9px 18px",
        borderRadius: "999px",
        fontFamily: "var(--font-bricolage), sans-serif",
        fontSize: "13px",
        fontWeight: 700,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        whiteSpace: "nowrap",
        animation: "toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        ...(offline
          ? { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" }
          : { background: "#E6F5EC", color: "#0d3d22", border: "1.5px solid #1B8A4A" }),
      }}
    >
      {offline ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          You&apos;re offline
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B8A4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Back online
        </>
      )}
    </div>
  );
}
