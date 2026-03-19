import { and, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanStr(v: unknown): string | undefined {
  if (!v || typeof v !== "string") return undefined;
  return v.trim() || undefined;
}

function mergeArr(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

function normaliseType(t: string): "hospital" | "clinic" | "nursing_home" {
  const s = t.toLowerCase().trim();
  if (s === "clinic") return "clinic";
  if (s.includes("nursing")) return "nursing_home";
  return "hospital";
}

function extractHospitalMentions(snippet: string, hospitalNames: string[]): string[] {
  const lower = snippet.toLowerCase();
  return hospitalNames.filter((n) => lower.includes(n.toLowerCase()));
}

const entitySchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  city: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  snippet: z.string().default(""),
  sourceUrl: z.string().nullable().optional(),
});

const batchSchema = z.object({
  entities: z.array(entitySchema).min(1).max(30),
});

export type BatchSaveResult = {
  saved: {
    hospitals: Array<{ action: "created" | "updated"; name: string; id: string; slug: string }>;
    doctors: Array<{ action: "created" | "updated"; name: string; id: string; slug: string; linkedHospital: string | null }>;
  };
  ambiguous: Array<{
    name: string;
    city: string;
    candidates: Array<{ id: string; name: string; slug: string; city: string; state: string | null; phone: string | null; isActive: boolean }>;
  }>;
  errors: string[];
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = batchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const { entities } = parsed.data;

  const result: BatchSaveResult = {
    saved: { hospitals: [], doctors: [] },
    ambiguous: [],
    errors: [],
  };

  // ── Step 1: Process hospitals & clinics first ──────────────────────────────
  // Map: entityName → resolved hospitalId (used later for doctor linking)
  const hospitalEntityMap = new Map<string, { id: string; slug: string; city: string }>();

  const hospitalEntities = entities.filter(
    (e) => !["doctor", "physician", "surgeon"].some((t) => e.type.toLowerCase().includes(t)),
  );

  for (const entity of hospitalEntities) {
    const name = entity.name.trim();
    const city = cleanStr(entity.city) ?? "";

    try {
      const resolved = await resolveHospital(auth.userId, req, entity, name, city);

      if (resolved.type === "ambiguous") {
        result.ambiguous.push({ name, city, candidates: resolved.candidates });
      } else {
        result.saved.hospitals.push({ action: resolved.action, name, id: resolved.id, slug: resolved.slug });
        hospitalEntityMap.set(name.toLowerCase(), { id: resolved.id, slug: resolved.slug, city });
      }
    } catch (err: any) {
      result.errors.push(`Hospital "${name}": ${err.message ?? "unknown error"}`);
    }
  }

  // ── Step 2: Process doctors — detect hospital affiliation ──────────────────
  const doctorEntities = entities.filter(
    (e) => ["doctor", "physician", "surgeon", "dr."].some((t) => e.type.toLowerCase().includes(t)),
  );

  const hospitalNamesInBatch = Array.from(hospitalEntityMap.keys());

  for (const entity of doctorEntities) {
    const fullName = entity.name.trim();
    const city = cleanStr(entity.city) ?? "";

    try {
      // Detect which hospital this doctor belongs to
      let linkedHospitalId: string | null = null;
      let linkedHospitalName: string | null = null;

      if (hospitalEntityMap.size === 1) {
        // Only one hospital in the batch — link all doctors to it
        const [entry] = hospitalEntityMap.values();
        linkedHospitalId = entry.id;
        linkedHospitalName = [...hospitalEntityMap.keys()][0];
      } else if (hospitalEntityMap.size > 1) {
        // Multiple hospitals — check snippet for hospital name mentions
        const mentioned = extractHospitalMentions(entity.snippet, hospitalNamesInBatch);
        if (mentioned.length === 1) {
          const match = hospitalEntityMap.get(mentioned[0]);
          if (match) {
            linkedHospitalId = match.id;
            linkedHospitalName = mentioned[0];
          }
        }
        // If multiple mentioned or none, skip affiliation (doctor saved standalone)
      }

      // If no hospital in current batch, try matching by city in DB
      if (!linkedHospitalId && city) {
        const namePartsForSnippet = entity.snippet
          .split(/\W+/)
          .filter((w) => w.length > 4);

        if (namePartsForSnippet.length > 0) {
          const snippetConditions = namePartsForSnippet
            .slice(0, 5)
            .map((w) => like(hospitals.name, `%${w}%`));

          const [dbHospital] = await db
            .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug })
            .from(hospitals)
            .where(and(eq(hospitals.city, city), or(...snippetConditions)))
            .limit(1);

          if (dbHospital) {
            linkedHospitalId = dbHospital.id;
            linkedHospitalName = dbHospital.name;
          }
        }
      }

      // Save the doctor
      const doctorResult = await saveDoctor(auth.userId, req, {
        fullName,
        specialization: inferSpecialization(entity.snippet),
        bio: cleanStr(entity.snippet),
        city: city || undefined,
        phone: cleanStr(entity.phone),
      });

      // Create affiliation if we found the hospital
      if (linkedHospitalId) {
        const [existingAff] = await db
          .select({ id: doctorHospitalAffiliations.id })
          .from(doctorHospitalAffiliations)
          .where(
            and(
              eq(doctorHospitalAffiliations.doctorId, doctorResult.id),
              eq(doctorHospitalAffiliations.hospitalId, linkedHospitalId),
            ),
          )
          .limit(1);

        if (!existingAff) {
          await db.insert(doctorHospitalAffiliations).values({
            doctorId: doctorResult.id,
            hospitalId: linkedHospitalId,
            role: inferRole(entity.snippet),
            isPrimary: true,
            source: "ai_research",
            isActive: true,
          });
        }
      }

      result.saved.doctors.push({
        action: doctorResult.action,
        name: fullName,
        id: doctorResult.id,
        slug: doctorResult.slug,
        linkedHospital: linkedHospitalName,
      });
    } catch (err: any) {
      result.errors.push(`Doctor "${fullName}": ${err.message ?? "unknown error"}`);
    }
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "research.batch_save",
    entityType: "batch",
    entityId: "batch",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: {
      hospitalsCreated: result.saved.hospitals.filter((h) => h.action === "created").length,
      hospitalsUpdated: result.saved.hospitals.filter((h) => h.action === "updated").length,
      doctorsCreated: result.saved.doctors.filter((d) => d.action === "created").length,
      doctorsUpdated: result.saved.doctors.filter((d) => d.action === "updated").length,
      ambiguous: result.ambiguous.length,
    },
  });

  return NextResponse.json({ data: result });
}

