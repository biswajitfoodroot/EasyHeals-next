import { and, eq, like, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctorHospitalAffiliations, doctors, hospitalListingPackages, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

// ── Clean helpers ────────────────────────────────────────────────────────────
function cleanStr(v: unknown): string | undefined {
  if (v == null || v === "" || typeof v !== "string") return undefined;
  return v.trim() || undefined;
}

function cleanArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function cleanNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return isNaN(n) || n <= 0 ? undefined : n;
}

function cleanHospitalType(v: unknown): "hospital" | "clinic" | "nursing_home" {
  const s = String(v ?? "").toLowerCase().replace(/\s+/g, "_");
  if (s === "clinic") return "clinic";
  if (s === "nursing_home" || s === "nursing home") return "nursing_home";
  return "hospital";
}

function cleanWorkingHours(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(v)) {
    if (val != null) result[key] = String(val);
  }
  return Object.keys(result).length ? result : undefined;
}

function mergeArr(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

// Very lenient schema — real cleaning happens in logic
const applySchema = z.object({
  hospital: z.object({
    name: z.string().min(1).max(300),
    type: z.unknown().optional(),
    city: z.unknown().optional(),
    state: z.unknown().optional(),
    addressLine1: z.unknown().optional(),
    phone: z.unknown().optional(),
    email: z.unknown().optional(),
    website: z.unknown().optional(),
    description: z.unknown().optional(),
    specialties: z.unknown().optional(),
    facilities: z.unknown().optional(),
    accreditations: z.unknown().optional(),
    workingHours: z.unknown().optional(),
  }),
  doctors: z.array(z.object({ fullName: z.string().min(1) }).passthrough()).optional().default([]),
  packages: z.array(z.object({ packageName: z.string().min(1) }).passthrough()).optional().default([]),
  services: z.array(z.string()).optional().default([]),
  targetHospitalId: z.string().optional(),
  forceCreate: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  // quickSave: skip confirmation for 0-1 candidates — auto-create or auto-update
  quickSave: z.boolean().optional(),
}).passthrough();

export type HospitalCandidate = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  phone: string | null;
  isActive: boolean;
};

