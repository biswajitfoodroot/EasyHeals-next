export function parseStringArray(value: unknown, limit = 16): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  if (typeof value === "string" && value.length) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseStringArray(parsed, limit);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit);
    }
  }

  return [];
}

export function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function formatHospitalLocation(input: {
  city?: string | null;
  state?: string | null;
  addressLine1?: string | null;
}): string {
  const parts = [input.addressLine1, input.city, input.state]
    .map((item) => (item ?? "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

export function buildDirectionsUrl(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}): string {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${input.latitude},${input.longitude}`;
  }

  const fallback = encodeURIComponent(input.address?.trim() || "India");
  return `https://www.google.com/maps/dir/?api=1&destination=${fallback}`;
}

export function buildEmbedMapUrl(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}): string {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return `https://www.google.com/maps?q=${input.latitude},${input.longitude}&z=15&output=embed`;
  }

  const fallback = encodeURIComponent(input.address?.trim() || "India");
  return `https://www.google.com/maps?q=${fallback}&z=14&output=embed`;
}

