"use client";

/**
 * BottomSheet — Mobile-first sheet overlay / Right-side drawer on desktop
 *
 * Mobile (< 640px):  slides up from bottom, spring animation, swipe-down to dismiss
 * Desktop (≥ 640px): renders as right-side drawer panel (560px max width)
 *
 * Features:
 * - Drag handle + swipe-down gesture to close
 * - Background scroll locked when open
 * - Focus trap (Tab cycles within sheet)
 * - Click backdrop to close (optional via closeOnBackdrop prop)
 * - Spring animation: cubic-bezier(0.34, 1.56, 0.64, 1) — bouncy feel
 * - Safe area insets support (iOS notch/home bar)
 * - Headless (no design opinions on content — caller owns the content)
 *
 * RN-ready pattern: core logic is gesture-driven; no DOM-specific APIs in props.
 *
 * Usage:
 *   <BottomSheet open={open} onClose={() => setOpen(false)} title="Upload Document">
 *     <DocumentUploader />
 *   </BottomSheet>
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  closeOnBackdrop?: boolean;          // default: true
  fullHeight?: boolean;               // force full viewport height (for chat, document viewer)
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  closeOnBackdrop = true,
  fullHeight = false,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const el = sheetRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (focusable.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    first?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Swipe-down to dismiss (touch + pointer events)
  function onDragStart(clientY: number) {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartTime.current = Date.now();
    setDragY(0);
  }

  function onDragMove(clientY: number) {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) setDragY(delta); // only allow downward drag
  }

  function onDragEnd(clientY: number) {
    if (!isDragging) return;
    setIsDragging(false);
    const delta = clientY - dragStartY.current;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = delta / elapsed; // px/ms

    // Dismiss if: dragged > 120px OR fast flick (velocity > 0.5 px/ms)
    if (delta > 120 || velocity > 0.5) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0); // spring back
    }
  }

  if (!open) return null;

  const sheetStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9000,
    background: "#fff",
    borderRadius: "20px 20px 0 0",
    boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
    maxHeight: fullHeight ? "100dvh" : "92dvh",
    display: "flex",
    flexDirection: "column",
    paddingBottom: "env(safe-area-inset-bottom, 16px)",
    transform: isDragging ? `translateY(${dragY}px)` : "translateY(0)",
    transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
    animation: isDragging ? "none" : "sheetSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
    touchAction: "none",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 8999,
          background: "rgba(15,23,42,0.5)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Sheet"}
        style={sheetStyle}
        className="eh-bottom-sheet"
      >
        {/* Drag handle area */}
        <div
          style={{ padding: "12px 20px 0", cursor: "grab", flexShrink: 0 }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onDragStart(e.clientY); }}
          onPointerMove={(e) => onDragMove(e.clientY)}
          onPointerUp={(e) => onDragEnd(e.clientY)}
          onPointerCancel={() => { setIsDragging(false); setDragY(0); }}
        >
          <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto" }} />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div style={{ padding: "14px 20px 10px", flexShrink: 0, borderBottom: "1px solid #f1f5f9" }}>
            {title && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>}
          </div>
        )}

        {/* Content (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Desktop: right drawer instead of bottom sheet */
        @media (min-width: 640px) {
          .eh-bottom-sheet {
            left: auto !important;
            right: 0 !important;
            bottom: 0 !important;
            top: 0 !important;
            width: min(480px, 95vw) !important;
            max-height: 100dvh !important;
            border-radius: 20px 0 0 20px !important;
            box-shadow: -8px 0 40px rgba(0,0,0,0.12) !important;
            animation: drawerSlideIn 0.3s cubic-bezier(0.34,1.2,0.64,1) !important;
          }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
