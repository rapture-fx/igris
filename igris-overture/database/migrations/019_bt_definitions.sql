-- Migration 019: BT definitions table for visual BT editor
CREATE TABLE IF NOT EXISTS bt_definitions (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    nodes       JSONB   NOT NULL DEFAULT '[]'::jsonb,
    edges       JSONB   NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_bt_definitions_tenant ON bt_definitions (tenant_id, updated_at DESC);

-- Add violation_details for richer policy context
ALTER TABLE execution_lineage ADD COLUMN IF NOT EXISTS violation_details JSONB;

-- Add escalation tracking
ALTER TABLE execution_lineage ADD COLUMN IF NOT EXISTS alert_escalated_at TIMESTAMPTZ;
