"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/hospitals",
    label: "Hospitals",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" /><path d="M3 21h18" /><path d="M9 21V12h6v9" /><path d="M12 7v3m-1.5-1.5h3" />
      </svg>
    ),
  },
  {
    href: "/doctors",
    label: "Doctors",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3" /><path d="M6.5 20a5.5 5.5 0 0111 0" /><path d="M14 15h2a2 2 0 012 2v1" />
      </svg>
    ),
  },
  {
    href: "/treatments",
    label: "Treatments",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7l-1 1-4-4 1-1a2 2 0 012.83 0l1.17 1.17A2 2 0 0119 7z" /><path d="M14 8L5 17l-2 4 4-2 9-9" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "My Health",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Hide on admin, portal, and provider-management pages
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/provider-management")
  ) {
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
        display: "flex",
        alignItems: "stretch",
        boxShadow: "0 -2px 16px rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
              gap: "3px",
              padding: "10px 4px 8px",
              textDecoration: "none",
              color: isActive ? "#0f766e" : "#64748b",
              fontSize: "10px",
              fontWeight: isActive ? 700 : 500,
              transition: "color 0.15s",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: isActive ? "rgba(15,118,110,0.1)" : "transparent",
                transition: "background 0.15s",
              }}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
