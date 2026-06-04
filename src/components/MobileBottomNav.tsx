"use client";

/**
 * MobileBottomNav — 5-tab P5 navigation bar
 *
 * Tabs: Home | Find | Health | Bookings | Profile
 * - "Health" tab is the P5 hub (Timeline, Coach, Documents, Rewards)
 * - All tab icons are inline SVG (no icon library dependency — RN-ready)
 * - Active state: teal pill background behind icon
 * - Safe area insets for iOS home bar
 * - Hidden on admin, portal, provider-management routes
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslations } from "@/i18n/LocaleContext";

const NAV_ITEMS = [
  {
    href: "/",
    labelKey: "mobileNav.home",
    exact: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/ask",
    labelKey: "mobileNav.ask",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/health",
    labelKey: "mobileNav.health",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Heart with pulse line — health icon */}
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/appointments",
    labelKey: "mobileNav.bookings",
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    labelKey: "mobileNav.profile",
    exact: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const HIDDEN_PREFIXES = ["/admin", "/portal", "/provider-management", "/login", "/unauthorized", "/dashboard"];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9990,
        background: "#fff",
        borderTop: "1px solid #e2e8f0",
        alignItems: "stretch",
        boxShadow: "0 -2px 16px rgba(0,0,0,0.07)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      className="mobile-bottom-nav"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              padding: "8px 2px 10px",
              textDecoration: "none",
              color: isActive ? "#0f766e" : "#94a3b8",
              fontSize: "10px",
              fontWeight: isActive ? 700 : 500,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 32,
                borderRadius: 10,
                background: isActive ? "rgba(15,118,110,0.1)" : "transparent",
                transition: "background 0.15s",
              }}
            >
              {item.icon}
            </span>
            <span style={{ lineHeight: 1 }}>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
