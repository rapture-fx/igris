-- Migration 065: Policy proposal lifecycle.
--
-- A policy proposal is a tenant-owned DRAFT of a policy rule an operator wants
-- to evaluate before it ever affects production. It is built on top of the
-- read-only policy simulation surface: an operator saves a simulated rule as a
-- draft, re-simulates it over fresh execution truth, marks it ready for review,
-- and (optionally) approves it. Approval is a governance state only — this
-- lifecycle NEVER mutates active policy, replays runs, or dispatches tasks.
--
-- Only safe proposal metadata, allow-listed match criteria, and a safe
-- simulation summary are persisted. Raw request/response bodies, prompts,
-- chain-of-thought, secrets, and ciphertext are never stored here.
--
-- NOTE: this migration is intentionally NOT applied as part of this change.
-- It is committed for a later consolidated migration/attestation pass.

CREATE TABLE IF NOT EXISTS policy_proposals (
    proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','review_ready','approved','archived')),
    policy_mode TEXT NOT NULL
        CHECK (policy_mode IN ('require_approval','block')),
    match_criteria_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    latest_simulation_json JSONB,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    CHECK (jsonb_typeof(match_criteria_json) = 'object'),
    CHECK (latest_simulation_json IS NULL OR jsonb_typeof(latest_simulation_json) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_policy_proposals_tenant_active
    ON policy_proposals (tenant_id, updated_at DESC)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_policy_proposals_tenant_status
    ON policy_proposals (tenant_id, status, updated_at DESC)
    WHERE archived_at IS NULL;

-- Append-only governance audit trail for a proposal. Each event carries only a
-- short, safe operator-facing summary — never raw bodies, prompts, or secrets.
CREATE TABLE IF NOT EXISTS policy_proposal_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    proposal_id UUID NOT NULL REFERENCES policy_proposals(proposal_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('created','updated','simulated','status_changed','approved','archived')),
    safe_summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_proposal_events_proposal
    ON policy_proposal_events (tenant_id, proposal_id, created_at DESC);
