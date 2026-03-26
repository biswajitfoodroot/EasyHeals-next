-- Add request_type to entity_access_requests
-- Distinguishes: 'claim' (claiming an existing listing) | 'deletion_request' (report duplicate for removal)
ALTER TABLE entity_access_requests ADD COLUMN request_type TEXT NOT NULL DEFAULT 'claim';
