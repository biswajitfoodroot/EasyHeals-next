"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  userRole: string;
  userName: string;
  entityName?: string;
  hasActiveAgreement?: boolean;
};

type NavItem = {
  href: string;
  icon: string;
  label: string;
  exact?: boolean;
  requiresAgreement?: boolean;  // shows locked state if no active agreement
  badge?: string;
};

const HOSPITAL_NAV: NavItem[] = [
  { href: "/portal/hospital/dashboard", icon: "🏠", label: "Dashboard", exact: true },
  { href: "/portal/hospital",           icon: "🏥", label: "Edit Profile" },
  { href: "/portal/schedule",           icon: "📆", label: "Schedule" },
  { href: "/portal/queue",              icon: "🎫", label: "OPD Queue" },
  { href: "/portal/referrals",          icon: "🔀", label: "Referrals",  requiresAgreement: true },
  { href: "/portal/earnings",           icon: "💰", label: "Earnings",   requiresAgreement: true },
  { href: "/portal/payout-profile",     icon: "🏦", label: "Payout Profile", requiresAgreement: true },
  { href: "/portal/referral-settings",  icon: "⚙️", label: "Referral Settings", requiresAgreement: true },
  { href: "/portal/staff",              icon: "👥", label: "Staff" },
  { href: "/portal/subscription",       icon: "💳", label: "Subscription" },
];

const DOCTOR_NAV: NavItem[] = [
  { href: "/portal/doctor/dashboard", icon: "🏠", label: "Dashboard", exact: true },
  { href: "/portal/doctor",           icon: "✏️", label: "Edit Profile" },
  { href: "/portal/schedule",         icon: "📆", label: "Schedule" },
  { href: "/portal/referrals",          icon: "🔀", label: "Referrals",         requiresAgreement: true },
  { href: "/portal/earnings",           icon: "💰", label: "Earnings",           requiresAgreement: true },
  { href: "/portal/payout-profile",     icon: "🏦", label: "Payout Profile",     requiresAgreement: true },
  { href: "/portal/referral-settings",  icon: "⚙️", label: "Referral Settings",  requiresAgreement: true },
];

const RECEPTIONIST_NAV: NavItem[] = [
  { href: "/portal/queue",    icon: "🎫", label: "OPD Queue", exact: true },
  { href: "/portal/schedule", icon: "📆", label: "Schedule" },
];

function getNavItems(role: string): NavItem[] {
  if (role === "doctor") return DOCTOR_NAV;
  if (role === "receptionist") return RECEPTIONIST_NAV;
  return HOSPITAL_NAV;
}

export default function PortalNav({ userRole, userName, entityName, hasActiveAgreement = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  async function handleSignOut() {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/portal/login");
  }

  const navItems = getNavItems(userRole);

  return (
    <aside className="w-14 lg:w-60 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen shadow-sm overflow-y-auto">
      {/* Brand */}
      <div className="px-3 py-4 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
          style={{ background: "#1B8A4A" }}
        >
          E
        </span>
        <div className="hidden lg:block min-w-0">
          <p className="font-bold text-slate-800 text-sm leading-tight">EasyHeals</p>
          <p className="text-[10px] text-slate-400 truncate">{entityName ?? "Provider Portal"}</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const locked = item.requiresAgreement && !hasActiveAgreement;
          const active = !locked && isActive(item);

          if (locked) {
            return (
              <div
                key={item.href}
                title="Activate your EasyHeals Network agreement to unlock"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 cursor-not-allowed select-none"
              >
                <span className="text-base shrink-0 opacity-40">{item.icon}</span>
                <span className="hidden lg:flex items-center gap-1.5">
                  {item.label}
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                    LOCKED
                  </span>
                </span>
                <span className="lg:hidden text-[10px] text-slate-300">🔒</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline ${
                active
                  ? "text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              style={active ? { background: "#1B8A4A" } : {}}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className="hidden lg:block">{item.label}</span>
              {item.badge && (
                <span className="hidden lg:flex ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* EasyHeals branding footer — desktop only */}
      <div className="hidden lg:flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 shrink-0">
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
          style={{ background: "#1B8A4A" }}
        >
          E
        </span>
        <span className="text-xs font-black text-slate-600 tracking-tight">EasyHeals</span>
        <span className="ml-auto text-[10px] text-slate-400">Portal</span>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "#1B8A4A" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{userName}</p>
            <p className="text-[10px] text-slate-400 capitalize">{userRole.replace("_", " ")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="hidden lg:block mt-2 text-xs text-slate-400 hover:text-red-500 transition w-full text-left"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
