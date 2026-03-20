-- Migration 025: Trial system columns on tenants table
-- From igris-overture/database/migrations/011_trial_system.sql
-- These columns are required for /v1/trial/start and /v1/trial/status.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS trial_active            BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS trial_tier              TEXT,
    ADD COLUMN IF NOT EXISTS trial_started_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_expired_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_converted_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_reminder_sent_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscription_status     TEXT        NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_trial_expiry
    ON tenants (trial_ends_at)
    WHERE trial_active = true;
