"use client";

/**
 * AdminShell — mobile-aware wrapper for the admin layout.
 * Renders a hamburger top-bar on mobile (<lg), a slide-in sidebar overlay,
 * and the standard sticky sidebar on desktop (lg+).
 */
import { useState } from "react";

interface AdminShellProps {
  nav: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({ nav, children }: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Mobile top bar (hidden on lg+) ──────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 border-b border-slate-700/60 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-white font-black text-lg" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
          EasyHeals
        </span>
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Admin</span>
      </div>

      {/* ── Backdrop (mobile only, when open) ───────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/* Desktop: static sticky | Mobile: fixed slide-in overlay */}
      <div
        className={[
          // mobile: fixed overlay, slides in/out
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          // desktop: static, always visible
          "lg:static lg:translate-x-0 lg:z-auto lg:transition-none",
        ].join(" ")}
      >
        {/* Close button inside sidebar on mobile */}
        <div className="lg:hidden absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
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
