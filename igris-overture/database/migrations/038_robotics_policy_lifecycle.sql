-- Migration 038: Add explicit lifecycle state to robotics policy settings.
--
-- Migration 036 creates these columns for fresh databases. This additive
-- migration keeps existing databases correct if 036 already ran before the
-- lifecycle API was introduced.

ALTER TABLE robotics_policy_settings
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by TEXT,
    ADD COLUMN IF NOT EXISTS updated_by TEXT,
    ADD COLUMN IF NOT EXISTS revoked_by TEXT;

ALTER TABLE robotics_policy_settings
    ALTER COLUMN active SET DEFAULT false;

UPDATE robotics_policy_settings
SET status = CASE WHEN active THEN 'active' ELSE status END,
    activated_at = CASE WHEN active AND activated_at IS NULL THEN updated_at ELSE activated_at END
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_robotics_policy_settings_status
    ON robotics_policy_settings (tenant_id, status, updated_at DESC);
