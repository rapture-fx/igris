-- Migration 008: Runtime instance registry extension
-- Extends runtime_instances with fields needed for tenant-scoped runtime registration:
-- machine fingerprint, cached hostname, IP, heartbeat tracking, and lifecycle status.

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS machine_id        TEXT,
    ADD COLUMN IF NOT EXISTS hostname_cached   TEXT,
    ADD COLUMN IF NOT EXISTS ip_address        TEXT,
    ADD COLUMN IF NOT EXISTS last_heartbeat    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active';

-- Unique constraint: one registration per (tenant, machine) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_instances_tenant_machine
    ON runtime_instances (tenant_id, machine_id)
    WHERE machine_id IS NOT NULL;

-- Fast lookup for heartbeat updates by machine_id
CREATE INDEX IF NOT EXISTS idx_runtime_instances_machine_id
    ON runtime_instances (machine_id)
    WHERE machine_id IS NOT NULL;

-- Fast lookup for active runtimes by tenant
CREATE INDEX IF NOT EXISTS idx_runtime_instances_tenant_status
    ON runtime_instances (tenant_id, status);

COMMENT ON COLUMN runtime_instances.machine_id IS
    'SHA-256 fingerprint of MAC address + hostname (dev_{hex[..16]}) — uniquely identifies a physical/virtual host.';

COMMENT ON COLUMN runtime_instances.hostname_cached IS
    'Hostname at registration time, cached for display in the fleet dashboard.';

COMMENT ON COLUMN runtime_instances.ip_address IS
    'IP address of the runtime at last heartbeat, stored for diagnostics.';

COMMENT ON COLUMN runtime_instances.last_heartbeat IS
    'Timestamp of the most recent heartbeat. Runtimes that stop heartbeating are marked stale.';

COMMENT ON COLUMN runtime_instances.status IS
    'Lifecycle status: active | stale | deregistered';