export type BrochureDiff = {
  dryRun: true;
  hospitalId: string;
  hospitalSlug: string;
  hospitalAction: "created" | "updated";
  hospital: {
    addedSpecialties: string[];
    dupSpecialties: string[];
    addedFacilities: string[];
    dupFacilities: string[];
    addedAccreditations: string[];
    dupAccreditations: string[];
    fieldFills: Array<{ field: string; value: string }>;
  };
  doctors: {
    new: Array<{ fullName: string; specialization: string | null }>;
    existing: Array<{ id: string; fullName: string }>;
  };
  packages: {
    new: Array<{ packageName: string; department: string | null; priceMin: number | null; priceMax: number | null }>;
    existing: Array<{ id: string; packageName: string }>;
  };
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = applySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const raw = parsed.data;
  const h = raw.hospital;
  const dryRun = raw.dryRun ?? false;
  const quickSave = raw.quickSave ?? false;

  const hospitalName = h.name.trim();
  const hospitalCity = cleanStr(h.city) ?? "";

  // ── 1. Resolve which hospital record to use ──────────────────────────────────

  // Case A: user already confirmed a specific hospital
  if (raw.targetHospitalId) {
    const [confirmed] = await db
      .select({ id: hospitals.id, slug: hospitals.slug })
      .from(hospitals)
      .where(eq(hospitals.id, raw.targetHospitalId))
      .limit(1);

    if (!confirmed) {
      return NextResponse.json({ error: "Selected hospital not found." }, { status: 404 });
    }

    return applyData(auth.userId, req, raw, hospitalName, hospitalCity, confirmed.id, confirmed.slug, "updated", dryRun);
  }

  // Case B: forceCreate — skip matching entirely
  if (raw.forceCreate) {
    return createAndApply(auth.userId, req, raw, hospitalName, hospitalCity, dryRun);
  }

  // Case C: exact name + city match → silent update
  if (hospitalCity) {
    const [exact] = await db
      .select({ id: hospitals.id, slug: hospitals.slug })
      .from(hospitals)
      .where(and(eq(hospitals.name, hospitalName), eq(hospitals.city, hospitalCity)))
      .limit(1);

    if (exact) {
      return applyData(auth.userId, req, raw, hospitalName, hospitalCity, exact.id, exact.slug, "updated", dryRun);
    }
  }

  // Case D: slug-based lookup
  const baseSlug = slugify(`${hospitalName} ${hospitalCity || ""}`.trim());
  const slugCandidates: HospitalCandidate[] = [];
  if (baseSlug) {
    const bySlug = await db
      .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug, city: hospitals.city, state: hospitals.state, phone: hospitals.phone, isActive: hospitals.isActive })
      .from(hospitals)
      .where(like(hospitals.slug, `${baseSlug}%`))
      .limit(4);
    slugCandidates.push(...bySlug);
  }

  // Case E: fuzzy name search
  const nameParts = hospitalName.split(/\s+/).filter((w) => w.length > 3);
  const fuzzyConditions = [
    ...nameParts.map((part) => like(hospitals.name, `%${part}%`)),
    ...(hospitalCity ? [like(hospitals.name, `%${hospitalCity}%`), like(hospitals.city, `%${hospitalCity}%`)] : []),
  ];

  const fuzzyCandidates: HospitalCandidate[] = [];
  if (fuzzyConditions.length > 0) {
    const rows = await db
      .select({ id: hospitals.id, name: hospitals.name, slug: hospitals.slug, city: hospitals.city, state: hospitals.state, phone: hospitals.phone, isActive: hospitals.isActive })
      .from(hospitals)
      .where(or(...fuzzyConditions))
      .limit(8);
    fuzzyCandidates.push(...rows);
  }

  // Merge, deduplicate by id
  const seen = new Set<string>();
  const candidates: HospitalCandidate[] = [];
  for (const c of [...slugCandidates, ...fuzzyCandidates]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      candidates.push(c);
    }
  }

  // Case F: quickSave intelligence — only ask when genuinely ambiguous (2+ candidates)
  if (quickSave) {
    if (candidates.length === 0) {
      // Nothing found — create new silently
      return createAndApply(auth.userId, req, raw, hospitalName, hospitalCity, dryRun);
    }
    if (candidates.length === 1) {
      // Single clear match — update it silently
      const match = candidates[0];
      return applyData(auth.userId, req, raw, hospitalName, hospitalCity, match.id, match.slug, "updated", dryRun);
    }
    // 2+ candidates — genuinely ambiguous, ask the user
  }

  // Default (brochure extract) or 2+ candidates: always ask
  return NextResponse.json({
    needsConfirmation: true,
    extractedName: hospitalName,
    extractedCity: hospitalCity,
    candidates,
  });
}

