-- Migration 072: Immutable operator reconciliation events (Clock 3D).
--
-- A typed Runtime failure may establish that a consequential contract-bound
-- HTTP effect is unknown. This table preserves that initial managed
-- observation and every later operator assertion without changing task
-- history, Runtime receipts, or Action Protocol Evidence.
--
-- NOTE: this migration is committed for the normal manual migration runbook.
-- It is NOT applied to any shared, staging, or production database here.
-- Application startup must never auto-apply it. Migration 071 remains a
-- separate manual deployment requirement and must be applied first.

CREATE TABLE IF NOT EXISTS contract_bound_action_reconciliation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID NOT NULL,
    binding_id UUID NOT NULL,
    contract_hash TEXT NOT NULL,
    target_action_id UUID NOT NULL,
    target_version_hash TEXT NOT NULL,
    business_idempotency_digest TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('unresolved_effect_observed', 'operator_resolution')
    ),
    observed_effect_state TEXT NOT NULL CHECK (
        observed_effect_state = 'unknown_effect_state'
    ),
    resolution TEXT CHECK (
        resolution IS NULL OR resolution IN (
            'confirmed_succeeded', 'confirmed_failed', 'remains_unknown'
        )
    ),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('runtime', 'operator')),
    actor_id TEXT NOT NULL CHECK (char_length(actor_id) BETWEEN 1 AND 256),
    actor_email TEXT CHECK (actor_email IS NULL OR char_length(actor_email) <= 320),
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
    external_reference_type TEXT CHECK (
        external_reference_type IS NULL OR external_reference_type IN (
            'provider_reference', 'transaction_id', 'deployment_id', 'ticket_id',
            'runtime_response_digest'
        )
    ),
    external_reference_value TEXT CHECK (
        external_reference_value IS NULL OR
        char_length(external_reference_value) BETWEEN 1 AND 256
    ),
    target_host TEXT CHECK (target_host IS NULL OR char_length(target_host) <= 253),
    source_status_code INTEGER CHECK (
        source_status_code IS NULL OR source_status_code BETWEEN 100 AND 599
    ),
    operator_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_bound_action_reconciliation_events_run_tenant_fk
        FOREIGN KEY (task_id, tenant_id)
        REFERENCES contract_bound_action_runs (task_id, tenant_id),
    CONSTRAINT contract_bound_action_reconciliation_events_binding_tenant_fk
        FOREIGN KEY (
            binding_id, tenant_id, contract_hash, target_action_id, target_version_hash
        ) REFERENCES action_contract_execution_bindings (
            id, tenant_id, contract_hash, target_action_id, target_version_hash
        ),
    CONSTRAINT contract_bound_action_reconciliation_events_hash_format
        CHECK (
            contract_hash ~ '^[0-9a-f]{64}$'
            AND target_version_hash ~ '^[0-9a-f]{64}$'
            AND business_idempotency_digest ~ '^[0-9a-f]{64}$'
        ),
    CONSTRAINT contract_bound_action_reconciliation_events_external_reference_pair
        CHECK (
            (external_reference_type IS NULL AND external_reference_value IS NULL)
            OR
            (external_reference_type IS NOT NULL AND external_reference_value IS NOT NULL)
        ),
    CONSTRAINT contract_bound_action_reconciliation_events_shape
        CHECK (
            (
                event_type = 'unresolved_effect_observed'
                AND resolution IS NULL
                AND actor_type = 'runtime'
                AND operator_request_id IS NULL
            )
            OR
            (
                event_type = 'operator_resolution'
                AND resolution IS NOT NULL
                AND actor_type = 'operator'
                AND operator_request_id IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_reconciliation_observation_idx
    ON contract_bound_action_reconciliation_events (tenant_id, task_id)
    WHERE event_type = 'unresolved_effect_observed';

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_reconciliation_request_idx
    ON contract_bound_action_reconciliation_events (
        tenant_id, task_id, operator_request_id
    )
    WHERE operator_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_reconciliation_terminal_idx
    ON contract_bound_action_reconciliation_events (tenant_id, task_id)
    WHERE resolution IN ('confirmed_succeeded', 'confirmed_failed');

CREATE INDEX IF NOT EXISTS contract_bound_action_reconciliation_history_idx
    ON contract_bound_action_reconciliation_events (
        tenant_id, task_id, created_at, id
    );

CREATE OR REPLACE FUNCTION enforce_reconciliation_event_append()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.tenant_id || ':' || NEW.task_id::text, 0)
    );
    -- Override any caller-supplied timestamp after serialization. Event time
    -- is server-owned and reflects append order, not transaction start time.
    NEW.created_at := clock_timestamp();
    IF NOT EXISTS (
        SELECT 1
        FROM contract_bound_action_runs r
        WHERE r.tenant_id = NEW.tenant_id
          AND r.task_id = NEW.task_id
          AND r.binding_id = NEW.binding_id
          AND r.contract_hash = NEW.contract_hash
          AND r.target_action_id = NEW.target_action_id
          AND r.target_version_hash = NEW.target_version_hash
          AND encode(sha256(convert_to(r.business_idempotency_key, 'UTF8')), 'hex')
              = NEW.business_idempotency_digest
    ) THEN
        RAISE EXCEPTION 'reconciliation event identity does not match durable run'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.event_type = 'unresolved_effect_observed' AND NOT EXISTS (
        SELECT 1
        FROM task_records t
        JOIN contract_bound_action_runs r
          ON r.task_id = t.task_id AND r.tenant_id = t.tenant_id
        JOIN action_contract_execution_bindings b
          ON b.id = r.binding_id AND b.tenant_id = r.tenant_id
        WHERE t.tenant_id = NEW.tenant_id
          AND t.task_id = NEW.task_id
          AND t.status = 'failed'
          AND b.idempotency_required = TRUE
          AND t.failure_details->>'effect_state' = 'unknown_effect_state'
          AND t.failure_details->>'reconciliation_required' = 'true'
          AND t.failure_details->>'target_error_code' = 'idempotency_unresolved'
          AND t.failure_details->>'target_response_digest'
              ~ '^[0-9a-f]{64}$'
          AND t.failure_details->>'status_code' ~ '^[45][0-9]{2}$'
          AND NEW.actor_id = COALESCE(NULLIF(t.runtime_id, ''), 'runtime:unknown')
          AND NEW.reason =
              'Runtime reported a typed unknown consequential effect; automatic replay is refused'
          AND NEW.external_reference_type = 'runtime_response_digest'
          AND NEW.external_reference_value =
              t.failure_details->>'target_response_digest'
          AND NEW.target_host = t.failure_details->>'target_host'
          AND NEW.source_status_code =
              (t.failure_details->>'status_code')::INTEGER
    ) THEN
        RAISE EXCEPTION 'typed reconciliation eligibility is not established'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.event_type = 'operator_resolution' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM contract_bound_action_reconciliation_events
            WHERE tenant_id = NEW.tenant_id
              AND task_id = NEW.task_id
              AND event_type = 'unresolved_effect_observed'
        ) THEN
            RAISE EXCEPTION 'reconciliation is not required for this run'
                USING ERRCODE = '23514';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM contract_bound_action_reconciliation_events
            WHERE tenant_id = NEW.tenant_id
              AND task_id = NEW.task_id
              AND resolution IN ('confirmed_succeeded', 'confirmed_failed')
        ) THEN
            RAISE EXCEPTION 'reconciliation already has a terminal resolution'
                USING ERRCODE = '23505';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_bound_action_reconciliation_append_guard
    ON contract_bound_action_reconciliation_events;
CREATE TRIGGER contract_bound_action_reconciliation_append_guard
    BEFORE INSERT ON contract_bound_action_reconciliation_events
    FOR EACH ROW EXECUTE FUNCTION enforce_reconciliation_event_append();

DROP TRIGGER IF EXISTS contract_bound_action_reconciliation_events_immutable
    ON contract_bound_action_reconciliation_events;
CREATE TRIGGER contract_bound_action_reconciliation_events_immutable
    BEFORE UPDATE OR DELETE ON contract_bound_action_reconciliation_events
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();
