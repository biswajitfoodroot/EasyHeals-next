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

  const { fullName, specialization, city, phone, bio, qualifications = [], sourceUrl } = parsed.data;
  const userId = auth.userId;

  async function writeReferences(doctorId: string) {
    try {
      const url = sourceUrl ?? "ai_research";
      const [job] = await db.insert(ingestionJobs).values({
        requestedByUserId: userId,
        status: "completed",
        sourceUrl: url,
        searchQuery: fullName + (city ? ` ${city}` : ""),
        runMode: "ai_research",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: ingestionJobs.id });

      if (!job) return;

      type FieldRef = { key: string; value: string | null };
      const fieldRefs: FieldRef[] = [
        { key: "fullName",       value: fullName },
        { key: "specialization", value: specialization ?? null },
        { key: "bio",            value: bio ?? null },
        { key: "city",           value: city ?? null },
        { key: "phone",          value: phone ?? null },
        { key: "qualifications", value: qualifications.length ? qualifications.join(", ") : null },
      ];
      const toInsert = fieldRefs.filter(f => f.value);
      if (toInsert.length === 0) return;

      await db.insert(ingestionFieldConfidences).values(
        toInsert.map(f => ({
          jobId: job.id,
          entityType: "doctor" as const,
          entityId: doctorId,
          fieldKey: f.key,
          extractedValue: f.value,
          sourceType: "ai_research",
          sourceUrl: url,
          confidence: 0.75,
          reviewStatus: "applied",
        })),
      ).onConflictDoNothing().catch(() => null);
    } catch { /* non-critical */ }
  }

  // ── Check for exact name match ────────────────────────────────────────────
  const [existing] = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      specialization: doctors.specialization,
      bio: doctors.bio,
      city: doctors.city,
      phone: doctors.phone,
      qualifications: doctors.qualifications,
    })
    .from(doctors)
    .where(eq(doctors.fullName, fullName))
    .limit(1);

  if (existing) {
    // Update — only fill null/empty fields, merge qualifications
    const existingQuals = Array.isArray(existing.qualifications) ? existing.qualifications : [];
    const update: Record<string, unknown> = {
      qualifications: mergeArr(existingQuals, qualifications),
      updatedAt: new Date(),
    };
    if (!existing.specialization && specialization) update.specialization = specialization;
    if (!existing.bio && bio) update.bio = bio;
    if (!existing.city && city) update.city = city;
    if (!existing.phone && phone) update.phone = phone;

    await db.update(doctors).set(update).where(eq(doctors.id, existing.id));

    await writeAuditLog({
      actorUserId: auth.userId,
      action: "doctor.research_save.updated",
      entityType: "doctor",
      entityId: existing.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      changes: { fullName },
    });

    await writeReferences(existing.id);

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

  await writeReferences(created.id);

  return NextResponse.json({
    data: { action: "created", doctorId: created.id, doctorSlug: created.slug, doctorName: fullName },
  });
}
