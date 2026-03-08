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

  const { hospitals, roles, taxonomyNodes, userRoleMap, users } = schema;

  const roleSeed = [
    { code: "owner", label: "Owner" },
    { code: "admin", label: "Admin" },
    { code: "advisor", label: "Advisor" },
    { code: "viewer", label: "Viewer" },
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

  if (!userId) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
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
    },
    { name: "Apollo Chennai", city: "Chennai", state: "Tamil Nadu" },
    { name: "Fortis Bangalore", city: "Bengaluru", state: "Karnataka" },
    { name: "Ruby Hall Pune", city: "Pune", state: "Maharashtra" },
  ];

  for (const item of hospitalSeed) {
    const slug = slugify(item.name);
    const exists = await db.select().from(hospitals).where(eq(hospitals.slug, slug)).limit(1);
    if (!exists.length) {
      await db.insert(hospitals).values({ ...item, slug });
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
