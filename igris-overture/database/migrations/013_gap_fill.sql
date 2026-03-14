-- Migration 013: Gap-fill columns for alert state, settings, and runtime policy
-- Adds columns needed by Phase 1-6 endpoint implementations:
--   • execution_lineage: alert acknowledge/resolve state
--   • tenants: settings preferences and runtime policy JSONB

-- ── Alert state on execution_lineage ────────────────────────────────────────
-- Violations in execution_lineage now also serve as "alerts". These two columns
-- record when a console user has acknowledged or resolved a violation alert.
ALTER TABLE execution_lineage
    ADD COLUMN IF NOT EXISTS alert_acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS alert_resolved_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_execution_lineage_alerts
    ON execution_lineage (tenant_id, violation_occurred, timestamp_utc DESC)
    WHERE violation_occurred = TRUE;

-- ── Settings preferences on tenants ─────────────────────────────────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS environment               TEXT    DEFAULT 'production',
    ADD COLUMN IF NOT EXISTS timezone                  TEXT    DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS log_level                 TEXT    DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS execution_signing         BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS audit_logging             BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS receipt_retention_days    INTEGER DEFAULT 90,
    ADD COLUMN IF NOT EXISTS telemetry_enabled         BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS default_execution_timeout INTEGER DEFAULT 30000;

-- ── Runtime policy JSONB on tenants ─────────────────────────────────────────
-- runtime_bounds stores execution-level resource limits (max_execution_ms, etc.)
-- capabilities_policy stores capability allow/deny rules (allow_http, etc.)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS runtime_bounds      JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS capabilities_policy JSONB DEFAULT '{}';
