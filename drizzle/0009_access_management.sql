-- 0009: Robust Access Management
-- Adds: user_entity_permissions (multi-clinic), entity_access_requests (KYC workflow),
--       kycStatus on users, admin_manager + admin_editor roles

-- New roles for KYC approval workflow
INSERT OR IGNORE INTO roles (id, code, label) VALUES
  (lower(hex(randomblob(16))), 'admin_manager', 'Admin Manager (approves KYC)'),
  (lower(hex(randomblob(16))), 'admin_editor', 'Admin Editor (updates entity data)');

-- kycStatus on users: tracks provider KYC state
ALTER TABLE users ADD COLUMN kyc_status TEXT NOT NULL DEFAULT 'not_required';
-- values: not_required | pending | submitted | approved | rejected

-- Multi-entity permissions: one user linked to many hospitals/clinics
CREATE TABLE IF NOT EXISTS user_entity_permissions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,         -- 'hospital' | 'doctor'
  entity_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT 'edit',  -- 'edit' | 'view'
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS uep_user_idx ON user_entity_permissions(user_id);
CREATE INDEX IF NOT EXISTS uep_entity_idx ON user_entity_permissions(entity_type, entity_id);

-- KYC / access request workflow
CREATE TABLE IF NOT EXISTS entity_access_requests (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,          -- 'hospital' | 'doctor' | 'clinic'
  entity_id TEXT,                     -- NULL = requesting to create new entity
  business_name TEXT,
  license_number TEXT,
  license_type TEXT,                  -- 'clinic' | 'hospital' | 'medical_practice'
  kyc_documents TEXT NOT NULL DEFAULT '[]',  -- JSON array of doc URLs
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- values: pending | under_review | approved | rejected | info_requested
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  review_notes TEXT,
  approved_entity_id TEXT,           -- set after admin links to real entity
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS ear_requester_idx ON entity_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS ear_status_idx ON entity_access_requests(status);

-- Backfill: copy existing users.entity_id into user_entity_permissions
INSERT OR IGNORE INTO user_entity_permissions (id, user_id, entity_type, entity_id, is_primary, permissions)
SELECT
  lower(hex(randomblob(16))),
  id,
  entity_type,
  entity_id,
  1,
  'edit'
FROM users
WHERE entity_id IS NOT NULL AND entity_type IS NOT NULL;
