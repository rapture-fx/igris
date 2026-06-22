-- Migration 066: Trust recommendation lifecycle state.
--
-- Trust Recommendations are generated deterministically and read-only from
-- execution truth (they are never persisted). This table stores ONLY the
-- operator's lifecycle decision for a finding — acknowledge / snooze / resolve —
-- keyed by the stable, generated recommendation_id. It overlays generation; it
-- never stores the finding payload, prompts, model output, secrets, or raw
-- bodies. One lifecycle row per (tenant, recommendation_id).
--
-- NOTE: this migration is intentionally NOT applied as part of this change. It
-- is committed for a later consolidated migration/attestation pass. The lifecycle
-- overlay degrades to "all active" when this table is absent.

CREATE TABLE IF NOT EXISTS trust_recommendation_states (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    recommendation_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','acknowledged','snoozed','resolved')),
    reason TEXT NOT NULL DEFAULT '',
    snoozed_until TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_rec_states_tenant
    ON trust_recommendation_states (tenant_id, status);
