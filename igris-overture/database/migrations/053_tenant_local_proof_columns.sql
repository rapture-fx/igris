-- Migration 053: tenant columns required by the local Run/Recover/Prove proof.
--
-- Fresh local proof databases may have created tenants through older migration
-- shapes before migration 016's full baseline was present. Keep this repair
-- additive so existing developer databases are not reset.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tenant_email TEXT,
    ADD COLUMN IF NOT EXISTS capabilities_policy JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS runtime_bounds JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
