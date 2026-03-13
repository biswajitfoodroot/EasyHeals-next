import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    passwordHash: text("password_hash"),
    googleId: text("google_id"),
    googleAvatar: text("google_avatar"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_google_id_idx").on(table.googleId),
  ],
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
  (table) => [index("sessions_user_idx").on(table.userId)],
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

export const hospitals = sqliteTable(
  "hospitals",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    type: text("type").notNull().default("hospital"),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(true),
    city: text("city").notNull(),
    state: text("state"),
    country: text("country").notNull().default("India"),
    addressLine1: text("address_line_1"),
    address: text("address", { mode: "json" }).$type<Record<string, unknown> | null>(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    phone: text("phone"),
    phones: text("phones", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    email: text("email"),
    website: text("website"),
    specialties: text("specialties", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    facilities: text("facilities", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    workingHours: text("working_hours", { mode: "json" }).$type<Record<string, unknown> | null>(),
    feesRange: text("fees_range", { mode: "json" }).$type<Record<string, unknown> | null>(),
    photos: text("photos", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    accreditations: text("accreditations", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    description: text("description"),
    source: text("source").notNull().default("crowd"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    communityVerified: integer("community_verified", { mode: "boolean" }).notNull().default(false),
    contributionCount: integer("contribution_count").notNull().default(0),
    claimed: integer("claimed", { mode: "boolean" }).notNull().default(false),
    claimedBy: text("claimed_by").references(() => users.id),
    regStatus: text("reg_status").notNull().default("pending"),
    packageTier: text("package_tier").notNull().default("free"),
    googlePlaceId: text("google_place_id").unique(),
    rating: real("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("hospitals_city_name_idx").on(table.city, table.name),
    uniqueIndex("hospitals_slug_unique_idx").on(table.slug),
  ],
);

export const hospitalListingPackages = sqliteTable(
  "hospital_listing_packages",
  {
    id: id(),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    packageName: text("package_name").notNull(),
    procedureName: text("procedure_name"),
    department: text("department"),
    priceMin: real("price_min"),
    priceMax: real("price_max"),
    currency: text("currency").notNull().default("INR"),
    inclusions: text("inclusions", { mode: "json" }).$type<Record<string, unknown> | null>(),
    exclusions: text("exclusions", { mode: "json" }).$type<Record<string, unknown> | null>(),
    lengthOfStay: text("length_of_stay"),
    source: text("source").notNull().default("admin_ingestion"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("hospital_listing_package_unique_idx").on(table.hospitalId, table.packageName)],
);

export const contributions = sqliteTable("contributions", {
  id: id(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  contributorId: text("contributor_id").references(() => users.id),
  changeType: text("change_type").notNull().default("update"),
  fieldChanged: text("field_changed"),
  oldValue: text("old_value", { mode: "json" }).$type<Record<string, unknown> | null>(),
  newValue: text("new_value", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  outlierScore: integer("outlier_score").notNull().default(0),
  outlierFlags: text("outlier_flags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  aiConfidence: real("ai_confidence"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  rejectReason: text("reject_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const contributorTrust = sqliteTable(
  "contributor_trust",
  {
    id: id(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => users.id),
    trustScore: integer("trust_score").notNull().default(50),
    totalEdits: integer("total_edits").notNull().default(0),
    approvedEdits: integer("approved_edits").notNull().default(0),
    rejectedEdits: integer("rejected_edits").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("contributor_trust_user_idx").on(table.contributorId)],
);

export const hospitalAccounts = sqliteTable(
  "hospital_accounts",
  {
    id: id(),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    contactName: text("contact_name").notNull(),
    designation: text("designation"),
    otpVerified: integer("otp_verified", { mode: "boolean" }).notNull().default(false),
    packageTier: text("package_tier").notNull().default("free"),
    packageExpires: integer("package_expires", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("hospital_accounts_email_idx").on(table.email),
    uniqueIndex("hospital_accounts_hospital_email_idx").on(table.hospitalId, table.email),
  ],
);

export const otpVerifications = sqliteTable("otp_verifications", {
  id: id(),
  phone: text("phone").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const searchLogs = sqliteTable("search_logs", {
  id: id(),
  queryHash: text("query_hash").notNull(),
  detectedIntent: text("detected_intent"),
  detectedLang: text("detected_lang"),
  resultCount: integer("result_count").notNull().default(0),
  city: text("city"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
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
  slug: text("slug").notNull().unique(),
  specialization: text("specialization"),
  specialties: text("specialties", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  qualifications: text("qualifications", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  languages: text("languages", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  consultationHours: text("consultation_hours", { mode: "json" }).$type<Record<string, unknown> | null>(),
  bio: text("bio"),
  city: text("city"),
  state: text("state"),
  phone: text("phone"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  yearsOfExperience: integer("years_of_experience"),
  consultationFee: real("consultation_fee"),
  feeMin: real("fee_min"),
  feeMax: real("fee_max"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  aiEnrichedAt: integer("ai_enriched_at", { mode: "timestamp_ms" }),
  aiReviewSummary: text("ai_review_summary"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const doctorHospitalAffiliations = sqliteTable(
  "doctor_hospital_affiliations",
  {
    id: id(),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    role: text("role").notNull().default("Visiting Consultant"),
    schedule: text("schedule", { mode: "json" }).$type<Record<string, unknown> | null>(),
    feeMin: real("fee_min"),
    feeMax: real("fee_max"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    source: text("source").notNull().default("manual"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("doctor_hospital_affiliation_unique_idx").on(table.doctorId, table.hospitalId),
  ],
);

export const ingestionJobs = sqliteTable("ingestion_jobs", {
  id: id(),
  requestedByUserId: text("requested_by_user_id").references(() => users.id),
  status: text("status").notNull().default("queued"),
  sourceUrl: text("source_url").notNull(),
  searchQuery: text("search_query"),
  targetCity: text("target_city"),
  runMode: text("run_mode").notNull().default("website_google"),
  summary: text("summary", { mode: "json" }).$type<Record<string, unknown> | null>(),
  aiMergedPayload: text("ai_merged_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const ingestionSources = sqliteTable("ingestion_sources", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => ingestionJobs.id),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  title: text("title"),
  snippet: text("snippet"),
  rawContent: text("raw_content"),
  structuredPayload: text("structured_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
  confidence: real("confidence"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const ingestionHospitalCandidates = sqliteTable(
  "ingestion_hospital_candidates",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => ingestionJobs.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name"),
    city: text("city"),
    state: text("state"),
    country: text("country").default("India"),
    addressLine1: text("address_line_1"),
    addressData: text("address_data", { mode: "json" }).$type<Record<string, unknown> | null>(),
    phone: text("phone"),
    contactNumbers: text("contact_numbers", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    whatsapp: text("whatsapp"),
    email: text("email"),
    website: text("website"),
    socialLinks: text("social_links", { mode: "json" }).$type<Record<string, unknown> | null>(),
    operatingHours: text("operating_hours", { mode: "json" }).$type<Record<string, unknown> | null>(),
    departments: text("departments", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    majorServices: text("major_services", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    keyFacilities: text("key_facilities", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    uniqueOfferings: text("unique_offerings", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    specialties: text("specialties", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    services: text("services", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    description: text("description"),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    sourceLinks: text("source_links", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    outlierFlags: text("outlier_flags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    rawPayload: text("raw_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
    aiConfidence: real("ai_confidence"),
    matchHospitalId: text("match_hospital_id").references(() => hospitals.id),
    mergeAction: text("merge_action").notNull().default("review"),
    applyStatus: text("apply_status").notNull().default("draft"),
    reviewStatus: text("review_status").notNull().default("draft"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [uniqueIndex("ingestion_hospital_candidate_unique_idx").on(table.jobId, table.name, table.city)],
);

export const ingestionDoctorCandidates = sqliteTable(
  "ingestion_doctor_candidates",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => ingestionJobs.id),
    hospitalCandidateId: text("hospital_candidate_id").references(() => ingestionHospitalCandidates.id),
    fullName: text("full_name").notNull(),
    normalizedName: text("normalized_name"),
    specialization: text("specialization"),
    qualifications: text("qualifications", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    languages: text("languages", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    phone: text("phone"),
    email: text("email"),
    yearsOfExperience: integer("years_of_experience"),
    feeMin: real("fee_min"),
    feeMax: real("fee_max"),
    consultationFee: real("consultation_fee"),
    consultationDays: text("consultation_days", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    opdTiming: text("opd_timing"),
    schedule: text("schedule", { mode: "json" }).$type<Record<string, unknown> | null>(),
    outlierFlags: text("outlier_flags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    rawPayload: text("raw_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
    aiConfidence: real("ai_confidence"),
    matchDoctorId: text("match_doctor_id").references(() => doctors.id),
    mergeAction: text("merge_action").notNull().default("review"),
    applyStatus: text("apply_status").notNull().default("draft"),
    reviewStatus: text("review_status").notNull().default("draft"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("ingestion_doctor_candidate_unique_idx").on(table.jobId, table.fullName, table.specialization),
  ],
);

export const ingestionServiceCandidates = sqliteTable("ingestion_service_candidates", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => ingestionJobs.id),
  hospitalCandidateId: text("hospital_candidate_id").references(() => ingestionHospitalCandidates.id),
  serviceName: text("service_name").notNull(),
  category: text("category"),
  description: text("description"),
  sourceLinks: text("source_links", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  outlierFlags: text("outlier_flags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  rawPayload: text("raw_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
  aiConfidence: real("ai_confidence"),
  mergeAction: text("merge_action").notNull().default("review"),
  applyStatus: text("apply_status").notNull().default("draft"),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const ingestionPackageCandidates = sqliteTable("ingestion_package_candidates", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => ingestionJobs.id),
  hospitalCandidateId: text("hospital_candidate_id").references(() => ingestionHospitalCandidates.id),
  packageName: text("package_name").notNull(),
  procedureName: text("procedure_name"),
  department: text("department"),
  priceMin: real("price_min"),
  priceMax: real("price_max"),
  currency: text("currency").notNull().default("INR"),
  inclusions: text("inclusions", { mode: "json" }).$type<Record<string, unknown> | null>(),
  exclusions: text("exclusions", { mode: "json" }).$type<Record<string, unknown> | null>(),
  lengthOfStay: text("length_of_stay"),
  outlierFlags: text("outlier_flags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  rawPayload: text("raw_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
  aiConfidence: real("ai_confidence"),
  mergeAction: text("merge_action").notNull().default("review"),
  applyStatus: text("apply_status").notNull().default("draft"),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

export const ingestionFieldConfidences = sqliteTable(
  "ingestion_field_confidences",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => ingestionJobs.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldKey: text("field_key").notNull(),
    extractedValue: text("extracted_value"),
    sourceType: text("source_type"),
    sourceUrl: text("source_url"),
    confidence: real("confidence").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [
    uniqueIndex("ingestion_field_confidence_unique_idx").on(
      table.jobId,
      table.entityType,
      table.entityId,
      table.fieldKey,
    ),
  ],
);

export const ingestionResearchQueue = sqliteTable("ingestion_research_queue", {
  id: id(),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  query: text("query").notNull(),
  sourceTitle: text("source_title"),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull().default("google_result"),
  queueStatus: text("queue_status").notNull().default("queued"),
  nextAction: text("next_action").notNull().default("scrape_website"),
  linkedJobId: text("linked_job_id").references(() => ingestionJobs.id),
  failureReason: text("failure_reason"),
  taskPayload: text("task_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
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