// ── Create new hospital then apply all data ──────────────────────────────────
async function createAndApply(
  userId: string,
  req: NextRequest,
  raw: z.infer<typeof applySchema>,
  hospitalName: string,
  hospitalCity: string,
  dryRun: boolean,
) {
  const baseSlug = slugify(`${hospitalName} ${hospitalCity || "india"}`);
  let slug = baseSlug;
  let suffix = 0;
  for (;;) {
    const [conflict] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!conflict) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  const h = raw.hospital;
  const allSpecialties = [...new Set([...cleanArr(h.specialties), ...cleanArr(raw.services).slice(0, 20)])];

  if (dryRun) {
    // Preview for a brand-new hospital — no existing data to compare
    const diff: BrochureDiff = {
      dryRun: true,
      hospitalId: "(new)",
      hospitalSlug: slug,
      hospitalAction: "created",
      hospital: {
        addedSpecialties: allSpecialties,
        dupSpecialties: [],
        addedFacilities: cleanArr(h.facilities),
        dupFacilities: [],
        addedAccreditations: cleanArr(h.accreditations),
        dupAccreditations: [],
        fieldFills: [],
      },
      doctors: {
        new: raw.doctors
          .filter((d) => d.fullName.trim())
          .map((d) => ({ fullName: d.fullName.trim(), specialization: cleanStr(d.specialization) ?? null })),
        existing: [],
      },
      packages: {
        new: raw.packages
          .filter((p) => p.packageName.trim())
          .map((p) => ({
            packageName: p.packageName.trim(),
            department: cleanStr(p.department) ?? null,
            priceMin: cleanNum(p.priceMin) ?? null,
            priceMax: cleanNum(p.priceMax) ?? null,
          })),
        existing: [],
      },
    };
    return NextResponse.json(diff);
  }

  const [created] = await db
    .insert(hospitals)
    .values({
      name: hospitalName,
      slug,
      type: cleanHospitalType(h.type),
      city: hospitalCity || "Unknown",
      state: cleanStr(h.state),
      addressLine1: cleanStr(h.addressLine1),
      phone: cleanStr(h.phone),
      email: cleanStr(h.email),
      website: cleanStr(h.website),
      description: cleanStr(h.description),
      specialties: allSpecialties,
      facilities: cleanArr(h.facilities),
      accreditations: cleanArr(h.accreditations),
      workingHours: cleanWorkingHours(h.workingHours),
      isPrivate: true,
      source: "brochure_extract",
      isActive: true,
    })
    .returning({ id: hospitals.id, slug: hospitals.slug });

  return applyData(userId, req, raw, hospitalName, hospitalCity, created.id, created.slug, "created", false);
}

