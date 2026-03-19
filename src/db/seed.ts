import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { easyHealsPublicData } from "@/data/easyhealsPublicData";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function run() {
  const { db } = await import("@/db/client");
  const schema = await import("@/db/schema");
  const { slugify } = await import("@/lib/strings");

  const { doctorHospitalAffiliations, doctors, hospitals, roles, taxonomyNodes, userRoleMap, users } = schema;

  const roleSeed = [
    { code: "owner", label: "Owner" },
    { code: "admin", label: "Admin" },
    { code: "advisor", label: "Advisor" },
    { code: "viewer", label: "Viewer" },
    { code: "hospital_admin", label: "Hospital Admin" },
    { code: "doctor", label: "Doctor" },
  ];

  for (const role of roleSeed) {
    const exists = await db.select().from(roles).where(eq(roles.code, role.code)).limit(1);
    if (!exists.length) {
      await db.insert(roles).values(role);
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@easyheals-next.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const adminRows = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  let userId = adminRows[0]?.id;
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (!userId) {
    const [admin] = await db
      .insert(users)
      .values({
        fullName: "EasyHeals Admin",
        email: adminEmail,
        passwordHash,
        isActive: true,
      })
      .returning();

    userId = admin.id;
  } else {
    await db
      .update(users)
      .set({
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
  if (adminRole && userId) {
    const roleMapExists = await db
      .select()
      .from(userRoleMap)
      .where(eq(userRoleMap.userId, userId))
      .limit(1);

    if (!roleMapExists.length) {
      await db.insert(userRoleMap).values({ userId, roleId: adminRole.id });
    }
  }

  const hospitalSeed = [
    {
      name: "EasyHeals Care Hub Pune",
      city: "Pune",
      state: "Maharashtra",
      phone: easyHealsPublicData.contact.phone,
      email: easyHealsPublicData.contact.email,
      addressLine1: easyHealsPublicData.contact.address,
      description: "Trusted multi-speciality private care center with citywide referral network.",
      specialties: ["Cardiology", "Orthopaedics", "Neurology"],
      facilities: ["24x7 ICU", "Emergency", "In-house Diagnostics"],
      verified: true,
      communityVerified: true,
      rating: 4.8,
      reviewCount: 1230,
    },
    {
      name: "Apollo Hospital Pune",
      city: "Pune",
      state: "Maharashtra",
      addressLine1: "Baner, Pune",
      phone: "+91-2067000000",
      specialties: ["Cardiology", "Oncology", "Neurology"],
      facilities: ["Cath Lab", "Transplant Unit"],
      verified: true,
      communityVerified: true,
      rating: 4.9,
      reviewCount: 2300,
    },
    {
      name: "Fortis Hospital Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      addressLine1: "Vashi, Navi Mumbai",
      phone: "+91-2265000000",
      specialties: ["Cardiology", "Orthopaedics", "Gastroenterology"],
      facilities: ["ICU", "Trauma Center"],
      verified: true,
      communityVerified: true,
      rating: 4.8,
      reviewCount: 1800,
    },
    {
      name: "Manipal Hospital Bengaluru",
      city: "Bengaluru",
      state: "Karnataka",
      addressLine1: "Whitefield, Bengaluru",
      phone: "+91-8040000000",
      specialties: ["Neurology", "Oncology", "Orthopaedics"],
      facilities: ["Neuro ICU", "Cancer Center"],
      verified: true,
      communityVerified: true,
      rating: 4.7,
      reviewCount: 3100,
    },
  ];

  for (const item of hospitalSeed) {
    const slug = slugify(item.name);
    const exists = await db.select().from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!exists.length) {
      await db.insert(hospitals).values({ ...item, slug });
    }
  }

  const hospitalRows = await db
    .select({ id: hospitals.id, slug: hospitals.slug, city: hospitals.city })
    .from(hospitals)
    .where(eq(hospitals.isActive, true));
  const hospitalBySlug = new Map(hospitalRows.map((item) => [item.slug, item]));

  const doctorSeed = [
    {
      fullName: "Dr. Priya Verma",
      specialization: "Cardiology",
      specialties: ["Heart Failure", "Interventional Cardiology", "ECG"],
      qualifications: ["MBBS", "MD", "DM Cardiology"],
      languages: ["English", "Hindi", "Marathi"],
      city: "Pune",
      state: "Maharashtra",
      phone: "+91-9000011111",
      yearsOfExperience: 14,
      consultationFee: 1200,
      feeMin: 900,
      feeMax: 1500,
      rating: 4.9,
      reviewCount: 680,
      verified: true,
      bio: "Cardiology specialist focused on preventive and interventional care.",
      affiliations: [
        {
          hospitalSlug: slugify("EasyHeals Care Hub Pune"),
          role: "Senior Consultant",
          schedule: { mon: "10:00-14:00", wed: "10:00-14:00", fri: "10:00-14:00" },
          isPrimary: true,
        },
        {
          hospitalSlug: slugify("Apollo Hospital Pune"),
          role: "Visiting Consultant",
          schedule: { tue: "17:00-20:00", sat: "11:00-14:00" },
          isPrimary: false,
        },
      ],
    },
    {
      fullName: "Dr. Raj Kulkarni",
      specialization: "Orthopaedics",
      specialties: ["Joint Replacement", "Sports Injury", "Arthroscopy"],
      qualifications: ["MBBS", "MS Ortho"],
      languages: ["English", "Hindi", "Marathi"],
      city: "Pune",
      state: "Maharashtra",
      phone: "+91-9000022222",
      yearsOfExperience: 11,
      consultationFee: 1000,
      feeMin: 800,
      feeMax: 1400,
      rating: 4.8,
      reviewCount: 520,
      verified: true,
      bio: "Orthopaedic surgeon for knee replacement and trauma care.",
      affiliations: [
        {
          hospitalSlug: slugify("EasyHeals Care Hub Pune"),
          role: "Consultant Ortho Surgeon",
          schedule: { mon: "16:00-20:00", thu: "16:00-20:00" },
          isPrimary: true,
        },
      ],
    },
    {
      fullName: "Dr. Nisha Menon",
      specialization: "Neurology",
      specialties: ["Stroke", "Epilepsy", "Neuro Rehabilitation"],
      qualifications: ["MBBS", "MD", "DM Neurology"],
      languages: ["English", "Hindi", "Kannada"],
      city: "Bengaluru",
      state: "Karnataka",
      phone: "+91-9000033333",
      yearsOfExperience: 13,
      consultationFee: 1300,
      feeMin: 1100,
      feeMax: 1700,
      rating: 4.7,
      reviewCount: 430,
      verified: true,
      bio: "Neurology consultant handling headache, stroke, and seizure pathways.",
      affiliations: [
        {
          hospitalSlug: slugify("Manipal Hospital Bengaluru"),
          role: "Senior Neurologist",
          schedule: { tue: "09:00-13:00", fri: "09:00-13:00" },
          isPrimary: true,
        },
      ],
    },
  ];

  for (const item of doctorSeed) {
    const slug = slugify(`${item.fullName}-${item.city}`);
    const exists = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.slug, slug)).limit(1);

    let doctorId = exists[0]?.id;

    if (!doctorId) {
      const [created] = await db
        .insert(doctors)
        .values({
          fullName: item.fullName,
          slug,
          specialization: item.specialization,
          specialties: item.specialties,
          qualifications: item.qualifications,
          languages: item.languages,
          city: item.city,
          state: item.state,
          phone: item.phone,
          yearsOfExperience: item.yearsOfExperience,
          consultationFee: item.consultationFee,
          feeMin: item.feeMin,
          feeMax: item.feeMax,
          rating: item.rating,
          reviewCount: item.reviewCount,
          verified: item.verified,
          bio: item.bio,
          consultationHours: { weekday: "10:00-19:00", saturday: "10:00-14:00" },
          isActive: true,
        })
        .returning({ id: doctors.id });

      doctorId = created.id;
    }

    if (!doctorId) continue;

    for (const affiliation of item.affiliations) {
      const hospital = hospitalBySlug.get(affiliation.hospitalSlug);
      if (!hospital) continue;

      await db
        .insert(doctorHospitalAffiliations)
        .values({
          doctorId,
          hospitalId: hospital.id,
          role: affiliation.role,
          schedule: affiliation.schedule,
          isPrimary: affiliation.isPrimary,
          isActive: true,
          source: "seed",
        })
        .onConflictDoUpdate({
          target: [doctorHospitalAffiliations.doctorId, doctorHospitalAffiliations.hospitalId],
          set: {
            role: affiliation.role,
            schedule: affiliation.schedule,
            isPrimary: affiliation.isPrimary,
            isActive: true,
            source: "seed",
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
    }
  }

  const taxonomySeed = [
    ...easyHealsPublicData.services.map((title) => ({
      type: "service",
      title,
      description: "Imported from EasyHeals public services navigation.",
    })),
    ...easyHealsPublicData.specialties.map((title) => ({
      type: "specialty",
      title,
      description: "Imported from EasyHeals public specialties metadata.",
    })),
    ...easyHealsPublicData.treatments.map((title) => ({
      type: "treatment",
      title,
      description: "Imported from EasyHeals public treatment metadata.",
    })),
    ...easyHealsPublicData.symptoms.map((title) => ({
      type: "symptom",
      title,
      description: "Imported from EasyHeals public symptoms metadata.",
    })),
  ];

  for (const item of taxonomySeed) {
    const slug = slugify(`${item.type}-${item.title}`);
    const exists = await db.select().from(taxonomyNodes).where(eq(taxonomyNodes.slug, slug)).limit(1);
    if (!exists.length) {
      await db.insert(taxonomyNodes).values({ ...item, slug });
    }
  }

  console.log("Seed complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

