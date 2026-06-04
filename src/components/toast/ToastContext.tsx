"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, string> = {
  success: "✅",
  error:   "❌",
  info:    "ℹ️",
  warning: "⚠️",
};

const COLORS: Record<ToastVariant, { bg: string; border: string; color: string }> = {
  success: { bg: "#E6F5EC", border: "#1B8A4A", color: "#0d3d22" },
  error:   { bg: "#FEE2E2", border: "#DC2626", color: "#7f1d1d" },
  info:    { bg: "#DBEAFE", border: "#2563EB", color: "#1e3a8a" },
  warning: { bg: "#FEF3C7", border: "#D97706", color: "#78350f" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timerRefs.current[id]);
    delete timerRefs.current[id];
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
    timerRefs.current[id] = setTimeout(() => remove(id), 3800);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack — sits above bottom nav on mobile, above page on desktop */}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          bottom: "calc(var(--mobile-nav-height, 64px) + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "min(420px, calc(100vw - 32px))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const c = COLORS[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: c.bg,
                border: `1.5px solid ${c.border}`,
                color: c.color,
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                fontFamily: "var(--font-bricolage), sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                pointerEvents: "auto",
                animation: "toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{ICONS[t.variant]}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => remove(t.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.color, opacity: 0.6, padding: "0 2px", fontSize: "18px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
