"use client";

// Auth is handled by middleware.ts — redirects to /login?next={path} if no session.
// P5: SessionHealthProvider adds sliding window re-auth modal (no redirect on expiry).
import { SessionHealthProvider } from "@/components/SessionHealthProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionHealthProvider>{children}</SessionHealthProvider>;
}
