/**
 * GET  /api/portal/hospital/doctors — list doctors affiliated with the hospital
 * POST /api/portal/hospital/doctors — add/create a doctor for the hospital
 * PATCH /api/portal/hospital/doctors?id=xxx — update a doctor
 * DELETE /api/portal/hospital/doctors?id=xxx — remove affiliation
 */
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { doctors, doctorHospitalAffiliations, hospitals } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { ensureRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

async function resolveHospitalId(auth: { role: string; entityId: string | null }, req: NextRequest): Promise<string | null> {
  if (auth.role === "hospital_admin") return auth.entityId;
  const url = new URL(req.url);
  return url.searchParams.get("hospitalId") ?? auth.entityId;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });

  // Verify ownership for hospital_admin
  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Affiliations table is the single source of truth — never use doctors.hospitalId for lookup
  const affiliations = await db
    .select({ doctor: doctors })
    .from(doctorHospitalAffiliations)
    .innerJoin(doctors, eq(doctorHospitalAffiliations.doctorId, doctors.id))
    .where(
      and(
        eq(doctorHospitalAffiliations.hospitalId, hospitalId),
        eq(doctorHospitalAffiliations.isActive, true),
      ),
    )
    .orderBy(asc(doctors.fullName));

  return NextResponse.json({ data: affiliations.map((r) => r.doctor) });
}

const doctorSchema = z.object({
  /** If provided, attach this existing doctor to the hospital instead of creating a new one */
  existingDoctorId: z.string().optional(),
  fullName: z.string().max(200).default(""),
  specialization: z.string().max(200).optional().nullable(),
  specialties: z.array(z.string()).optional(),
  qualifications: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().max(3000).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  yearsOfExperience: z.number().int().min(0).optional().nullable(),
  consultationFee: z.number().min(0).optional().nullable(),
  feeMin: z.number().min(0).optional().nullable(),
  feeMax: z.number().min(0).optional().nullable(),
  consultationHours: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });
  if (auth.role === "hospital_admin" && auth.entityId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = doctorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;

  // ── Attach existing doctor ──
  if (d.existingDoctorId) {
    const [existingDoc] = await db.select({ id: doctors.id, fullName: doctors.fullName })
      .from(doctors).where(eq(doctors.id, d.existingDoctorId)).limit(1);
    if (!existingDoc) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

    // Check if already affiliated
    const [existingAff] = await db.select({ id: doctorHospitalAffiliations.id })
      .from(doctorHospitalAffiliations)
      .where(and(eq(doctorHospitalAffiliations.doctorId, existingDoc.id), eq(doctorHospitalAffiliations.hospitalId, hospitalId)))
      .limit(1);

    if (!existingAff) {
      await db.insert(doctorHospitalAffiliations).values({
        doctorId: existingDoc.id,
        hospitalId,
        role: "Consultant",
        isPrimary: false,
        source: "portal",
        isActive: true,
      });
    }

    await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.doctor.attach", entityType: "doctor", entityId: existingDoc.id, changes: { hospitalId } });
    return NextResponse.json({ data: existingDoc, attached: true }, { status: 200 });
  }

  // ── Create new doctor ──
  if (!d.fullName || d.fullName.trim().length < 2) {
    return NextResponse.json({ error: "fullName is required (min 2 chars)" }, { status: 400 });
  }
  const baseSlug = slugify(`${d.fullName}`);
  const existing = await db.select({ slug: doctors.slug }).from(doctors).where(eq(doctors.slug, baseSlug)).limit(1);
  const slug = existing.length > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

  const [hospital] = await db.select({ city: hospitals.city, state: hospitals.state }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);

  const [created] = await db.insert(doctors).values({
    hospitalId,
    fullName: d.fullName,
    slug,
    specialization: d.specialization ?? null,
    specialties: d.specialties ?? [],
    qualifications: d.qualifications ?? [],
    languages: d.languages ?? [],
    bio: d.bio ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    avatarUrl: d.avatarUrl ?? null,
    yearsOfExperience: d.yearsOfExperience ?? null,
    consultationFee: d.consultationFee ?? null,
    feeMin: d.feeMin ?? null,
    feeMax: d.feeMax ?? null,
    consultationHours: d.consultationHours ?? null,
    city: hospital?.city ?? null,
    state: hospital?.state ?? null,
    isActive: d.isActive ?? true,
  }).returning();

  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.doctor.create", entityType: "doctor", entityId: created.id, changes: { fullName: d.fullName } });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("id");
  if (!doctorId) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });

  // Verify doctor belongs to this hospital
  const [existing] = await db.select({ hospitalId: doctors.hospitalId }).from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (auth.role === "hospital_admin" && existing.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = doctorSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const updates: Partial<typeof doctors.$inferInsert> = { updatedAt: new Date() };
  if (d.fullName !== undefined) updates.fullName = d.fullName;
  if (d.specialization !== undefined) updates.specialization = d.specialization;
  if (d.specialties !== undefined) updates.specialties = d.specialties;
  if (d.qualifications !== undefined) updates.qualifications = d.qualifications;
  if (d.languages !== undefined) updates.languages = d.languages;
  if (d.bio !== undefined) updates.bio = d.bio;
  if (d.phone !== undefined) updates.phone = d.phone;
  if (d.email !== undefined) updates.email = d.email;
  if (d.avatarUrl !== undefined) updates.avatarUrl = d.avatarUrl;
  if (d.yearsOfExperience !== undefined) updates.yearsOfExperience = d.yearsOfExperience;
  if (d.consultationFee !== undefined) updates.consultationFee = d.consultationFee;
  if (d.feeMin !== undefined) updates.feeMin = d.feeMin;
  if (d.feeMax !== undefined) updates.feeMax = d.feeMax;
  if (d.consultationHours !== undefined) updates.consultationHours = d.consultationHours;
  if (d.isActive !== undefined) updates.isActive = d.isActive;

  const [updated] = await db.update(doctors).set(updates).where(eq(doctors.id, doctorId)).returning();
  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.doctor.update", entityType: "doctor", entityId: doctorId, changes: d });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = ensureRole(auth.role, ["owner", "admin", "advisor", "hospital_admin"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("id");
  if (!doctorId) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const hospitalId = await resolveHospitalId(auth, req);
  if (!hospitalId) return NextResponse.json({ error: "No linked hospital" }, { status: 400 });

  const [existing] = await db.select({ hospitalId: doctors.hospitalId }).from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (auth.role === "hospital_admin" && existing.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft-delete: set isActive = false
  await db.update(doctors).set({ isActive: false, updatedAt: new Date() }).where(eq(doctors.id, doctorId));
  await writeAuditLog({ actorUserId: auth.userId, action: "portal.hospital.doctor.deactivate", entityType: "doctor", entityId: doctorId, changes: {} });
  return NextResponse.json({ ok: true });
}
