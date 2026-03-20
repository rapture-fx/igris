-- Migration 024: Add API key columns to tenants table
-- These columns are required for /v1/account/api-key (generate, get, revoke).
-- api_key_hash stores the SHA-256 hash of the raw igris_ key.
-- api_key_prefix stores the first 12 chars for display in the console.
-- api_key_created_at records when the current key was generated.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS api_key_hash       TEXT,
    ADD COLUMN IF NOT EXISTS api_key_prefix     TEXT,
    ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;
