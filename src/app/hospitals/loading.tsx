import styles from "@/components/profiles/profiles.module.css";

export default function HospitalsLoading() {
  return (
    <div className={styles.directoryPage}>
      {/* Hero skeleton */}
      <div className={styles.directoryHero} style={{ marginBottom: 0 }}>
        <div className="animate-pulse" style={{ width: "60%", height: "38px", borderRadius: "10px", background: "rgba(255,255,255,0.35)", marginBottom: "10px" }} />
        <div className="animate-pulse" style={{ width: "80%", height: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.25)", marginBottom: "14px" }} />
        {/* Search bar skeleton */}
        <div className="animate-pulse" style={{ height: "48px", borderRadius: "999px", background: "rgba(255,255,255,0.35)" }} />
        {/* Stats pills skeleton */}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          {[90, 70, 110].map((w, i) => (
            <div key={i} className="animate-pulse" style={{ width: `${w}px`, height: "28px", borderRadius: "999px", background: "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      </div>

      {/* Controls skeleton */}
      <div style={{ width: "min(1180px, 100%)", margin: "12px auto 0", display: "flex", gap: "8px", alignItems: "center" }}>
        <div className="animate-pulse" style={{ flex: 1, height: "44px", borderRadius: "999px", background: "#D0E4D8" }} />
        {[80, 80].map((w, i) => (
          <div key={i} className="animate-pulse" style={{ width: `${w}px`, height: "44px", borderRadius: "999px", background: "#D0E4D8" }} />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className={styles.directoryGrid} style={{ marginTop: "14px" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.directoryCard} style={{ borderTopColor: "#D0E4D8" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div className="animate-pulse" style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#D0E4D8", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "grid", gap: "6px" }}>
                <div className="animate-pulse" style={{ height: "15px", borderRadius: "6px", background: "#D0E4D8", width: "70%" }} />
                <div className="animate-pulse" style={{ height: "12px", borderRadius: "6px", background: "#E8F0EC", width: "50%" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[60, 80, 70].map((w, j) => (
                <div key={j} className="animate-pulse" style={{ width: `${w}px`, height: "22px", borderRadius: "6px", background: "#E8F0EC" }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div className="animate-pulse" style={{ height: "44px", borderRadius: "999px", background: "#D0E4D8" }} />
              <div className="animate-pulse" style={{ height: "44px", borderRadius: "999px", background: "#1B8A4A", opacity: 0.2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
