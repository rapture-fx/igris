-- Migration 012: Tenant API key management fields
-- Adds prefix and created_at columns for the igris_ runtime API key.
-- api_key_hash already exists from earlier migrations.
-- These two columns allow the console to display key metadata without
-- exposing the raw key.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS api_key_prefix     TEXT,
    ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

COMMENT ON COLUMN tenants.api_key_prefix IS
    'First 12 characters of the raw API key (e.g. "igris_a1b2c3"). '
    'Shown in the console so the user can identify which key is active '
    'without exposing the full secret.';

COMMENT ON COLUMN tenants.api_key_created_at IS
    'UTC timestamp when the current API key was generated or last rotated.';
