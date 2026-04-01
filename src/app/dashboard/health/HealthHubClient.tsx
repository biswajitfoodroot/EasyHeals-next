"use client";

/**
 * HealthHubClient — P5 Health Hub
 *
 * Mobile-first tab switcher: Timeline | Coach | Documents | Rewards
 * Only renders tabs whose feature flags are ON.
 * Deep-link: ?tab=coach opens Coach tab directly.
 *
 * Each tab content is lazy-loaded to minimize initial bundle.
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FlagsProvider } from "@/components/FeatureGate";

// Lazy-load heavy tab contents
const TimelineTab   = lazy(() => import("./tabs/TimelineTab").then(m => ({ default: m.TimelineTab })));
const CoachTab      = lazy(() => import("./tabs/CoachTab").then(m => ({ default: m.CoachTab })));
const DocumentsTab  = lazy(() => import("./tabs/DocumentsTab").then(m => ({ default: m.DocumentsTab })));
const RewardsTab    = lazy(() => import("./tabs/RewardsTab").then(m => ({ default: m.RewardsTab })));
const WearableTab   = lazy(() => import("./tabs/WearableTab").then(m => ({ default: m.WearableTab })));

type TabId = "timeline" | "coach" | "documents" | "rewards" | "wearable";

interface Tab {
  id: TabId;
  label: string;
  flagKey: string;
  emoji: string;
}

const ALL_TABS: Tab[] = [
  { id: "timeline",  label: "Timeline",  flagKey: "health_memory",    emoji: "📅" },
  { id: "coach",     label: "Coach",     flagKey: "ai_health_coach",  emoji: "💬" },
  { id: "documents", label: "Docs",      flagKey: "health_memory",    emoji: "📄" },
  { id: "wearable",  label: "Wearable",  flagKey: "wearable_sync",    emoji: "⌚" },
  { id: "rewards",   label: "Rewards",   flagKey: "gamification_ui",  emoji: "🏆" },
];

interface HealthHubClientProps {
  flags: Record<string, boolean>;
}

export function HealthHubClient({ flags }: HealthHubClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Only show tabs whose flag is ON
  const enabledTabs = ALL_TABS.filter((t) => flags[t.flagKey]);
  const defaultTab = (searchParams.get("tab") as TabId) ?? enabledTabs[0]?.id ?? null;
  const [activeTab, setActiveTab] = useState<TabId | null>(defaultTab);

  // Update URL when tab changes (shallow — no server round-trip)
  function switchTab(tab: TabId) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/dashboard/health?${params.toString()}`, { scroll: false });
  }

  // If no flags are enabled: show coming soon
  if (enabledTabs.length === 0) {
    return (
      <FlagsProvider flags={flags}>
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
            AI Health Features
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 300, margin: 0 }}>
            Your AI health companion is being set up. You&apos;ll get personalized health insights, document scanning, and an AI coach soon.
          </p>
        </div>
      </FlagsProvider>
    );
  }

  // Ensure activeTab is valid
  const validTab = enabledTabs.find((t) => t.id === activeTab) ? activeTab : enabledTabs[0].id;

  return (
    <FlagsProvider flags={flags}>
      <div style={{ minHeight: "100dvh", background: "#f8fafc", paddingBottom: 80 }}>
        {/* Page header */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 20px 0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            My Health
          </h1>

          {/* Horizontal tab chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {enabledTabs.map((tab) => {
              const isActive = tab.id === validTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  style={{
                    flexShrink: 0,
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: "none",
                    background: isActive ? "#0f766e" : "#f1f5f9",
                    color: isActive ? "#fff" : "#475569",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: "16px 0" }}>
          <Suspense fallback={<TabSkeleton />}>
            {validTab === "timeline"  && <TimelineTab />}
            {validTab === "coach"     && <CoachTab />}
            {validTab === "documents" && <DocumentsTab />}
            {validTab === "wearable"  && <WearableTab />}
            {validTab === "rewards"   && <RewardsTab />}
          </Suspense>
        </div>
      </div>
    </FlagsProvider>
  );
}

function TabSkeleton() {
  return (
    <div style={{ padding: "0 16px" }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          height: 72,
          background: "#e2e8f0",
          borderRadius: 12,
          marginBottom: 12,
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