// ── Resolve a hospital entity: auto-create/update or flag as ambiguous ────────
async function resolveHospital(
  userId: string,
  req: NextRequest,
  entity: z.infer<typeof entitySchema>,
  name: string,
  city: string,
): Promise<
  | { type: "saved"; action: "created" | "updated"; id: string; slug: string }
  | { type: "ambiguous"; candidates: BatchSaveResult["ambiguous"][number]["candidates"] }
> {
  // Exact name + city match → update
  if (city) {
    const [exact] = await db
      .select({ id: hospitals.id, slug: hospitals.slug })
      .from(hospitals)
      .where(and(eq(hospitals.name, name), eq(hospitals.city, city)))
      .limit(1);

    if (exact) {
      await patchHospital(exact.id, entity, city);
      return { type: "saved", action: "updated", id: exact.id, slug: exact.slug };
    }
  }

  // Fuzzy slug + name search
  const baseSlug = slugify(`${name} ${city || ""}`.trim());
  const candidates: BatchSaveResult["ambiguous"][number]["candidates"] = [];

  if (baseSlug) {
    const bySlug = await db
      .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug, city: hospitals.city, state: hospitals.state, phone: hospitals.phone, isActive: hospitals.isActive })
      .from(hospitals)
      .where(like(hospitals.slug, `${baseSlug}%`))
      .limit(3);
    candidates.push(...bySlug);
  }

  const nameParts = name.split(/\s+/).filter((w) => w.length > 3);
  if (nameParts.length > 0) {
    const fuzzyConditions = [
      ...nameParts.map((w) => like(hospitals.name, `%${w}%`)),
      ...(city ? [like(hospitals.city, `%${city}%`)] : []),
    ];
    const byName = await db
      .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug, city: hospitals.city, state: hospitals.state, phone: hospitals.phone, isActive: hospitals.isActive })
      .from(hospitals)
      .where(or(...fuzzyConditions))
      .limit(6);

    const seen = new Set(candidates.map((c) => c.id));
    for (const r of byName) {
      if (!seen.has(r.id)) { candidates.push(r); seen.add(r.id); }
    }
  }

  if (candidates.length === 0) {
    // Nothing found → create
    const created = await createHospital(userId, entity, name, city);
    return { type: "saved", action: "created", ...created };
  }

  if (candidates.length === 1) {
    // Single match → update
    const match = candidates[0];
    await patchHospital(match.id, entity, city);
    return { type: "saved", action: "updated", id: match.id, slug: match.slug };
  }

  // Multiple candidates → ambiguous
  return { type: "ambiguous", candidates };
}

