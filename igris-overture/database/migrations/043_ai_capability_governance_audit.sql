-- Migration 043: AI capability policy, permission envelope, and tool receipt audit.
--
-- Mirrors the robotics governance audit shape for AI tool execution. Overture
-- persists signed permission envelopes, per-capability decisions, short-lived
-- credential references, lifecycle mutations, and Runtime tool receipts.

CREATE TABLE IF NOT EXISTS ai_capability_policy_settings (
    tenant_id TEXT NOT NULL,
    policy_version TEXT NOT NULL DEFAULT 'capabilities-policy.v1',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','revoked')),
    active BOOLEAN NOT NULL DEFAULT false,
    policy JSONB NOT NULL DEFAULT '{}',
    created_by TEXT,
    updated_by TEXT,
    revoked_by TEXT,
    activated_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, policy_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_capability_policy_active
    ON ai_capability_policy_settings (tenant_id)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_ai_capability_policy_status
    ON ai_capability_policy_settings (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_capability_policy_lifecycle_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('draft','update','activate','expire','revoke')),
    actor_id TEXT NOT NULL,
    actor_email TEXT,
    signer_identity TEXT NOT NULL,
    signer_key_version TEXT,
    command_nonce TEXT,
    command_hash TEXT,
    command_signature TEXT,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    policy_snapshot JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_capability_policy_lifecycle_policy
    ON ai_capability_policy_lifecycle_audit (tenant_id, policy_version, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_capability_policy_lifecycle_actor
    ON ai_capability_policy_lifecycle_audit (tenant_id, actor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS ai_task_permission_audit (
    envelope_id TEXT PRIMARY KEY,
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    runtime_id TEXT,
    agent_id TEXT,
    principal_id TEXT,
    acting_on_behalf_of TEXT,
    required_capabilities JSONB NOT NULL,
    credential_refs JSONB NOT NULL DEFAULT '[]',
    permission_envelope JSONB NOT NULL,
    envelope_hash TEXT NOT NULL,
    envelope_signature TEXT NOT NULL,
    signer_key_version TEXT,
    issued_at_unix_ms BIGINT NOT NULL,
    expires_at_unix_ms BIGINT NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, envelope_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_task_permission_audit_task
    ON ai_task_permission_audit (tenant_id, task_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_task_permission_audit_agent
    ON ai_task_permission_audit (tenant_id, agent_id, persisted_at DESC);

CREATE TABLE IF NOT EXISTS ai_capability_decision_audit (
    envelope_id TEXT NOT NULL REFERENCES ai_task_permission_audit(envelope_id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    runtime_id TEXT,
    capability TEXT NOT NULL,
    permit BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    credential_ref_ids JSONB NOT NULL DEFAULT '[]',
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (envelope_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_ai_capability_decision_audit_capability
    ON ai_capability_decision_audit (tenant_id, capability, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_capability_decision_audit_policy
    ON ai_capability_decision_audit (tenant_id, policy_version, persisted_at DESC);

CREATE TABLE IF NOT EXISTS ai_credential_ref_audit (
    reference_id TEXT PRIMARY KEY,
    envelope_id TEXT NOT NULL REFERENCES ai_task_permission_audit(envelope_id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    tool TEXT,
    capability TEXT,
    scope TEXT,
    expires_at_unix_ms BIGINT NOT NULL,
    revocable BOOLEAN NOT NULL,
    revoked_at TIMESTAMPTZ,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credential_ref_audit_task
    ON ai_credential_ref_audit (tenant_id, task_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_credential_ref_audit_capability
    ON ai_credential_ref_audit (tenant_id, capability, persisted_at DESC);

CREATE TABLE IF NOT EXISTS ai_tool_receipt_audit (
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    runtime_id TEXT,
    execution_id TEXT NOT NULL,
    envelope_id TEXT,
    capability TEXT,
    tool_name TEXT NOT NULL,
    tool_action_hash TEXT,
    routing_decision TEXT NOT NULL,
    request_hash TEXT,
    response_hash TEXT,
    receipt_hash TEXT,
    receipt_signature TEXT,
    envelope_signature TEXT,
    violation_occurred BOOLEAN NOT NULL DEFAULT false,
    violation TEXT,
    execution_envelope JSONB NOT NULL,
    execution_receipt JSONB,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_receipt_audit_task
    ON ai_tool_receipt_audit (tenant_id, task_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tool_receipt_audit_tool
    ON ai_tool_receipt_audit (tenant_id, tool_name, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tool_receipt_audit_envelope
    ON ai_tool_receipt_audit (tenant_id, envelope_id, persisted_at DESC);
