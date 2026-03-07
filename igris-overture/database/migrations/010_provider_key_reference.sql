-- Migration 010: Link provider_registry to vault keys via key_id
-- Removes implicit key embedding in auth_header_template.
-- Providers now reference an explicit vault key record.

BEGIN;

-- Add key_id foreign key to provider_registry
ALTER TABLE provider_registry
  ADD COLUMN IF NOT EXISTS key_id UUID REFERENCES tenant_keys(id) ON DELETE SET NULL;

-- Make auth_header_template a static template (no raw keys) — nullable
-- Existing rows keep their current values; new rows use static templates from code.
-- auth_header_template column is intentionally kept to store e.g.
-- "Authorization: Bearer {key}" — never the actual key.

-- Index for efficient lookup by key_id
CREATE INDEX IF NOT EXISTS idx_provider_registry_key_id
  ON provider_registry(key_id)
  WHERE key_id IS NOT NULL;

-- Data migration: for providers that have a key embedded in auth_header_template,
-- strip out the raw key and replace with the static template placeholder.
-- Pattern: any value that doesn't contain {key} gets it sanitised.
UPDATE provider_registry
SET auth_header_template = regexp_replace(
  auth_header_template,
  '(Bearer|sk-|AIza|xai-)[A-Za-z0-9\-_\.]+',
  '{key}',
  'g'
)
WHERE auth_header_template NOT LIKE '%{key}%';

COMMIT;
