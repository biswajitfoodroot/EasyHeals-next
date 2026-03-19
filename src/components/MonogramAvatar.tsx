"use client";

// Specialty → hue-based background color
const SPECIALTY_COLORS: Record<string, string> = {
  cardiology: "#ef4444",
  cardiac: "#ef4444",
  heart: "#ef4444",
  neurology: "#8b5cf6",
  neuro: "#8b5cf6",
  brain: "#8b5cf6",
  ortho: "#3b82f6",
  bone: "#3b82f6",
  joint: "#3b82f6",
  spine: "#3b82f6",
  oncology: "#f97316",
  cancer: "#f97316",
  gastro: "#84cc16",
  liver: "#84cc16",
  digestion: "#84cc16",
  derma: "#ec4899",
  skin: "#ec4899",
  gynaecology: "#d946ef",
  gynae: "#d946ef",
  women: "#d946ef",
  paediatric: "#0ea5e9",
  child: "#0ea5e9",
  pediatric: "#0ea5e9",
  pulmo: "#06b6d4",
  chest: "#06b6d4",
  respiratory: "#06b6d4",
  endo: "#f59e0b",
  diabetes: "#f59e0b",
  thyroid: "#f59e0b",
  ophtha: "#14b8a6",
  eye: "#14b8a6",
  ent: "#64748b",
  ear: "#64748b",
  psychiatry: "#a78bfa",
  mental: "#a78bfa",
  urology: "#2563eb",
  kidney: "#2563eb",
  nephro: "#2563eb",
  general: "#1B8A4A",
  physician: "#1B8A4A",
};

function specialtyColor(specialty: string | null | undefined): string {
  if (!specialty) return "#1B8A4A";
  const lower = specialty.toLowerCase();
  for (const [key, color] of Object.entries(SPECIALTY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // Deterministic color from string hash for unknown specialties
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = (hash * 31 + lower.charCodeAt(i)) & 0xffffff;
  const hue = hash % 360;
  return `hsl(${hue}, 58%, 42%)`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

type MonogramAvatarProps = {
  name: string;
  specialty?: string | null;
  size?: number;
  fontSize?: number;
  borderRadius?: string;
};

export function MonogramAvatar({
  name,
  specialty,
  size = 40,
  fontSize,
  borderRadius = "12px",
}: MonogramAvatarProps) {
  const bg = specialtyColor(specialty);
  const fs = fontSize ?? Math.round(size * 0.38);

  return (
    <div
      aria-label={`${name} avatar`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${fs}px`,
        fontWeight: 800,
        flexShrink: 0,
        letterSpacing: "-0.02em",
        userSelect: "none",
        fontFamily: "var(--font-bricolage), sans-serif",
      }}
    >
      {initials(name) || "EH"}
    </div>
  );
}
