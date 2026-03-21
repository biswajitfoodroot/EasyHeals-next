-- Add phone number field to users table for portal/admin self-service profiles
ALTER TABLE users ADD COLUMN phone text;
