export default function TreatmentsLoading() {
  return (
    <div style={{ minHeight: "100dvh", background: "#fff", padding: "76px 16px 28px" }}>
      {/* Hero + search skeleton */}
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto", borderRadius: "20px", border: "1.5px solid #D0E4D8", background: "linear-gradient(135deg, #F8FAF9, #EDF5F0)", padding: "20px" }}>
        <div style={{ width: "100px", height: "20px", borderRadius: "999px", background: "#D0E4D8", marginBottom: "12px" }} className="animate-pulse" />
        <div style={{ width: "50%", height: "36px", borderRadius: "10px", background: "#D0E4D8", marginBottom: "10px" }} className="animate-pulse" />
        <div style={{ width: "70%", height: "16px", borderRadius: "8px", background: "#E8F0EC" }} className="animate-pulse" />
        <div style={{ marginTop: "14px", height: "44px", borderRadius: "999px", background: "#D0E4D8" }} className="animate-pulse" />
      </div>

      {/* Category type pills */}
      <div style={{ width: "min(1180px, 100%)", margin: "12px auto 0", display: "flex", gap: "8px", overflowX: "hidden" }}>
        {[60, 110, 100, 90, 120, 80, 95].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: "34px", borderRadius: "999px", background: "#D0E4D8", flexShrink: 0 }} className="animate-pulse" />
        ))}
      </div>

      {/* Section heading + list skeleton */}
      <div style={{ width: "min(1180px, 100%)", margin: "16px auto 0", display: "grid", gap: "24px" }}>
        {[6, 5, 8].map((count, si) => (
          <section key={si}>
            <div style={{ width: "120px", height: "18px", borderRadius: "6px", background: "#D0E4D8", marginBottom: "12px" }} className="animate-pulse" />
            {/* Mobile: list rows */}
            <div style={{ border: "1.5px solid #D0E4D8", borderRadius: "16px", overflow: "hidden", background: "#fff" }}>
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderBottom: i < count - 1 ? "1px solid #EAF2EC" : "none" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#E8F0EC", flexShrink: 0 }} className="animate-pulse" />
                  <div style={{ flex: 1, height: "15px", borderRadius: "6px", background: "#D0E4D8", width: `${50 + Math.random() * 30}%` }} className="animate-pulse" />
                  <div style={{ width: "16px", height: "16px", borderRadius: "4px", background: "#E8F0EC", flexShrink: 0 }} className="animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
