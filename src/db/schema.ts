import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Re-export for convenience
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

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
    // KYC status for provider accounts (hospital_admin / doctor roles)
    kycStatus: text("kyc_status").notNull().default("not_required"),
    // values: not_required | pending | submitted | approved | rejected
    // P2 — TOTP (HLD §8.2 G-TOTP gate — mandatory for owner/admin)
    totpSecret: text("totp_secret"),               // base32-encoded TOTP secret (encrypted at rest)
    totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
    totpRecoveryCodes: text("totp_recovery_codes", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
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
    // P1 stub: distinguish admin vs portal sessions for different TTL enforcement
    sessionType: text("session_type").notNull().default("admin"), // admin | portal | patient
    // P2 — TOTP gate (null = TOTP not yet validated for this session)
    totpVerifiedAt: integer("totp_verified_at", { mode: "timestamp_ms" }),
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
    // CRM mirror fields — present in the shared DB, do not drop on Drizzle select
    contactPerson: text("contact_person"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    emailIds: text("email_ids", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    accreditation: text("accreditation"), // CRM singular; Next.js uses accreditations (JSON array)
    // P2 stubs
    whatsappBusinessNumber: text("whatsapp_business_number"),
    queueEnabled: integer("queue_enabled", { mode: "boolean" }).default(false),
    broadcastEnabled: integer("broadcast_enabled", { mode: "boolean" }).default(false),
    slotDurationMinutes: integer("slot_duration_minutes").default(15),
    maxDailyAppointments: integer("max_daily_appointments"),
    razorpayCustomerId: text("razorpay_customer_id"),
    consultationCoordinatorEnabled: integer("consultation_coordinator_enabled", { mode: "boolean" }).default(false),
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
  phone: text("phone"),
  phoneHash: text("phone_hash").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  channel: text("channel"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

// Patient sessions — DB fallback when Upstash Redis is not configured (local dev)
export const patientSessions = sqliteTable(
  "patient_sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256 of raw cookie token
    patientId: text("patient_id").notNull(),
    phoneHash: text("phone_hash").notNull(),
    phoneEncrypted: text("phone_encrypted"),
    city: text("city"),
    lang: text("lang").notNull().default("en"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
      sql`(unixepoch() * 1000)`,
    ),
  },
  (table) => [index("patient_sessions_token_idx").on(table.tokenHash)],
);

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
  // CRM mirror fields — present in shared DB doctors table
  name: text("name"),             // CRM canonical name (Next.js uses fullName → full_name column)
  qualification: text("qualification"),   // CRM singular (Next.js uses qualifications JSON array)
  contactPhone: text("contact_phone"),    // CRM column (Next.js uses phone)
  contactEmail: text("contact_email"),    // CRM column (Next.js uses email)
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
    reviewStatus: text("review_status").notNull().default("draft"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
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
  // P1 — link to consent-gated patient identity
  patientId: text("patient_id").references(() => patients.id),
  consentRecordId: text("consent_record_id").references(() => consentRecords.id),
  // P2 stubs
  assignedDoctorId: text("assigned_doctor_id").references(() => doctors.id),
  preferredSlotDate: integer("preferred_slot_date", { mode: "timestamp_ms" }),
  appointmentId: text("appointment_id").references(() => appointments.id),
  broadcastCampaignId: text("broadcast_campaign_id"),
  whatsappSent: integer("whatsapp_sent", { mode: "boolean" }).default(false),
  easyhealOwnerId: text("easyheal_owner_id").references(() => users.id),
  easyhealNotes: text("easyheal_notes"),
  // P5 stub
  prescriptionRequestId: text("prescription_request_id"),
  // CRM bridge columns — added to CRM leads table via INT-A.4 migration
  refId: text("ref_id"),                       // CRM-style EH-XXXXXX reference (generated by generateCrmRefId)
  sourcePlatform: text("source_platform").default("web"), // 'crm' | 'easyheals_platform' | 'agent_portal'
  phoneHash: text("phone_hash"),               // DPDP-safe hashed phone (no raw PII in shared DB)
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

// ─────────────────────────────────────────────────────────────────────────────
// P1 NEW TABLES — patients, consent, gamification, config, analytics, payments
// ─────────────────────────────────────────────────────────────────────────────

// TABLE 1: patients — phone-hash identity, no raw PII stored
// deletedAt enables soft-delete for DPDP right-to-erasure (§G10)
export const patients = sqliteTable(
  "patients",
  {
    id: id(),
    phoneHash: text("phone_hash").notNull().unique(), // SHA-256(phone+PHONE_SALT)
    city: text("city"),
    deviceFpHash: text("device_fp_hash"),
    displayAlias: text("display_alias"), // e.g. "Priya ****23" — shown on leaderboard
    leaderboardOptOut: integer("leaderboard_opt_out", { mode: "boolean" }).notNull().default(false),
    legalBasis: text("legal_basis").notNull().default("dpdp_consent"), // for legacy migration rows: "legitimate_interest_pre_dpdp"
    // P2 stubs
    phoneEncrypted: text("phone_encrypted"),   // AES-256-GCM — needed for WhatsApp delivery
    preferredLang: text("preferred_lang").default("en"),
    // P3 stubs (nullable — populated only after EMR consent + emr_lite flag ON)
    dateOfBirth: integer("date_of_birth", { mode: "timestamp_ms" }),
    gender: text("gender"),          // male | female | other | prefer_not_to_say
    bloodGroup: text("blood_group"), // A+ A- B+ B- O+ O- AB+ AB-
    // P4 stub
    abhaId: text("abha_id"),
    // P5 stub
    preferredPharmacyId: text("preferred_pharmacy_id"),
    // Google auth (P5 — patient Google Sign-In)
    googleId: text("google_id"),       // Google sub — unique identifier
    googleEmail: text("google_email"), // Email from Google profile
    googleName: text("google_name"),   // Display name
    googleAvatar: text("google_avatar"), // Profile picture URL
    // Subscription & trial (P5 — 3-week free trial, then paid)
    trialStartedAt: integer("trial_started_at", { mode: "timestamp_ms" }),    // set on first premium feature use
    subscriptionTier: text("subscription_tier").default("free"),               // free | health_plus | health_pro
    subscriptionExpiresAt: integer("subscription_expires_at", { mode: "timestamp_ms" }), // null = no active paid sub
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("patients_phone_hash_idx").on(table.phoneHash),
    index("patients_city_idx").on(table.city),
    index("patients_google_id_idx").on(table.googleId),
  ],
);

// TABLE 2: consent_records — DPDP Act 2023 consent per purpose
// ⚠ patientId NOT NULL — consent can only be created AFTER OTP creates the patient row.
// Flow: otp/send → otp/verify (creates patient) → POST /api/v1/consent → POST /api/v1/leads
export const consentRecords = sqliteTable(
  "consent_records",
  {
    id: id(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    purpose: text("purpose").notNull(), // booking_lead | analytics | marketing | ai_health | emr_access | referral
    version: text("version").notNull().default("1.0"),
    granted: integer("granted", { mode: "boolean" }).notNull(),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    channel: text("channel").notNull().default("web"), // web | whatsapp | sms | app
    ipHash: text("ip_hash").notNull(),
    userAgentHash: text("user_agent_hash"),
    legalBasis: text("legal_basis").notNull().default("dpdp_consent"),
  },
  (table) => [
    index("consent_records_patient_idx").on(table.patientId),
    index("consent_records_patient_purpose_idx").on(table.patientId, table.purpose),
  ],
);

// TABLE 3: badges — badge catalogue
export const badges = sqliteTable("badges", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  tier: text("tier").notNull().default("bronze"), // bronze | silver | gold
  phaseRequired: text("phase_required").notNull().default("phase-a"),
  iconUrl: text("icon_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

// TABLE 4: user_points — gamification running total
// A1 fix: actorId/actorType replaces dual nullable userId/patientId FK anti-pattern
export const userPoints = sqliteTable(
  "user_points",
  {
    id: id(),
    actorId: text("actor_id").notNull(),     // users.id or patients.id
    actorType: text("actor_type").notNull(), // 'user' | 'patient'
    totalPoints: integer("total_points").notNull().default(0),
    lifetimePoints: integer("lifetime_points").notNull().default(0),
    level: integer("level").notNull().default(1),
    lastUpdated: integer("last_updated", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("user_points_actor_idx").on(table.actorId, table.actorType),
  ],
);

// TABLE 5: point_events — immutable points ledger with idempotency key
export const pointEvents = sqliteTable(
  "point_events",
  {
    id: id(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(), // 'user' | 'patient'
    eventType: text("event_type").notNull(), // PROFILE_COMPLETED | CONSENT_GRANTED | DAILY_CHECKIN | etc.
    points: integer("points").notNull(),
    proofId: text("proof_id").notNull(),  // unique per eventType — idempotency key
    proofType: text("proof_type").notNull(),
    deviceFpHash: text("device_fp_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("point_events_type_proof_idx").on(table.eventType, table.proofId),
    index("point_events_actor_idx").on(table.actorId, table.actorType),
  ],
);

// TABLE 6: user_badges — earned badges per actor
export const userBadges = sqliteTable(
  "user_badges",
  {
    id: id(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(), // 'user' | 'patient'
    badgeId: text("badge_id").notNull().references(() => badges.id),
    earnedAt: integer("earned_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    seen: integer("seen", { mode: "boolean" }).notNull().default(false),
    displayOnProfile: integer("display_on_profile", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("user_badges_actor_badge_idx").on(table.actorId, table.actorType, table.badgeId),
  ],
);

// TABLE 7: streaks — daily check-in streaks
export const streaks = sqliteTable(
  "streaks",
  {
    id: id(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(), // 'user' | 'patient'
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastActivityDate: integer("last_activity_date", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("streaks_actor_idx").on(table.actorId, table.actorType),
  ],
);

// TABLE 8: gamification_config — admin-configurable point values
export const gamificationConfig = sqliteTable("gamification_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

// TABLE 9: abuse_flags — device/account abuse detection
export const abuseFlags = sqliteTable(
  "abuse_flags",
  {
    id: id(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(), // 'user' | 'patient'
    flagType: text("flag_type").notNull(),   // duplicate_device | otp_flood | referral_loop
    deviceFpHash: text("device_fp_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolvedBy: text("resolved_by").references(() => users.id),
  },
  (table) => [
    index("abuse_flags_actor_idx").on(table.actorId, table.actorType),
    index("abuse_flags_type_idx").on(table.flagType),
  ],
);

// TABLE 10: system_config — admin-configurable rate limits + bot settings
export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // rate_limit | bot | gamification | seo
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  updatedBy: text("updated_by").references(() => users.id),
});

// TABLE 11: feature_flags — P1 ON / P2-P5 OFF by default (seeded)
export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  phase: text("phase").notNull().default("p2"), // p1 | p2 | p3 | p4 | p5
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  updatedBy: text("updated_by").references(() => users.id),
});

// TABLE 12: analytics_events — P1 stub, full consent-gated writes in P2
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: id(),
    eventName: text("event_name").notNull(),
    actorId: text("actor_id"),
    actorType: text("actor_type"),       // patient | user | anonymous
    properties: text("properties", { mode: "json" }).$type<Record<string, unknown>>(),
    sessionId: text("session_id"),
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("analytics_events_name_idx").on(table.eventName),
    index("analytics_events_actor_idx").on(table.actorId, table.actorType),
  ],
);

// TABLE 13: payment_transactions — P2 Razorpay stub (table exists in P1 for schema stability)
export const paymentTransactions = sqliteTable(
  "payment_transactions",
  {
    id: id(),
    patientId: text("patient_id").references(() => patients.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id"),
    amount: integer("amount").notNull(),          // in paise (e.g. 49900 = ₹499)
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"), // created | paid | failed | refunded
    purpose: text("purpose").notNull(), // membership | subscription | consultation
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("payment_transactions_patient_idx").on(table.patientId),
    index("payment_transactions_status_idx").on(table.status),
  ],
);

// TABLE 14: specialty_synonyms — multilingual search synonyms (admin-managed)
export const specialtySynonyms = sqliteTable(
  "specialty_synonyms",
  {
    id: id(),
    canonical: text("canonical").notNull(), // e.g. "Cardiology"
    synonym: text("synonym").notNull(),     // e.g. "heart doctor" | "dil ka doctor" | "cardiologist"
    lang: text("lang").notNull().default("en"), // en | hi | hinglish
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("specialty_synonyms_canonical_synonym_idx").on(table.canonical, table.synonym),
    index("specialty_synonyms_synonym_idx").on(table.synonym),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// P2 STUB TABLES — schema locked in P1 so P2 activation needs zero migration
// ─────────────────────────────────────────────────────────────────────────────

// P2 TABLE: appointments — patient books in_person or online_consultation slot
export const appointments = sqliteTable(
  "appointments",
  {
    id: id(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    doctorId: text("doctor_id").references(() => doctors.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    type: text("type").notNull().default("in_person"), // in_person | online_consultation
    status: text("status").notNull().default("requested"),
    // status lifecycle: requested → confirmed → in_progress → completed | cancelled | no_show
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    patientNotes: text("patient_notes"),           // patient-supplied context at booking time
    consentRecordId: text("consent_record_id"),    // DPDP — FK to consent_records
    sourcePlatform: text("source_platform").default("web"), // web | crm | agent_portal
    slotId: text("slot_id"), // booked slot (if slot-based)
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("appointments_patient_idx").on(table.patientId),
    index("appointments_doctor_idx").on(table.doctorId),
    index("appointments_hospital_idx").on(table.hospitalId),
    index("appointments_status_idx").on(table.status),
    index("appointments_scheduled_idx").on(table.scheduledAt),
  ],
);

// P2 TABLE: appointment_slots — available time slots per doctor/hospital
export const appointmentSlots = sqliteTable(
  "appointment_slots",
  {
    id: id(),
    doctorId: text("doctor_id").references(() => doctors.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    isBooked: integer("is_booked", { mode: "boolean" }).notNull().default(false),
    appointmentId: text("appointment_id").references(() => appointments.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("appointment_slots_doctor_time_idx").on(table.doctorId, table.startsAt),
    index("appointment_slots_hospital_time_idx").on(table.hospitalId, table.startsAt),
  ],
);

// P2 TABLE: consultation_messages — async text exchange pre/post appointment
export const consultationMessages = sqliteTable(
  "consultation_messages",
  {
    id: id(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id),
    senderActorId: text("sender_actor_id").notNull(),
    senderActorType: text("sender_actor_type").notNull(), // patient | user
    body: text("body").notNull(),
    attachmentUrl: text("attachment_url"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("consultation_messages_appointment_idx").on(table.appointmentId, table.sentAt),
  ],
);

// P2/P3 TABLE: consultation_room_configs — per-hospital/doctor video room settings
// provider, participant types, recording, waiting room all configurable here
export const consultationRoomConfigs = sqliteTable(
  "consultation_room_configs",
  {
    id: id(),
    entityType: text("entity_type").notNull(), // hospital | doctor
    entityId: text("entity_id").notNull(),
    provider: text("provider").notNull().default("jitsi"), // jitsi | daily_co | whereby
    maxParticipants: integer("max_participants").notNull().default(4), // free: 4, paid: 10
    allowedParticipantTypes: text("allowed_participant_types", { mode: "json" })
      .$type<string[]>()
      .default(sql`'["patient","doctor"]'`),
    // participant types: patient | doctor | specialist | coordinator | family_member | interpreter
    recordingEnabled: integer("recording_enabled", { mode: "boolean" }).notNull().default(false),
    waitingRoomEnabled: integer("waiting_room_enabled", { mode: "boolean" }).notNull().default(true),
    autoAdmit: integer("auto_admit", { mode: "boolean" }).notNull().default(false),
    sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(45),
    aiSummaryEnabled: integer("ai_summary_enabled", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    updatedBy: text("updated_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("consultation_room_configs_entity_idx").on(table.entityType, table.entityId),
  ],
);

// P3 TABLE: consultation_sessions — one session per appointment (stub in P1/P2)
export const consultationSessions = sqliteTable(
  "consultation_sessions",
  {
    id: id(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id),
    provider: text("provider").notNull().default("jitsi"),
    roomUrl: text("room_url"),
    roomId: text("room_id"),
    status: text("status").notNull().default("scheduled"), // scheduled | active | ended
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    recordingUrl: text("recording_url"), // R2 URL, consent-gated, 2-year retention
    aiSummary: text("ai_summary"),       // Gemini Flash summary, opt-in only
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("consultation_sessions_appointment_idx").on(table.appointmentId),
  ],
);

// P3 TABLE: consultation_participants — each person in a session (stub in P1/P2)
export const consultationParticipants = sqliteTable(
  "consultation_participants",
  {
    id: id(),
    sessionId: text("session_id").notNull().references(() => consultationSessions.id),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(), // patient | user
    role: text("role").notNull(),
    // roles: patient | doctor | specialist | coordinator | family_member | interpreter
    invitedAt: integer("invited_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
    leftAt: integer("left_at", { mode: "timestamp_ms" }),
    admitted: integer("admitted", { mode: "boolean" }).notNull().default(false),
    recordingConsented: integer("recording_consented", { mode: "boolean" }),
  },
  (table) => [
    index("consultation_participants_session_idx").on(table.sessionId),
    uniqueIndex("consultation_participants_session_actor_idx").on(
      table.sessionId,
      table.actorId,
      table.actorType,
    ),
  ],
);

// P4 TABLE: provider_staff — sub-users (receptionist / billing) per hospital
export const providerStaff = sqliteTable(
  "provider_staff",
  {
    id: id(),
    providerId: text("provider_id").notNull().references(() => hospitals.id),
    userId: text("user_id").notNull().references(() => users.id),
    subRole: text("sub_role").notNull().default("receptionist"), // receptionist | billing
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    invitedBy: text("invited_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("provider_staff_provider_idx").on(table.providerId),
    index("provider_staff_user_idx").on(table.userId),
    uniqueIndex("provider_staff_provider_user_idx").on(table.providerId, table.userId),
  ],
);

// P4 TABLE: opd_tokens — walk-in OPD queue tokens per provider/doctor
export const opdTokens = sqliteTable(
  "opd_tokens",
  {
    id: id(),
    providerId: text("provider_id").notNull().references(() => hospitals.id),
    doctorId: text("doctor_id").references(() => doctors.id),
    tokenNumber: integer("token_number").notNull(),
    patientName: text("patient_name"),
    patientPhone: text("patient_phone"), // masked/plain for walk-ins (no PII)
    status: text("status").notNull().default("waiting"), // waiting | called | serving | done | skipped
    calledAt: integer("called_at", { mode: "timestamp_ms" }),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    date: text("date").notNull(), // YYYY-MM-DD — partition key for daily queue
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("opd_tokens_provider_date_idx").on(table.providerId, table.date),
    index("opd_tokens_doctor_date_idx").on(table.doctorId, table.date),
  ],
);

// ── P5 TABLES ─────────────────────────────────────────────────────────────────

// P5 TABLE: health_documents — Patient uploaded docs (PDF/image) with AI extraction status
export const healthDocuments = sqliteTable(
  "health_documents",
  {
    id: id(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    blobUrl: text("blob_url").notNull(),                        // Vercel Blob URL
    fileType: text("file_type").notNull(),                      // pdf | jpg | png | webp
    docType: text("doc_type"),                                  // lab_report | prescription | discharge | imaging | other
    sourceName: text("source_name"),                            // hospital/lab name (AI-extracted or patient-entered)
    docDate: integer("doc_date", { mode: "timestamp_ms" }),     // date of document (NOT upload date)
    title: text("title"),                                       // patient-entered or AI-inferred
    aiStatus: text("ai_status").notNull().default("pending"),   // pending | processing | done | failed
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    consentId: text("consent_id").references(() => consentRecords.id),
  },
  (table) => [
    index("health_documents_patient_idx").on(table.patientId),
    index("health_documents_patient_status_idx").on(table.patientId, table.aiStatus),
  ],
);

// P5 TABLE: health_memory_events — AES-GCM encrypted structured health events from all sources
export const healthMemoryEvents = sqliteTable(
  "health_memory_events",
  {
    id: id(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    source: text("source").notNull(),         // emr_visit | prescription | lab_report | device | document | self_report | abha
    sourceRefId: text("source_ref_id"),       // FK to originating row (documentId, visitId, etc.)
    eventType: text("event_type").notNull(),  // vital | lab_result | diagnosis | medication | procedure | device_reading
    eventDate: integer("event_date", { mode: "timestamp_ms" }).notNull(), // when health event occurred
    dataEncrypted: text("data_encrypted").notNull(), // AES-256-GCM ciphertext — NEVER log this field
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("hme_patient_date_idx").on(table.patientId, table.eventDate),
    index("hme_patient_type_idx").on(table.patientId, table.eventType),
    index("hme_source_ref_idx").on(table.sourceRefId),
  ],
);

// P5 TABLE: ai_conversations — Multi-turn Health Coach sessions (AES-GCM encrypted)
export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: id(),
    patientId: text("patient_id").notNull().references(() => patients.id),
    title: text("title"),                                         // AI-generated or patient-named
    messagesEncrypted: text("messages_encrypted").notNull(),      // AES-256-GCM JSON: [{ role, content, timestamp }]
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("ai_conv_patient_idx").on(table.patientId),
    index("ai_conv_patient_last_idx").on(table.patientId, table.lastMessageAt),
  ],
);

// P5 TABLE: document_shares — Time-limited, revocable patient→provider document shares
export const documentShares = sqliteTable(
  "document_shares",
  {
    id: id(),
    documentId: text("document_id").notNull().references(() => healthDocuments.id),
    patientId: text("patient_id").notNull().references(() => patients.id),
    providerId: text("provider_id").notNull(),    // hospitalId or doctorId
    providerType: text("provider_type").notNull(), // hospital | doctor
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(), // max 30 days from creation
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("doc_shares_document_idx").on(table.documentId),
    index("doc_shares_patient_idx").on(table.patientId),
    index("doc_shares_provider_idx").on(table.providerId),
  ],
);

// P5 TABLE: document_access_log — DPDP audit trail: every provider access to shared documents
export const documentAccessLog = sqliteTable(
  "document_access_log",
  {
    id: id(),
    shareId: text("share_id").notNull().references(() => documentShares.id),
    accessedBy: text("accessed_by").notNull().references(() => users.id),
    accessedAt: integer("accessed_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    ipHash: text("ip_hash"),  // SHA-256 of IP for audit (not stored plain)
  },
  (table) => [
    index("doc_access_share_idx").on(table.shareId),
    index("doc_access_user_idx").on(table.accessedBy),
  ],
);

// ── ACCESS MANAGEMENT (0009) ──────────────────────────────────────────────────

/** One user → many hospitals/clinics with per-entity permissions. */
export const userEntityPermissions = sqliteTable(
  "user_entity_permissions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    entityType: text("entity_type").notNull(), // 'hospital' | 'doctor'
    entityId: text("entity_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    permissions: text("permissions").notNull().default("edit"), // 'edit' | 'view'
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("uep_user_entity_unique_idx").on(table.userId, table.entityType, table.entityId),
    index("uep_user_idx").on(table.userId),
    index("uep_entity_idx").on(table.entityType, table.entityId),
  ],
);

/** KYC / entity-access request workflow: provider submits → admin_manager approves → admin_editor links. */
export const entityAccessRequests = sqliteTable(
  "entity_access_requests",
  {
    id: id(),
    requesterId: text("requester_id").notNull().references(() => users.id),
    entityType: text("entity_type").notNull(), // 'hospital' | 'doctor' | 'clinic'
    entityId: text("entity_id"),              // null = requesting to create new entity
    businessName: text("business_name"),
    licenseNumber: text("license_number"),
    licenseType: text("license_type"),        // 'clinic' | 'hospital' | 'medical_practice'
    kycDocuments: text("kyc_documents", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    status: text("status").notNull().default("pending"),
    // pending | under_review | approved | rejected | info_requested
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    reviewNotes: text("review_notes"),
    approvedEntityId: text("approved_entity_id"), // linked entity after approval
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("ear_requester_idx").on(table.requesterId),
    index("ear_status_idx").on(table.status),
  ],
);

// P5 TABLE: previsit_briefs — AI-generated patient summaries sent to doctors before appointments
export const previsitBriefs = sqliteTable(
  "previsit_briefs",
  {
    id: id(),
    appointmentId: text("appointment_id").unique().references(() => appointments.id),
    patientId: text("patient_id").notNull().references(() => patients.id),
    doctorId: text("doctor_id").references(() => doctors.id),
    briefEncrypted: text("brief_encrypted").notNull(),  // AES-256-GCM JSON structured summary
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
    viewedAt: integer("viewed_at", { mode: "timestamp_ms" }),
    consentId: text("consent_id").references(() => consentRecords.id),
  },
  (table) => [
    index("previsit_patient_idx").on(table.patientId),
    index("previsit_doctor_idx").on(table.doctorId),
  ],
);
