import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const roles = sqliteTable("roles", {
  id: id(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const users = sqliteTable(
  "users",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    sessionToken: text("session_token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("sessions_user_idx").on(table.userId)],
);

export const userRoleMap = sqliteTable(
  "user_role_map",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("user_role_unique_idx").on(table.userId, table.roleId)],
);

export const hospitals = sqliteTable("hospitals", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  city: text("city").notNull(),
  state: text("state"),
  country: text("country").notNull().default("India"),
  addressLine1: text("address_line_1"),
  phone: text("phone"),
  email: text("email"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const departments = sqliteTable("departments", {
  id: id(),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const doctors = sqliteTable("doctors", {
  id: id(),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  departmentId: text("department_id").references(() => departments.id),
  fullName: text("full_name").notNull(),
  specialization: text("specialization"),
  yearsOfExperience: integer("years_of_experience"),
  consultationFee: real("consultation_fee"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const taxonomyNodes = sqliteTable("taxonomy_nodes", {
  id: id(),
  type: text("type").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const taxonomyEdges = sqliteTable(
  "taxonomy_edges",
  {
    id: id(),
    parentNodeId: text("parent_node_id")
      .notNull()
      .references(() => taxonomyNodes.id),
    childNodeId: text("child_node_id")
      .notNull()
      .references(() => taxonomyNodes.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("taxonomy_parent_child_idx").on(table.parentNodeId, table.childNodeId)],
);

export const leads = sqliteTable("leads", {
  id: id(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city"),
  countryCode: text("country_code").default("+91"),
  status: text("status").notNull().default("new"),
  source: text("source").notNull().default("web"),
  score: integer("score").notNull().default(0),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  medicalSummary: text("medical_summary"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const leadEvents = sqliteTable("lead_events", {
  id: id(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  type: text("type").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const packages = sqliteTable("packages", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  monthlyPrice: real("monthly_price").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const packageFeatures = sqliteTable(
  "package_features",
  {
    id: id(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    featureKey: text("feature_key").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("package_feature_key_idx").on(table.packageId, table.featureKey)],
);

export const hospitalSubscriptions = sqliteTable("hospital_subscriptions", {
  id: id(),
  hospitalId: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  packageId: text("package_id")
    .notNull()
    .references(() => packages.id),
  status: text("status").notNull().default("active"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: id(),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  ipAddress: text("ip_address"),
  changes: text("changes", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const outboxEvents = sqliteTable("outbox_events", {
  id: id(),
  topic: text("topic").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  status: text("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});
