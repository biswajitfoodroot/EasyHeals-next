import { and, eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";

export type MatchResult = {
  id: string;
  name: string;
  city: string | null;
  confidence: number;
  reasons: string[];
  state?: string | null;
  slug?: string | null;
  type?: string | null;
  specialization?: string | null;
};

// Strip common words that don't differentiate Indian hospital names.
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bdr\.?\s*/g, "")
    .replace(/\b(hospital|hospitals|clinic|centre|center|medical|institute|super|speciality|specialties|multispeciality|multispecility|health|care|healthcare|pvt|ltd|private|limited)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wa = new Set(a.split(" ").filter(w => w.length > 1));
  const wb = new Set(b.split(" ").filter(w => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  return intersection / (wa.size + wb.size - intersection);
}

function nameSimilarity(input: string, candidate: string): { score: number; reason: string } {
  const ni = normalizeName(input);
  const nc = normalizeName(candidate);

  if (ni === nc) return { score: 1.0, reason: "Exact name match" };
  if (ni.length >= 4 && nc.includes(ni)) return { score: 0.90, reason: "Name contained in record" };
  if (nc.length >= 4 && ni.includes(nc)) return { score: 0.90, reason: "Record name contained in query" };

  const j = jaccardSimilarity(ni, nc);
  if (j >= 0.75) return { score: 0.82 + j * 0.10, reason: "Name very similar" };
  if (j >= 0.50) return { score: 0.60 + (j - 0.50) * 0.88, reason: "Name partially matches" };
  if (j >= 0.25) return { score: 0.35 + (j - 0.25) * 1.0, reason: "Name loosely matches" };
  return { score: j * 0.35, reason: "Weak name match" };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "admin_manager", "admin_editor"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim() ?? "";
  const city = url.searchParams.get("city")?.trim() ?? "";
  const entityType = url.searchParams.get("type") ?? "hospital";
  const website = url.searchParams.get("website")?.trim() ?? "";
  const phone = url.searchParams.get("phone")?.trim() ?? "";
  const specialization = url.searchParams.get("specialization")?.trim() ?? "";

  if (name.length < 2) return NextResponse.json({ matches: [] });

  // Pick the first meaningful word for the LIKE query (avoids full-scan)
  const normalizedInput = normalizeName(name);
  const words = normalizedInput.split(" ").filter(w => w.length > 2);
  const primaryWord = words[0] ?? name.slice(0, 5);

  if (entityType === "doctor") {
    const rows = await db
      .select({
        id: doctors.id,
        fullName: doctors.fullName,
        specialization: doctors.specialization,
        city: doctors.city,
        slug: doctors.slug,
        phone: doctors.phone,
      })
      .from(doctors)
      .where(and(eq(doctors.isActive, true), like(doctors.fullName, `%${primaryWord}%`)))
      .limit(20);

    const scored: MatchResult[] = rows
      .map(r => {
        const { score: ns, reason: nr } = nameSimilarity(name, r.fullName);
        const reasons: string[] = [nr];
        let confidence = ns;

        if (city && r.city) {
          const ci = city.toLowerCase();
          const cr = r.city.toLowerCase();
          if (ci === cr || ci.includes(cr) || cr.includes(ci)) {
            confidence += 0.12;
            reasons.push("City matches");
          }
        }
        if (specialization && r.specialization) {
          const si = specialization.toLowerCase();
          const sr = r.specialization.toLowerCase();
          if (si.includes(sr) || sr.includes(si)) {
            confidence += 0.10;
            reasons.push("Specialization matches");
          }
        }
        if (phone && r.phone) {
          const pi = phone.replace(/\D/g, "").slice(-10);
          const pr = r.phone.replace(/\D/g, "").slice(-10);
          if (pi.length >= 8 && pi === pr) {
            confidence += 0.30;
            reasons.push("Phone matches");
          }
        }

        return {
          id: r.id,
          name: r.fullName,
          city: r.city,
          specialization: r.specialization,
          slug: r.slug ?? null,
          confidence: Math.min(confidence, 1.0),
          reasons,
        };
      })
      .filter(r => r.confidence >= 0.50)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return NextResponse.json({ matches: scored });
  }

  // Hospital
  const rows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      city: hospitals.city,
      state: hospitals.state,
      slug: hospitals.slug,
      type: hospitals.type,
      website: hospitals.website,
      phone: hospitals.phone,
    })
    .from(hospitals)
    .where(and(eq(hospitals.isActive, true), like(hospitals.name, `%${primaryWord}%`)))
    .limit(20);

  const scored: MatchResult[] = rows
    .map(r => {
      const { score: ns, reason: nr } = nameSimilarity(name, r.name);
      const reasons: string[] = [nr];
      let confidence = ns;

      if (city && r.city) {
        const ci = city.toLowerCase();
        const cr = r.city.toLowerCase();
        if (ci === cr || ci.includes(cr) || cr.includes(ci)) {
          confidence += 0.15;
          reasons.push("City matches");
        }
      }
      if (website && r.website) {
        try {
          const getDomain = (u: string) =>
            new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
          if (getDomain(website) === getDomain(r.website)) {
            confidence += 0.30;
            reasons.push("Website matches");
          }
        } catch { /* ignore malformed URLs */ }
      }
      if (phone && r.phone) {
        const pi = phone.replace(/\D/g, "").slice(-10);
        const pr = r.phone.replace(/\D/g, "").slice(-10);
        if (pi.length >= 8 && pi === pr) {
          confidence += 0.25;
          reasons.push("Phone matches");
        }
      }

      return {
        id: r.id,
        name: r.name,
        city: r.city,
        state: r.state,
        slug: r.slug ?? null,
        type: r.type,
        confidence: Math.min(confidence, 1.0),
        reasons,
      };
    })
    .filter(r => r.confidence >= 0.50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return NextResponse.json({ matches: scored });
}
