"use client";

/**
 * PortalShell — mobile-aware wrapper for the Provider Portal layout.
 * Mirrors AdminShell/PMShell: hamburger top-bar on mobile, slide-in sidebar overlay,
 * sticky sidebar on desktop (lg+).
 */
import { useState } from "react";

interface PortalShellProps {
  nav: React.ReactNode;
  children: React.ReactNode;
}

export function PortalShell({ nav, children }: PortalShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span
          className="font-black text-lg"
          style={{ color: "#1B8A4A", fontFamily: "var(--font-bricolage), sans-serif" }}
        >
          EasyHeals
        </span>
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Portal</span>
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0 lg:z-auto lg:transition-none",
        ].join(" ")}
      >
        <div className="lg:hidden absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {nav}
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
