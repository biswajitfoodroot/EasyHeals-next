// Auth is handled by middleware.ts — redirects to /login?next={path} if no session.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
