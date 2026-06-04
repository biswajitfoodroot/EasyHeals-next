export default function DashboardLoading() {
  return (
    <div style={{ height: "100dvh", display: "flex", overflow: "hidden", background: "#f8fafc" }}>
      {/* Sidebar skeleton — desktop only */}
      <aside style={{ width: "56px", background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px", padding: "12px 8px", flexShrink: 0 }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#D0E4D8" }} className="animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#E8F0EC" }} className="animate-pulse" />
        ))}
      </aside>

      {/* Main content skeleton */}
      <main style={{ flex: 1, overflow: "hidden", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "800px" }}>
        {/* Greeting */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ width: "180px", height: "24px", borderRadius: "8px", background: "#D0E4D8" }} className="animate-pulse" />
            <div style={{ width: "120px", height: "14px", borderRadius: "6px", background: "#E8F0EC" }} className="animate-pulse" />
          </div>
          <div style={{ width: "80px", height: "32px", borderRadius: "10px", background: "#D0E4D8" }} className="animate-pulse" />
        </div>

        {/* Upcoming appointment card */}
        <div style={{ borderRadius: "16px", background: "#fff", border: "1.5px solid #D0E4D8", padding: "16px", display: "grid", gap: "12px" }}>
          <div style={{ width: "60%", height: "18px", borderRadius: "6px", background: "#D0E4D8" }} className="animate-pulse" />
          <div style={{ width: "40%", height: "14px", borderRadius: "6px", background: "#E8F0EC" }} className="animate-pulse" />
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ height: "40px", flex: 1, borderRadius: "12px", background: "#1B8A4A", opacity: 0.2 }} className="animate-pulse" />
            <div style={{ height: "40px", flex: 1, borderRadius: "12px", background: "#D0E4D8" }} className="animate-pulse" />
          </div>
        </div>

        {/* Quick actions grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ borderRadius: "14px", background: "#fff", border: "1.5px solid #D0E4D8", padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#E8F0EC" }} className="animate-pulse" />
              <div style={{ width: "60%", height: "12px", borderRadius: "4px", background: "#D0E4D8" }} className="animate-pulse" />
            </div>
          ))}
        </div>

        {/* Recent activity rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ borderRadius: "14px", background: "#fff", border: "1.5px solid #D0E4D8", padding: "14px", display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#E8F0EC", flexShrink: 0 }} className="animate-pulse" />
            <div style={{ flex: 1, display: "grid", gap: "6px" }}>
              <div style={{ height: "15px", borderRadius: "6px", background: "#D0E4D8", width: "55%" }} className="animate-pulse" />
              <div style={{ height: "12px", borderRadius: "6px", background: "#E8F0EC", width: "35%" }} className="animate-pulse" />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
