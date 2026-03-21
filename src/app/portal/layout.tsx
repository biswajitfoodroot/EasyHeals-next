import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getAuthFromCookies } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Allow the login page to render without auth
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (pathname === "/portal/login" || pathname.startsWith("/portal/login")) {
    return <>{children}</>;
  }

  const auth = await getAuthFromCookies();

  if (!auth) {
    redirect("/portal/login");
  }

  // Admin-role users who land on /portal/* are in the wrong place.
  // Show a clear error page rather than silently redirecting to /admin.
  const adminRoles = ["owner", "admin", "advisor", "viewer", "admin_manager", "admin_editor"];
  if (adminRoles.includes(auth.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-bold text-slate-800">Wrong Portal</h1>
          <p className="text-sm text-slate-600">
            You are signed in as an <strong>EasyHeals admin</strong> ({auth.role}).
            The Provider Portal is only for hospital admins and doctors.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <a
              href="/admin"
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors text-center"
            >
              Go to Admin Panel →
            </a>
            <a
              href="/portal/login"
              className="w-full py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-colors text-center"
            >
              Sign in with a different account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
