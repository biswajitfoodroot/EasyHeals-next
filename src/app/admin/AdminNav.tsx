"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

type NavProps = {
  me: { fullName: string; email: string; role: string };
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  advisor: "bg-teal-100 text-teal-700",
  viewer: "bg-slate-100 text-slate-500",
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  roles?: string[];
};

const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: "⚡", exact: true },
    ],
  },
  {
    heading: "Data & Content",
    items: [
      { href: "/admin?tab=ingestion", label: "Ingestion", icon: "🤖" },
      { href: "/admin?tab=hospitals", label: "Hospitals", icon: "🏥" },
      { href: "/admin?tab=taxonomy", label: "Taxonomy", icon: "🏷️" },
      { href: "/admin?tab=ai_research", label: "AI Research", icon: "🔍" },
      { href: "/admin?tab=brochure", label: "Brochure Extract", icon: "📄" },
    ],
  },
  {
    heading: "Community & Moderation",
    items: [
      { href: "/admin?tab=contributions", label: "Contributions", icon: "✏️" },
      { href: "/admin/audit-log", label: "Audit Log", icon: "📋" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/admin/access", label: "Access & Users", icon: "👥", roles: ["owner", "admin"] },
    ],
  },
];

export function AdminNav({ me }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    if (item.href.includes("?")) return false; // tab links not highlighted by pathname
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-900 border-r border-slate-700/60 overflow-y-auto">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-700/60">
        <Link href="/admin" className="flex items-center gap-2 no-underline">
          <span className="text-xl font-black text-white" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
            EasyHeals
          </span>
        </Link>
        <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-widest">Admin Console</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(me.role),
          );
          if (!visibleItems.length) return null;
          return (
            <div key={gi}>
              {group.heading ? (
                <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {group.heading}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                      isActive(item)
                        ? "bg-teal-600 text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-700/60">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {me.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{me.fullName}</p>
            <p className="text-[10px] text-slate-400 truncate">{me.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              ROLE_COLORS[me.role] ?? "bg-slate-700 text-slate-300"
            }`}
          >
            {me.role}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