// ── Apply doctors + packages to a resolved hospital ─────────────────────────
async function applyData(
  userId: string,
  req: NextRequest,
  raw: z.infer<typeof applySchema>,
  hospitalName: string,
  hospitalCity: string,
  hospitalId: string,
  hospitalSlug: string,
  hospitalAction: "created" | "updated",
  dryRun: boolean,
) {
  const h = raw.hospital;
  const incomingSpecialties = [...new Set([...cleanArr(h.specialties), ...cleanArr(raw.services).slice(0, 20)])];
  const incomingFacilities = cleanArr(h.facilities);
  const incomingAccreditations = cleanArr(h.accreditations);

  // ── Fetch existing hospital data for merge ─────────────────────────────────
  let existingSpecialties: string[] = [];
  let existingFacilities: string[] = [];
  let existingAccreditations: string[] = [];
  let existingWh: Record<string, string> | null = null;
  let existingPhone: string | null = null;
  let existingEmail: string | null = null;
  let existingWebsite: string | null = null;
  let existingDescription: string | null = null;
  let existingAddressLine1: string | null = null;
  let existingState: string | null = null;

  if (hospitalAction === "updated") {
    const [existing] = await db
      .select({
        specialties: hospitals.specialties,
        facilities: hospitals.facilities,
        accreditations: hospitals.accreditations,
        workingHours: hospitals.workingHours,
        phone: hospitals.phone,
        email: hospitals.email,
        website: hospitals.website,
        description: hospitals.description,
        addressLine1: hospitals.addressLine1,
        state: hospitals.state,
      })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    if (existing) {
      existingSpecialties = Array.isArray(existing.specialties) ? existing.specialties : [];
      existingFacilities = Array.isArray(existing.facilities) ? existing.facilities : [];
      existingAccreditations = Array.isArray(existing.accreditations) ? existing.accreditations : [];
      existingWh = existing.workingHours as Record<string, string> | null;
      existingPhone = existing.phone;
      existingEmail = existing.email;
      existingWebsite = existing.website;
      existingDescription = existing.description;
      existingAddressLine1 = existing.addressLine1;
      existingState = existing.state;
    }
  }

  // ── Compute merged arrays ──────────────────────────────────────────────────
  const mergedSpecialties = mergeArr(existingSpecialties, incomingSpecialties);
  const mergedFacilities = mergeArr(existingFacilities, incomingFacilities);
  const mergedAccreditations = mergeArr(existingAccreditations, incomingAccreditations);
  const newWh = cleanWorkingHours(h.workingHours);
  const mergedWh = newWh ? { ...(existingWh ?? {}), ...newWh } : (existingWh ?? undefined);

  const addedSpecialties = incomingSpecialties.filter((s) => !existingSpecialties.includes(s));
  const dupSpecialties = incomingSpecialties.filter((s) => existingSpecialties.includes(s));
  const addedFacilities = incomingFacilities.filter((f) => !existingFacilities.includes(f));
  const dupFacilities = incomingFacilities.filter((f) => existingFacilities.includes(f));
  const addedAccreditations = incomingAccreditations.filter((a) => !existingAccreditations.includes(a));
  const dupAccreditations = incomingAccreditations.filter((a) => existingAccreditations.includes(a));

  // ── Scalar fields: only fill if currently null/empty ──────────────────────
  const fieldFills: Array<{ field: string; value: string }> = [];
  const scalarUpdate: Record<string, unknown> = {};

  function fillIfEmpty(field: string, existing: string | null, incoming: string | undefined) {
    if (!existing && incoming) {
      fieldFills.push({ field, value: incoming });
      scalarUpdate[field] = incoming;
    }
  }

  fillIfEmpty("phone", existingPhone, cleanStr(h.phone));
  fillIfEmpty("email", existingEmail, cleanStr(h.email));
  fillIfEmpty("website", existingWebsite, cleanStr(h.website));
  fillIfEmpty("description", existingDescription, cleanStr(h.description));
  fillIfEmpty("addressLine1", existingAddressLine1, cleanStr(h.addressLine1));
  fillIfEmpty("state", existingState, cleanStr(h.state));

  // ── Resolve doctors (query once, reuse in write) ───────────────────────────
  type ResolvedDoctor = {
    docInput: Record<string, unknown>;
    fullName: string;
    existingId: string | null;
    existingQuals: string[];
    existingSpecialization: string | null;
    existingBio: string | null;
    existingFee: number | null;
    existingYoe: number | null;
    existingCity: string | null;
  };

  const resolvedDoctors: ResolvedDoctor[] = [];
  for (const doc of raw.doctors) {
    const fullName = doc.fullName.trim();
    if (!fullName) continue;

    const [existingDoc] = await db
      .select({
        id: doctors.id,
        qualifications: doctors.qualifications,
        specialization: doctors.specialization,
        bio: doctors.bio,
        consultationFee: doctors.consultationFee,
        yearsOfExperience: doctors.yearsOfExperience,
        city: doctors.city,
      })
      .from(doctors)
      .where(eq(doctors.fullName, fullName))
      .limit(1);

    resolvedDoctors.push({
      docInput: doc,
      fullName,
      existingId: existingDoc?.id ?? null,
      existingQuals: Array.isArray(existingDoc?.qualifications) ? existingDoc.qualifications : [],
      existingSpecialization: existingDoc?.specialization ?? null,
      existingBio: existingDoc?.bio ?? null,
      existingFee: existingDoc?.consultationFee ?? null,
      existingYoe: existingDoc?.yearsOfExperience ?? null,
      existingCity: existingDoc?.city ?? null,
    });
  }

  // ── Resolve packages (query once, reuse in write) ──────────────────────────
  type ResolvedPackage = {
    pkgInput: Record<string, unknown>;
    packageName: string;
    existingId: string | null;
  };

  const resolvedPackages: ResolvedPackage[] = [];
  for (const pkg of raw.packages) {
    const packageName = pkg.packageName.trim();
    if (!packageName) continue;

    const [existingPkg] = await db
      .select({ id: hospitalListingPackages.id })
      .from(hospitalListingPackages)
      .where(
        and(
          eq(hospitalListingPackages.hospitalId, hospitalId),
          eq(hospitalListingPackages.packageName, packageName),
        ),
      )
      .limit(1);

    resolvedPackages.push({
      pkgInput: pkg,
      packageName,
      existingId: existingPkg?.id ?? null,
    });
  }

  // ── Build diff ─────────────────────────────────────────────────────────────
  const diff: BrochureDiff = {
    dryRun: true,
    hospitalId,
    hospitalSlug,
    hospitalAction,
    hospital: {
      addedSpecialties,
      dupSpecialties,
      addedFacilities,
      dupFacilities,
      addedAccreditations,
      dupAccreditations,
      fieldFills,
    },
    doctors: {
      new: resolvedDoctors
        .filter((r) => !r.existingId)
        .map((r) => ({ fullName: r.fullName, specialization: cleanStr(r.docInput.specialization) ?? null })),
      existing: resolvedDoctors
        .filter((r) => !!r.existingId)
        .map((r) => ({ id: r.existingId!, fullName: r.fullName })),
    },
    packages: {
      new: resolvedPackages
        .filter((r) => !r.existingId)
        .map((r) => ({
          packageName: r.packageName,
          department: cleanStr(r.pkgInput.department) ?? null,
          priceMin: cleanNum(r.pkgInput.priceMin) ?? null,
          priceMax: cleanNum(r.pkgInput.priceMax) ?? null,
        })),
      existing: resolvedPackages
        .filter((r) => !!r.existingId)
        .map((r) => ({ id: r.existingId!, packageName: r.packageName })),
    },
  };

  if (dryRun) {
    return NextResponse.json(diff);
  }

  // ── Actual write ───────────────────────────────────────────────────────────

  if (hospitalAction === "updated") {
    await db
      .update(hospitals)
      .set({
        type: cleanHospitalType(h.type),
        specialties: mergedSpecialties,
        facilities: mergedFacilities,
        accreditations: mergedAccreditations,
        workingHours: mergedWh,
        ...scalarUpdate,
        source: "brochure_extract",
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, hospitalId));
  }

  // ── Write doctors ──────────────────────────────────────────────────────────
  let doctorsCreated = 0;
  let doctorsUpdated = 0;

  for (const r of resolvedDoctors) {
    let doctorId: string;

    if (r.existingId) {
      doctorId = r.existingId;
      doctorsUpdated++;

      const mergedQuals = mergeArr(r.existingQuals, cleanArr(r.docInput.qualifications));
      const docUpdate: Record<string, unknown> = {
        qualifications: mergedQuals,
        updatedAt: new Date(),
      };
      // Only fill null scalars
      if (!r.existingSpecialization && cleanStr(r.docInput.specialization)) {
        docUpdate.specialization = cleanStr(r.docInput.specialization);
      }
      if (!r.existingBio && cleanStr(r.docInput.bio)) {
        docUpdate.bio = cleanStr(r.docInput.bio);
      }
      if (!r.existingFee && cleanNum(r.docInput.consultationFee)) {
        docUpdate.consultationFee = cleanNum(r.docInput.consultationFee);
      }
      if (!r.existingYoe) {
        const yoe = cleanNum(r.docInput.yearsOfExperience);
        if (yoe) docUpdate.yearsOfExperience = Math.round(yoe);
      }
      if (!r.existingCity && hospitalCity) {
        docUpdate.city = hospitalCity;
      }

      await db.update(doctors).set(docUpdate).where(eq(doctors.id, doctorId));
    } else {
      let slug = slugify(r.fullName) || `doctor-${crypto.randomUUID().slice(0, 8)}`;
      let suffix = 0;
      for (;;) {
        const [c] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.slug, slug)).limit(1);
        if (!c) break;
        slug = `${slugify(r.fullName)}-${++suffix}`;
      }

      const [created] = await db
        .insert(doctors)
        .values({
          fullName: r.fullName,
          slug,
          specialization: cleanStr(r.docInput.specialization),
          qualifications: cleanArr(r.docInput.qualifications),
          yearsOfExperience: (() => {
            const n = cleanNum(r.docInput.yearsOfExperience);
            return n ? Math.round(n) : undefined;
          })(),
          consultationFee: cleanNum(r.docInput.consultationFee),
          bio: cleanStr(r.docInput.bio),
          city: hospitalCity || undefined,
          isActive: true,
        })
        .returning({ id: doctors.id });

      doctorId = created.id;
      doctorsCreated++;
    }

    // Link to hospital if not already affiliated
    const [existingAff] = await db
      .select({ id: doctorHospitalAffiliations.id })
      .from(doctorHospitalAffiliations)
      .where(
        and(
          eq(doctorHospitalAffiliations.doctorId, doctorId),
          eq(doctorHospitalAffiliations.hospitalId, hospitalId),
        ),
      )
      .limit(1);

    if (!existingAff) {
      await db.insert(doctorHospitalAffiliations).values({
        doctorId,
        hospitalId,
        role: "Consultant",
        isPrimary: true,
        source: "brochure_extract",
        isActive: true,
      });
    }
  }

  // ── Write packages ─────────────────────────────────────────────────────────
  let packagesUpserted = 0;

  for (const r of resolvedPackages) {
    const inclusionsList = cleanArr(r.pkgInput.inclusions);
    const inclusions = inclusionsList as unknown as Record<string, unknown>;

    if (r.existingId) {
      // Update only non-null fields (append, don't erase)
      const pkgUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (cleanStr(r.pkgInput.procedureName)) pkgUpdate.procedureName = cleanStr(r.pkgInput.procedureName);
      if (cleanStr(r.pkgInput.department)) pkgUpdate.department = cleanStr(r.pkgInput.department);
      if (cleanNum(r.pkgInput.priceMin)) pkgUpdate.priceMin = cleanNum(r.pkgInput.priceMin);
      if (cleanNum(r.pkgInput.priceMax)) pkgUpdate.priceMax = cleanNum(r.pkgInput.priceMax);
      if (cleanStr(r.pkgInput.lengthOfStay)) pkgUpdate.lengthOfStay = cleanStr(r.pkgInput.lengthOfStay);
      if (inclusionsList.length) pkgUpdate.inclusions = inclusions;

      await db.update(hospitalListingPackages).set(pkgUpdate).where(eq(hospitalListingPackages.id, r.existingId));
    } else {
      await db.insert(hospitalListingPackages).values({
        hospitalId,
        packageName: r.packageName,
        procedureName: cleanStr(r.pkgInput.procedureName),
        department: cleanStr(r.pkgInput.department),
        priceMin: cleanNum(r.pkgInput.priceMin),
        priceMax: cleanNum(r.pkgInput.priceMax),
        lengthOfStay: cleanStr(r.pkgInput.lengthOfStay),
        inclusions: inclusionsList.length ? inclusions : undefined,
        source: "brochure_extract",
        isActive: true,
      });
    }
    packagesUpserted++;
  }

  await writeAuditLog({
    actorUserId: userId,
    action: `hospital.brochure_apply.${hospitalAction}`,
    entityType: "hospital",
    entityId: hospitalId,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: {
      hospitalName,
      doctorsCreated,
      doctorsUpdated,
      packagesUpserted,
      addedSpecialties,
      addedFacilities,
      addedAccreditations,
    },
  });

  return NextResponse.json({
    data: {
      hospitalId,
      hospitalSlug,
      hospitalAction,
      doctorsCreated,
      doctorsUpdated,
      packagesUpserted,
      addedSpecialties,
      addedFacilities,
      addedAccreditations,
    },
  });
}
