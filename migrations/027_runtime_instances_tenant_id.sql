-- Migration 027: Add tenant_id column to runtime_instances
-- Migration 008 (igris-overture/database/migrations/008_runtime_registry.sql) created
-- indexes on (tenant_id, machine_id) but never added the tenant_id column itself.
-- This caused INSERT failures on /api/v1/runtime/register ("column does not exist").

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Recreate the indexes now that the column actually exists
-- (IF NOT EXISTS means these are safe to run even if they were somehow created)
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_instances_tenant_machine
    ON runtime_instances (tenant_id, machine_id)
    WHERE machine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runtime_instances_tenant_status
    ON runtime_instances (tenant_id, status);
