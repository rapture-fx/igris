-- Migration 057: Tenant-scoped task idempotency.
--
-- Migration 031 created a GLOBAL unique index on task_records (idempotency_key),
-- which let one tenant's idempotency key collide with another tenant's. In a
-- multi-tenant product idempotency must deduplicate only within a single tenant,
-- and two tenants must be free to use the same key independently.
--
-- This forward migration replaces the global unique index with a tenant-scoped
-- composite unique index on (tenant_id, idempotency_key). idempotency_key is
-- declared NOT NULL in migration 031 (the coordinator defaults it to the task
-- UUID when a caller omits it), so a plain composite unique index is correct and
-- a partial "WHERE idempotency_key IS NOT NULL" clause is unnecessary.
--
-- Safety: the old global unique index guaranteed idempotency_key was unique
-- across the whole table, so no duplicate (tenant_id, idempotency_key) pair can
-- exist today. The new index can therefore be created without a data backfill or
-- deduplication step.

-- Drop the legacy global unique index if it exists.
DROP INDEX IF EXISTS task_records_idempotency_key_idx;

-- Tenant-scoped uniqueness: dedup within a tenant, isolation across tenants.
CREATE UNIQUE INDEX IF NOT EXISTS task_records_tenant_id_idempotency_key_idx
    ON task_records (tenant_id, idempotency_key);
