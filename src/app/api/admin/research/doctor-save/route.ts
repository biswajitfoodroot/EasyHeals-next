import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, ingestionFieldConfidences, ingestionJobs } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ensureRole } from "@/lib/rbac";
import { slugify } from "@/lib/strings";

function cleanStr(v: unknown): string | undefined {
  if (v == null || v === "" || typeof v !== "string") return undefined;
  return v.trim() || undefined;
}

function mergeArr(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

const schema = z.object({
  fullName: z.string().min(1).max(200),
  specialization: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  bio: z.string().max(2000).optional(),
  qualifications: z.array(z.string()).optional(),
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  consultationFee: z.number().min(0).optional(),
  // existingDoctorId: when the admin selected "match existing", update that specific record by ID
  existingDoctorId: z.string().optional(),
  // Accept multiple source URLs (mirrors the hospital brochure/apply approach)
  sourceUrls: z.array(z.string()).optional().default([]),
  // Legacy single-URL field — still accepted for backwards compatibility
  sourceUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = ensureRole(auth.role, ["owner", "admin"]);
  if (forbidden) return forbidden;

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    fullName, specialization, city, phone, bio,
    qualifications = [], yearsOfExperience, consultationFee,
    existingDoctorId, sourceUrls, sourceUrl,
  } = parsed.data;
  const userId = auth.userId;

  // Build a deduplicated source URL list — same approach as brochure/apply
  const rawSourceUrls = sourceUrls.length ? sourceUrls : (sourceUrl ? [sourceUrl] : []);
  const allSourceUrls = [...new Set([...rawSourceUrls, "ai_research"])];
  const primarySourceUrl = rawSourceUrls[0] ?? "ai_research";

  async function writeDoctorReferences(doctorId: string) {
    try {
      const [job] = await db.insert(ingestionJobs).values({
        requestedByUserId: userId,
        status: "completed",
        sourceUrl: primarySourceUrl,
        searchQuery: fullName + (city ? ` ${city}` : ""),
        runMode: "ai_research",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: ingestionJobs.id });

      if (!job) return;

      type FieldRef = { key: string; value: string | null };
      const fieldRefs: FieldRef[] = [
        { key: "fullName",          value: fullName },
        { key: "specialization",    value: specialization ?? null },
        { key: "bio",               value: bio ?? null },
        { key: "city",              value: city ?? null },
        { key: "phone",             value: phone ?? null },
        { key: "qualifications",    value: qualifications.length ? qualifications.join(", ") : null },
        { key: "yearsOfExperience", value: yearsOfExperience != null ? String(yearsOfExperience) : null },
        { key: "consultationFee",   value: consultationFee != null ? String(consultationFee) : null },
      ];
      const toInsert = fieldRefs.filter(f => f.value);
      if (!toInsert.length) return;

      // Write one provenance row per field × source URL (mirrors brochure/apply)
      const confidenceRows = toInsert.flatMap(f =>
        allSourceUrls.slice(0, 5).map(srcUrl => ({
          jobId: job.id,
          entityType: "doctor" as const,
          entityId: doctorId,
          fieldKey: f.key,
          extractedValue: f.value,
          sourceType: "ai_research",
          sourceUrl: srcUrl,
          confidence: 0.75,
          reviewStatus: "applied",
        }))
      );
      await db.insert(ingestionFieldConfidences).values(confidenceRows).onConflictDoNothing().catch(() => null);

      // Write a "source" row for each additional URL so all appear in the References panel
      if (rawSourceUrls.length > 1) {
        const sourceRows = rawSourceUrls.slice(1, 10).map(srcUrl => ({
          jobId: job.id,
          entityType: "doctor" as const,
          entityId: doctorId,
          fieldKey: "source",
          extractedValue: srcUrl.slice(0, 500),
          sourceType: "ai_research",
          sourceUrl: srcUrl,
          confidence: 0.75,
          reviewStatus: "applied" as const,
        }));
        await db.insert(ingestionFieldConfidences).values(sourceRows).onConflictDoNothing().catch(() => null);
      }
    } catch { /* non-critical */ }
  }

  // ── Update a specific doctor by ID (admin explicitly matched) ────────────
  if (existingDoctorId) {
    const [target] = await db
      .select({
        id: doctors.id,
        slug: doctors.slug,
        specialization: doctors.specialization,
        bio: doctors.bio,
        city: doctors.city,
        phone: doctors.phone,
        qualifications: doctors.qualifications,
        yearsOfExperience: doctors.yearsOfExperience,
        consultationFee: doctors.consultationFee,
      })
      .from(doctors)
      .where(eq(doctors.id, existingDoctorId))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const existingQuals = Array.isArray(target.qualifications) ? target.qualifications : [];
    const update: Record<string, unknown> = {
      qualifications: mergeArr(existingQuals, qualifications),
      updatedAt: new Date(),
    };
    if (!target.specialization && specialization) update.specialization = specialization;
    if (!target.bio && bio) update.bio = bio;
    if (!target.city && city) update.city = city;
    if (!target.phone && phone) update.phone = phone;
    if (!target.yearsOfExperience && yearsOfExperience) update.yearsOfExperience = yearsOfExperience;
    if (!target.consultationFee && consultationFee) update.consultationFee = consultationFee;

    await db.update(doctors).set(update).where(eq(doctors.id, target.id));

    await writeAuditLog({
      actorUserId: auth.userId,
      action: "doctor.research_save.updated",
      entityType: "doctor",
      entityId: target.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      changes: { fullName },
    });

    await writeDoctorReferences(target.id);

    return NextResponse.json({
      data: { action: "updated", doctorId: target.id, doctorSlug: target.slug, doctorName: fullName },
    });
  }

  // ── Check for exact name match (fallback when no existingDoctorId) ────────
  const [existing] = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      specialization: doctors.specialization,
      bio: doctors.bio,
      city: doctors.city,
      phone: doctors.phone,
      qualifications: doctors.qualifications,
      yearsOfExperience: doctors.yearsOfExperience,
      consultationFee: doctors.consultationFee,
    })
    .from(doctors)
    .where(eq(doctors.fullName, fullName))
    .limit(1);

  if (existing) {
    const existingQuals = Array.isArray(existing.qualifications) ? existing.qualifications : [];
    const update: Record<string, unknown> = {
      qualifications: mergeArr(existingQuals, qualifications),
      updatedAt: new Date(),
    };
    if (!existing.specialization && specialization) update.specialization = specialization;
    if (!existing.bio && bio) update.bio = bio;
    if (!existing.city && city) update.city = city;
    if (!existing.phone && phone) update.phone = phone;
    if (!existing.yearsOfExperience && yearsOfExperience) update.yearsOfExperience = yearsOfExperience;
    if (!existing.consultationFee && consultationFee) update.consultationFee = consultationFee;

    await db.update(doctors).set(update).where(eq(doctors.id, existing.id));

    await writeAuditLog({
      actorUserId: auth.userId,
      action: "doctor.research_save.updated",
      entityType: "doctor",
      entityId: existing.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      changes: { fullName },
    });

    await writeDoctorReferences(existing.id);

    return NextResponse.json({
      data: { action: "updated", doctorId: existing.id, doctorSlug: existing.slug, doctorName: fullName },
    });
  }

  // ── Create new doctor ─────────────────────────────────────────────────────
  let slug = slugify(fullName) || `doctor-${crypto.randomUUID().slice(0, 8)}`;
  let suffix = 0;
  for (;;) {
    const [conflict] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.slug, slug)).limit(1);
    if (!conflict) break;
    slug = `${slugify(fullName)}-${++suffix}`;
  }

  const [created] = await db
    .insert(doctors)
    .values({
      fullName,
      slug,
      specialization: specialization || undefined,
      bio: bio || undefined,
      city: city || undefined,
      phone: phone || undefined,
      qualifications: qualifications.length ? qualifications : [],
      yearsOfExperience: yearsOfExperience || undefined,
      consultationFee: consultationFee || undefined,
      isActive: true,
    })
    .returning({ id: doctors.id, slug: doctors.slug });

  await writeAuditLog({
    actorUserId: auth.userId,
    action: "doctor.research_save.created",
    entityType: "doctor",
    entityId: created.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    changes: { fullName, specialization, city },
  });

  await writeDoctorReferences(created.id);

  return NextResponse.json({
    data: { action: "created", doctorId: created.id, doctorSlug: created.slug, doctorName: fullName },
  });
}
