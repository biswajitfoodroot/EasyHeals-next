"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Pixels of pull needed to trigger refresh. Default: 72 */
  threshold?: number;
}

type PtrState = "idle" | "pulling" | "ready" | "refreshing";

export function PullToRefresh({ onRefresh, children, threshold = 72 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef   = useRef(0);
  const pullYRef    = useRef(0);
  const [state,  setState]  = useState<PtrState>("idle");
  const [pullPx, setPullPx] = useState(0);

  // Only attach on touch devices
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      // Only start pull when scrolled to top
      if (el!.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      setState("idle");
    }

    function onTouchMove(e: TouchEvent) {
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0 || el!.scrollTop > 0) {
        setPullPx(0);
        return;
      }
      // Dampen pull — feels like elastic resistance
      const damped = Math.min(threshold * 1.6, delta * 0.45);
      pullYRef.current = damped;
      setPullPx(damped);
      setState(damped >= threshold ? "ready" : "pulling");
      // Prevent native scroll bounce while pulling
      if (delta > 2) e.preventDefault();
    }

    async function onTouchEnd() {
      if (state === "ready" || pullYRef.current >= threshold) {
        setState("refreshing");
        setPullPx(40); // Hold indicator open
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(40);
        }
        try {
          await onRefresh();
        } finally {
          setState("idle");
          setPullPx(0);
        }
      } else {
        setState("idle");
        setPullPx(0);
      }
      pullYRef.current = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, threshold, state]);

  const indicatorH = pullPx;
  const progress   = Math.min(1, pullPx / threshold);
  const isSpinning = state === "refreshing";

  return (
    <div ref={containerRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, position: "relative" }}>
      {/* Pull indicator */}
      <div
        aria-hidden="true"
        style={{
          overflow: "hidden",
          height: `${indicatorH}px`,
          transition: state === "idle" ? "height 0.25s ease" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {indicatorH > 8 && (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#fff",
            border: "1.5px solid #D0E4D8",
            boxShadow: "0 2px 12px rgba(27,138,74,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: "transform 0.1s",
          }}>
            {isSpinning ? (
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="#1B8A4A" strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: "spin 0.7s linear infinite" }}
              >
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            ) : (
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="#1B8A4A" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: `rotate(${progress * 180}deg)`, transition: "transform 0.1s" }}
              >
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