async function createHospital(
  _userId: string,
  entity: z.infer<typeof entitySchema>,
  name: string,
  city: string,
): Promise<{ id: string; slug: string }> {
  const baseSlug = slugify(`${name} ${city || "india"}`);
  let slug = baseSlug;
  let suffix = 0;
  for (;;) {
    const [c] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!c) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  const [created] = await db
    .insert(hospitals)
    .values({
      name,
      slug,
      type: normaliseType(entity.type),
      city: city || "Unknown",
      phone: cleanStr(entity.phone),
      website: cleanStr(entity.website),
      description: cleanStr(entity.snippet),
      isPrivate: true,
      source: "ai_research",
      isActive: true,
    })
    .returning({ id: hospitals.id, slug: hospitals.slug });

  return created;
}

async function patchHospital(id: string, entity: z.infer<typeof entitySchema>, _city: string) {
  const [existing] = await db
    .select({ phone: hospitals.phone, website: hospitals.website, description: hospitals.description })
    .from(hospitals)
    .where(eq(hospitals.id, id))
    .limit(1);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (!existing?.phone && cleanStr(entity.phone)) update.phone = cleanStr(entity.phone);
  if (!existing?.website && cleanStr(entity.website)) update.website = cleanStr(entity.website);
  if (!existing?.description && cleanStr(entity.snippet)) update.description = cleanStr(entity.snippet);

  await db.update(hospitals).set(update).where(eq(hospitals.id, id));
}

async function saveDoctor(
  _userId: string,
  _req: NextRequest,
  data: { fullName: string; specialization?: string; bio?: string; city?: string; phone?: string },
): Promise<{ action: "created" | "updated"; id: string; slug: string }> {
  const [existing] = await db
    .select({ id: doctors.id, slug: doctors.slug, specialization: doctors.specialization, bio: doctors.bio, city: doctors.city, phone: doctors.phone, qualifications: doctors.qualifications })
    .from(doctors)
    .where(eq(doctors.fullName, data.fullName))
    .limit(1);

  if (existing) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (!existing.specialization && data.specialization) update.specialization = data.specialization;
    if (!existing.bio && data.bio) update.bio = data.bio;
    if (!existing.city && data.city) update.city = data.city;
    if (!existing.phone && data.phone) update.phone = data.phone;
    await db.update(doctors).set(update).where(eq(doctors.id, existing.id));
    return { action: "updated", id: existing.id, slug: existing.slug };
  }

  let slug = slugify(data.fullName) || `doctor-${crypto.randomUUID().slice(0, 8)}`;
  let suffix = 0;
  for (;;) {
    const [c] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.slug, slug)).limit(1);
    if (!c) break;
    slug = `${slugify(data.fullName)}-${++suffix}`;
  }

  const [created] = await db
    .insert(doctors)
    .values({
      fullName: data.fullName,
      slug,
      specialization: data.specialization,
      bio: data.bio,
      city: data.city,
      phone: data.phone,
      qualifications: [],
      isActive: true,
    })
    .returning({ id: doctors.id, slug: doctors.slug });

  return { action: "created", id: created.id, slug: created.slug };
}

// ── Helpers for inferring doctor details from snippet ─────────────────────────
function inferSpecialization(snippet: string): string | undefined {
  const specKeywords = [
    "cardiologist", "orthopedic", "oncologist", "neurologist", "pediatrician",
    "gynecologist", "dermatologist", "psychiatrist", "urologist", "gastroenterologist",
    "endocrinologist", "ophthalmologist", "radiologist", "anesthesiologist",
    "surgeon", "physician", "specialist", "consultant",
  ];
  const lower = snippet.toLowerCase();
  for (const kw of specKeywords) {
    if (lower.includes(kw)) {
      // Capitalise first letter
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }
  return undefined;
}

function inferRole(snippet: string): string {
  const lower = snippet.toLowerCase();
  if (lower.includes("head") || lower.includes("chief") || lower.includes("director")) return "Head of Department";
  if (lower.includes("senior")) return "Senior Consultant";
  if (lower.includes("resident")) return "Resident";
  return "Consultant";
}
