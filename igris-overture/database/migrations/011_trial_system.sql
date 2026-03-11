-- Migration 011: 7-day free trial system
-- Adds trial lifecycle columns to the tenants table.
-- Trial applies to all tiers (Seed, Horizon, Infinite).
-- On expiry without payment: tenant is downgraded to Seed tier.
-- A trial can only be started once per tenant (enforced by application logic).

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

-- Fast lookup for the daily expiry cron job
CREATE INDEX IF NOT EXISTS idx_tenants_trial_expiry
    ON tenants (trial_ends_at)
    WHERE trial_active = true;

COMMENT ON COLUMN tenants.trial_active IS
    'True while the 7-day free trial is running.';

COMMENT ON COLUMN tenants.trial_tier IS
    'The tier the tenant selected when starting their trial (seed, horizon, infinite). '
    'They get full access to that tier during the trial.';

COMMENT ON COLUMN tenants.trial_ends_at IS
    'UTC timestamp when the trial expires. '
    'The daily cron job (ExpireTrials) checks this and downgrades the tenant if no payment.';

COMMENT ON COLUMN tenants.subscription_status IS
    'Subscription lifecycle state: none | trial | active | canceled | expired.';
