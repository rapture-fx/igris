-- Migration 070: Contract-bound durable Action execution.
--
-- This is the narrow bridge between an immutable SDK ActionContract version
-- and an existing executable Action definition. Synchronizing a contract
-- continues to grant no execution permission. An operator must create an
-- explicit tenant-scoped binding before a contract-bound run is possible.
--
-- Bindings are immutable snapshots. A mutable action_definitions row may
-- evolve later, but a run governed by this binding always uses the target and
-- policy snapshot captured here. A contract version can have at most one
-- execution binding; changing the executable target requires a new immutable
-- contract version and a new binding.
--
-- NOTE: this migration is committed for the normal manual migration runbook.
-- It is NOT applied to any shared, staging, or production database here.
-- Disposable proof/CI databases may apply it explicitly via the heavy proof
-- gate runbook; application startup must never auto-apply it.

-- Composite identities let foreign keys enforce tenant ownership in the
-- database, not only in application queries.
CREATE UNIQUE INDEX IF NOT EXISTS action_contract_versions_binding_fk_idx
    ON action_contract_versions (id, tenant_id, action_name, contract_hash);

CREATE UNIQUE INDEX IF NOT EXISTS action_definitions_tenant_id_fk_idx
    ON action_definitions (id, tenant_id);

CREATE TABLE IF NOT EXISTS action_contract_execution_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    contract_version_id UUID NOT NULL REFERENCES action_contract_versions(id),
    contract_hash TEXT NOT NULL,
    target_action_id UUID NOT NULL REFERENCES action_definitions(id),
    target_version_hash TEXT NOT NULL,
    target_snapshot JSONB NOT NULL,
    input_mapping JSONB NOT NULL,
    endpoint_config_ref TEXT NOT NULL,
    timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1 AND 300000),
    replay_class TEXT NOT NULL CHECK (replay_class IN ('retryable', 'non_retryable', 'read_only')),
    idempotency_required BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT action_contract_execution_bindings_contract_tenant_fk
        FOREIGN KEY (contract_version_id, tenant_id, action_name, contract_hash)
        REFERENCES action_contract_versions (id, tenant_id, action_name, contract_hash),
    CONSTRAINT action_contract_execution_bindings_target_tenant_fk
        FOREIGN KEY (target_action_id, tenant_id)
        REFERENCES action_definitions (id, tenant_id),
    CONSTRAINT action_contract_execution_bindings_hash_format
        CHECK (contract_hash ~ '^[0-9a-f]{64}$' AND target_version_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS action_contract_execution_bindings_contract_idx
    ON action_contract_execution_bindings (tenant_id, action_name, contract_hash);

CREATE INDEX IF NOT EXISTS action_contract_execution_bindings_target_idx
    ON action_contract_execution_bindings (tenant_id, target_action_id);

CREATE UNIQUE INDEX IF NOT EXISTS action_contract_execution_bindings_run_fk_idx
    ON action_contract_execution_bindings (
        id, tenant_id, contract_hash, target_action_id, target_version_hash
    );

-- A separate run-link table avoids rewriting historical task rows while still
-- making the selected immutable identities first-class durable data. The row
-- is inserted in the same transaction as task_records and is never updated.
CREATE TABLE IF NOT EXISTS contract_bound_action_runs (
    -- No ON DELETE CASCADE: immutability triggers reject child deletes, so a
    -- cascading task delete would fail closed. Bound run rows outlive any
    -- administrative attempt to erase the durable Action identity.
    task_id UUID PRIMARY KEY REFERENCES task_records(task_id),
    tenant_id TEXT NOT NULL,
    binding_id UUID NOT NULL REFERENCES action_contract_execution_bindings(id),
    contract_hash TEXT NOT NULL,
    target_action_id UUID NOT NULL REFERENCES action_definitions(id),
    target_version_hash TEXT NOT NULL,
    business_idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_bound_action_runs_binding_tenant_fk
        FOREIGN KEY (
            binding_id, tenant_id, contract_hash, target_action_id, target_version_hash
        ) REFERENCES action_contract_execution_bindings (
            id, tenant_id, contract_hash, target_action_id, target_version_hash
        ),
    CONSTRAINT contract_bound_action_runs_hash_format
        CHECK (
            contract_hash ~ '^[0-9a-f]{64}$'
            AND target_version_hash ~ '^[0-9a-f]{64}$'
            AND request_fingerprint ~ '^[0-9a-f]{64}$'
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_runs_tenant_idempotency_idx
    ON contract_bound_action_runs (tenant_id, business_idempotency_key);

CREATE INDEX IF NOT EXISTS contract_bound_action_runs_binding_idx
    ON contract_bound_action_runs (tenant_id, binding_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_runs_task_tenant_idx
    ON contract_bound_action_runs (task_id, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS sdk_evidence_batches_tenant_fk_idx
    ON sdk_evidence_batches (id, tenant_id);

-- Evidence is produced after the run row is created, so linkage is a separate
-- append-only claim rather than a mutation of the immutable run identity.
CREATE TABLE IF NOT EXISTS contract_bound_action_evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES contract_bound_action_runs(task_id),
    tenant_id TEXT NOT NULL,
    evidence_chain_digest TEXT NOT NULL,
    evidence_batch_id UUID REFERENCES sdk_evidence_batches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_bound_action_evidence_links_run_tenant_fk
        FOREIGN KEY (task_id, tenant_id)
        REFERENCES contract_bound_action_runs (task_id, tenant_id),
    CONSTRAINT contract_bound_action_evidence_links_batch_tenant_fk
        FOREIGN KEY (evidence_batch_id, tenant_id)
        REFERENCES sdk_evidence_batches (id, tenant_id),
    CONSTRAINT contract_bound_action_evidence_links_digest_format
        CHECK (evidence_chain_digest ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_evidence_links_digest_idx
    ON contract_bound_action_evidence_links (tenant_id, task_id, evidence_chain_digest);

-- Reuse the database-enforced immutability function introduced by migration
-- 069. Ordering is intentional: 070 must only be applied after 069.
DROP TRIGGER IF EXISTS action_contract_execution_bindings_immutable
    ON action_contract_execution_bindings;
CREATE TRIGGER action_contract_execution_bindings_immutable
    BEFORE UPDATE OR DELETE ON action_contract_execution_bindings
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();

DROP TRIGGER IF EXISTS contract_bound_action_runs_immutable
    ON contract_bound_action_runs;
CREATE TRIGGER contract_bound_action_runs_immutable
    BEFORE UPDATE OR DELETE ON contract_bound_action_runs
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();

DROP TRIGGER IF EXISTS contract_bound_action_evidence_links_immutable
    ON contract_bound_action_evidence_links;
CREATE TRIGGER contract_bound_action_evidence_links_immutable
    BEFORE UPDATE OR DELETE ON contract_bound_action_evidence_links
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();
