export default function DoctorsLoading() {
  return (
    <div style={{ minHeight: "100dvh", background: "#fff", padding: "76px 16px 28px" }}>
      {/* Hero skeleton */}
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto", borderRadius: "20px", border: "1.5px solid #D0E4D8", background: "linear-gradient(135deg, #F8FAF9, #EDF5F0)", padding: "20px" }}>
        <div style={{ width: "60px", height: "20px", borderRadius: "999px", background: "#D0E4D8", marginBottom: "12px" }} className="animate-pulse" />
        <div style={{ width: "55%", height: "36px", borderRadius: "10px", background: "#D0E4D8", marginBottom: "10px" }} className="animate-pulse" />
        <div style={{ width: "75%", height: "16px", borderRadius: "8px", background: "#E8F0EC" }} className="animate-pulse" />
        <div style={{ marginTop: "14px", height: "44px", borderRadius: "999px", background: "#D0E4D8" }} className="animate-pulse" />
      </div>

      {/* Filter pills skeleton */}
      <div style={{ width: "min(1180px, 100%)", margin: "12px auto 0", display: "flex", gap: "8px", overflowX: "hidden" }}>
        {[90, 120, 80, 105, 95, 110].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: "34px", borderRadius: "999px", background: "#D0E4D8", flexShrink: 0 }} className="animate-pulse" />
        ))}
      </div>

      {/* Doctor card grid skeleton — shows as list rows on mobile */}
      <div style={{ width: "min(1180px, 100%)", margin: "14px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ borderRadius: "16px", border: "1.5px solid #D0E4D8", background: "#fff", padding: "14px", display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#D0E4D8" }} className="animate-pulse" />
              <div style={{ flex: 1, display: "grid", gap: "6px" }}>
                <div style={{ height: "15px", borderRadius: "6px", background: "#D0E4D8", width: "65%" }} className="animate-pulse" />
                <div style={{ height: "12px", borderRadius: "6px", background: "#E8F0EC", width: "45%" }} className="animate-pulse" />
              </div>
            </div>
            <div style={{ height: "12px", borderRadius: "6px", background: "#E8F0EC", width: "80%" }} className="animate-pulse" />
            <div style={{ display: "flex", gap: "6px" }}>
              {[70, 90].map((w, j) => (
                <div key={j} style={{ width: `${w}px`, height: "22px", borderRadius: "6px", background: "#E8F0EC" }} className="animate-pulse" />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ height: "36px", borderRadius: "12px", background: "#D0E4D8" }} className="animate-pulse" />
              <div style={{ height: "36px", borderRadius: "12px", background: "#1B8A4A", opacity: 0.2 }} className="animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
