-- Persisted product-facing Actions registry.
-- Action definitions are tenant scoped and compile onto the existing durable
-- task/action execution path. Secret values are intentionally not stored here;
-- only references to a vault/configured secret may be recorded.

CREATE TABLE IF NOT EXISTS action_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    target_type TEXT NOT NULL,
    target_url TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT 'POST',
    policy_preset TEXT NOT NULL DEFAULT 'Safe automation',
    replay_class TEXT NOT NULL DEFAULT 'retryable',
    approval_required BOOLEAN NOT NULL DEFAULT false,
    irreversible BOOLEAN NOT NULL DEFAULT false,
    secret_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS action_definitions_tenant_name_active_idx
    ON action_definitions (tenant_id, name)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS action_definitions_tenant_updated_idx
    ON action_definitions (tenant_id, updated_at DESC)
    WHERE archived_at IS NULL;
