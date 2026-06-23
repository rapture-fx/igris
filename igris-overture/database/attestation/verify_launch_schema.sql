-- Igris launch schema attestation.
--
-- Read-only by design: this file performs SELECT-only checks and should be run
-- with a direct Neon Postgres connection, not a pooled connection. Do not use
-- this script to apply migrations or repair data.
--
-- Recommended:
--   PGOPTIONS='-c default_transaction_read_only=on' \
--   psql "$IGRIS_NEON_SCHEMA_ATTESTATION_DSN" \
--     -f igris-overture/database/attestation/verify_launch_schema.sql

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH checks AS (
    SELECT
        '057_task_records_tenant_scoped_idempotency_index' AS check_name,
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'task_records'
              AND indexname = 'task_records_tenant_id_idempotency_key_idx'
              AND indexdef ILIKE '%CREATE UNIQUE INDEX%'
              AND indexdef ILIKE '%tenant_id%'
              AND indexdef ILIKE '%idempotency_key%'
        ) AS passed,
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'task_records'
              AND indexname = 'task_records_tenant_id_idempotency_key_idx'
            LIMIT 1
        ), 'missing tenant-scoped unique index') AS detail

    UNION ALL
    SELECT
        '057_legacy_global_idempotency_index_removed',
        NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'task_records'
              AND indexname = 'task_records_idempotency_key_idx'
        ),
        'task_records_idempotency_key_idx must not exist'

    UNION ALL
    SELECT
        '058_execution_lineage_tenant_id_no_null_or_empty',
        (SELECT COUNT(*) FROM execution_lineage WHERE tenant_id IS NULL OR tenant_id = '') = 0,
        'tenant-null/empty rows=' ||
            (SELECT COUNT(*) FROM execution_lineage WHERE tenant_id IS NULL OR tenant_id = '')::text

    UNION ALL
    SELECT
        '058_execution_lineage_tenant_id_not_nullable',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_lineage'
              AND column_name = 'tenant_id'
              AND is_nullable = 'NO'
        ),
        COALESCE((
            SELECT 'is_nullable=' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_lineage'
              AND column_name = 'tenant_id'
        ), 'execution_lineage.tenant_id column missing')

    UNION ALL
    SELECT
        '058_execution_lineage_tenant_id_not_empty_check',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'execution_lineage'::regclass
              AND conname = 'execution_lineage_tenant_id_not_empty'
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%tenant_id%'
              AND pg_get_constraintdef(oid) ILIKE '%<>%'
        ),
        COALESCE((
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'execution_lineage'::regclass
              AND conname = 'execution_lineage_tenant_id_not_empty'
              AND contype = 'c'
            LIMIT 1
        ), 'missing execution_lineage_tenant_id_not_empty check')

    UNION ALL
    SELECT
        '058_execution_lineage_tenant_receipt_hash_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_lineage'
              AND indexname = 'idx_execution_lineage_tenant_receipt_hash'
              AND indexdef ILIKE '%tenant_id%'
              AND indexdef ILIKE '%receipt_hash%'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_lineage'
              AND indexname = 'idx_execution_lineage_tenant_receipt_hash'
            LIMIT 1
        ), 'missing tenant receipt-hash index')

    UNION ALL
    SELECT
        '060_execution_context_tenant_id_no_null_or_empty',
        (SELECT COUNT(*) FROM execution_context WHERE tenant_id IS NULL OR tenant_id = '') = 0,
        'tenant-null/empty rows=' ||
            (SELECT COUNT(*) FROM execution_context WHERE tenant_id IS NULL OR tenant_id = '')::text

    UNION ALL
    SELECT
        '060_execution_context_tenant_id_not_nullable',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_context'
              AND column_name = 'tenant_id'
              AND is_nullable = 'NO'
        ),
        COALESCE((
            SELECT 'is_nullable=' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_context'
              AND column_name = 'tenant_id'
        ), 'execution_context.tenant_id column missing')

    UNION ALL
    SELECT
        '060_execution_context_tenant_id_not_empty_check',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'execution_context'::regclass
              AND conname = 'execution_context_tenant_id_not_empty'
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%tenant_id%'
              AND pg_get_constraintdef(oid) ILIKE '%<>%'
        ),
        COALESCE((
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'execution_context'::regclass
              AND conname = 'execution_context_tenant_id_not_empty'
              AND contype = 'c'
            LIMIT 1
        ), 'missing execution_context_tenant_id_not_empty check')

    UNION ALL
    SELECT
        '060_execution_context_tenant_execution_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_context'
              AND indexname = 'execution_context_tenant_execution_idx'
              AND indexdef ILIKE '%tenant_id%'
              AND indexdef ILIKE '%execution_id%'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_context'
              AND indexname = 'execution_context_tenant_execution_idx'
            LIMIT 1
        ), 'missing tenant execution index')

    UNION ALL
    SELECT
        '063_agent_evidence_memory_table_present',
        to_regclass('public.agent_evidence_memory') IS NOT NULL,
        COALESCE(to_regclass('public.agent_evidence_memory')::text, 'missing agent_evidence_memory table')

    UNION ALL
    SELECT
        '063_agent_evidence_memory_required_columns',
        NOT EXISTS (
            SELECT 1
            FROM (VALUES
                ('memory_id'),
                ('tenant_id'),
                ('task_id'),
                ('execution_id'),
                ('registered_agent_id'),
                ('registered_agent_name'),
                ('goal_summary'),
                ('decision_summary'),
                ('evidence_summary'),
                ('outcome_summary'),
                ('redaction_status'),
                ('retention_expires_at'),
                ('created_at'),
                ('updated_at')
            ) AS required(column_name)
            WHERE NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'agent_evidence_memory'
                  AND column_name = required.column_name
            )
        ),
        COALESCE((
            SELECT string_agg(required.column_name, ',' ORDER BY required.column_name)
            FROM (VALUES
                ('memory_id'),
                ('tenant_id'),
                ('task_id'),
                ('execution_id'),
                ('registered_agent_id'),
                ('registered_agent_name'),
                ('goal_summary'),
                ('decision_summary'),
                ('evidence_summary'),
                ('outcome_summary'),
                ('redaction_status'),
                ('retention_expires_at'),
                ('created_at'),
                ('updated_at')
            ) AS required(column_name)
            WHERE NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'agent_evidence_memory'
                  AND column_name = required.column_name
            )
        ), 'all required columns present')

    UNION ALL
    SELECT
        '063_agent_evidence_memory_redaction_default',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'agent_evidence_memory'
              AND column_name = 'redaction_status'
              AND column_default ILIKE '%redacted%'
              AND is_nullable = 'NO'
        ),
        COALESCE((
            SELECT 'default=' || COALESCE(column_default, 'NULL') || ', nullable=' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'agent_evidence_memory'
              AND column_name = 'redaction_status'
        ), 'redaction_status column missing')

    UNION ALL
    SELECT
        '063_agent_evidence_memory_constraints',
        to_regclass('public.agent_evidence_memory') IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM (VALUES
                ('agent_evidence_memory_redaction_status_check'),
                ('agent_evidence_memory_attachment_check'),
                ('agent_evidence_memory_evidence_summary_array_check')
            ) AS required(conname)
            WHERE NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = to_regclass('public.agent_evidence_memory')
                  AND conname = required.conname
                  AND contype = 'c'
            )
        ),
        COALESCE((
            SELECT string_agg(required.conname, ',' ORDER BY required.conname)
            FROM (VALUES
                ('agent_evidence_memory_redaction_status_check'),
                ('agent_evidence_memory_attachment_check'),
                ('agent_evidence_memory_evidence_summary_array_check')
            ) AS required(conname)
            WHERE NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = to_regclass('public.agent_evidence_memory')
                  AND conname = required.conname
                  AND contype = 'c'
            )
        ), 'all required constraints present')

    UNION ALL
    SELECT
        '063_agent_evidence_memory_indexes',
        NOT EXISTS (
            SELECT 1
            FROM (VALUES
                ('agent_evidence_memory_task_idx'),
                ('agent_evidence_memory_execution_idx'),
                ('agent_evidence_memory_agent_idx'),
                ('agent_evidence_memory_retention_idx')
            ) AS required(indexname)
            WHERE NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'agent_evidence_memory'
                  AND indexname = required.indexname
            )
        ),
        COALESCE((
            SELECT string_agg(required.indexname, ',' ORDER BY required.indexname)
            FROM (VALUES
                ('agent_evidence_memory_task_idx'),
                ('agent_evidence_memory_execution_idx'),
                ('agent_evidence_memory_agent_idx'),
                ('agent_evidence_memory_retention_idx')
            ) AS required(indexname)
            WHERE NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'agent_evidence_memory'
                  AND indexname = required.indexname
            )
        ), 'all required indexes present')

    UNION ALL
    SELECT
        'tenant_tier_seed_horizon_infinite',
        -- Two valid lineages are accepted:
        --   (1) a tenant_tier ENUM type carrying seed/horizon/infinite (some
        --       environments), OR
        --   (2) the production lineage where tenants.tier is a TEXT/VARCHAR
        --       column, NOT NULL, defaulting to 'seed' (no enum type exists and
        --       migrations/026 must NOT be run there).
        (
            NOT EXISTS (
                SELECT 1
                FROM (VALUES ('seed'), ('horizon'), ('infinite')) AS required(enumlabel)
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'tenant_tier'
                      AND e.enumlabel = required.enumlabel
                )
            )
            AND EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'tenant_tier' AND typtype = 'e'
            )
        )
        OR EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tenants'
              AND column_name = 'tier'
              AND data_type IN ('text', 'character varying')
              AND is_nullable = 'NO'
              AND column_default ILIKE '%''seed''%'
        ),
        COALESCE(
            (
                SELECT 'enum tenant_tier={' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) || '}'
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'tenant_tier'
            ),
            (
                SELECT 'text tenants.tier (' || data_type || ', nullable=' || is_nullable
                       || ', default=' || COALESCE(column_default, 'NULL') || ')'
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'tenants'
                  AND column_name = 'tier'
            ),
            'neither tenant_tier enum nor tenants.tier text/varchar column found'
        )

    UNION ALL
    SELECT
        'proof_sync_trigger_present',
        EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'task_record_proof_state_from_lineage'
              AND tgrelid = 'execution_lineage'::regclass
              AND NOT tgisinternal
        ),
        COALESCE((
            SELECT tgname || ' on ' || tgrelid::regclass::text
            FROM pg_trigger
            WHERE tgname = 'task_record_proof_state_from_lineage'
              AND tgrelid = 'execution_lineage'::regclass
              AND NOT tgisinternal
            LIMIT 1
        ), 'missing task_record_proof_state_from_lineage trigger')

    UNION ALL
    SELECT
        'proof_sync_function_present',
        EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'sync_task_record_proof_state_from_lineage'
        ),
        'sync_task_record_proof_state_from_lineage'

    -- ── Prerequisites: canonical baseline objects the 057-063 set depends on ──
    UNION ALL
    SELECT
        'prereq_task_records_present',
        to_regclass('public.task_records') IS NOT NULL,
        COALESCE(to_regclass('public.task_records')::text,
                 'missing task_records (canonical baseline <=031 required; STOP)')

    UNION ALL
    SELECT
        'prereq_action_definitions_present',
        to_regclass('public.action_definitions') IS NOT NULL,
        COALESCE(to_regclass('public.action_definitions')::text,
                 'missing action_definitions (migration 054 required; STOP)')

    UNION ALL
    SELECT
        'prereq_execution_input_refs_present',
        to_regclass('public.execution_input_refs') IS NOT NULL,
        COALESCE(to_regclass('public.execution_input_refs')::text,
                 'missing execution_input_refs (migration 056 required; STOP)')

    -- ── 059: safe key rotation metadata on input-ref decrypt audits ──────────
    UNION ALL
    SELECT
        '059_execution_input_ref_audit_key_version_column',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_input_ref_audit'
              AND column_name = 'key_version'
        ),
        COALESCE((
            SELECT 'nullable=' || is_nullable || ', default=' || COALESCE(column_default, 'NULL')
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'execution_input_ref_audit'
              AND column_name = 'key_version'
        ), 'missing execution_input_ref_audit.key_version column')

    -- ── 061: tenant-scoped Agent Registry ───────────────────────────────────
    UNION ALL
    SELECT
        '061_registered_agents_table_present',
        to_regclass('public.registered_agents') IS NOT NULL,
        COALESCE(to_regclass('public.registered_agents')::text,
                 'missing registered_agents table')

    UNION ALL
    SELECT
        '061_registered_agents_active_unique_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'registered_agents'
              AND indexname = 'registered_agents_tenant_name_active_idx'
              AND indexdef ILIKE '%UNIQUE%'
              AND indexdef ILIKE '%tenant_id%'
              AND indexdef ILIKE '%name%'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'registered_agents'
              AND indexname = 'registered_agents_tenant_name_active_idx'
            LIMIT 1
        ), 'missing registered_agents active tenant/name unique index')

    -- ── 062: registered agent attribution on durable task runs ──────────────
    UNION ALL
    SELECT
        '062_task_records_registered_agent_id_column',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_records'
              AND column_name = 'registered_agent_id'
        ),
        COALESCE((
            SELECT 'data_type=' || data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_records'
              AND column_name = 'registered_agent_id'
        ), 'missing task_records.registered_agent_id column')

    UNION ALL
    SELECT
        '062_task_records_registered_agent_name_column',
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_records'
              AND column_name = 'registered_agent_name'
        ),
        COALESCE((
            SELECT 'data_type=' || data_type || ', nullable=' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'task_records'
              AND column_name = 'registered_agent_name'
        ), 'missing task_records.registered_agent_name column')

    -- ── 064: deterministic execution evaluations ────────────────────────────
    UNION ALL
    SELECT
        '064_execution_evals_table_present',
        to_regclass('public.execution_evals') IS NOT NULL,
        COALESCE(to_regclass('public.execution_evals')::text,
                 'missing execution_evals table')

    UNION ALL
    SELECT
        '064_execution_eval_runs_table_present',
        to_regclass('public.execution_eval_runs') IS NOT NULL,
        COALESCE(to_regclass('public.execution_eval_runs')::text,
                 'missing execution_eval_runs table')

    UNION ALL
    SELECT
        '064_execution_evals_tenant_active_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_evals'
              AND indexname = 'idx_execution_evals_tenant_active'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_evals'
              AND indexname = 'idx_execution_evals_tenant_active'
            LIMIT 1
        ), 'missing idx_execution_evals_tenant_active')

    UNION ALL
    SELECT
        '064_execution_eval_runs_task_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_eval_runs'
              AND indexname = 'idx_execution_eval_runs_task'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'execution_eval_runs'
              AND indexname = 'idx_execution_eval_runs_task'
            LIMIT 1
        ), 'missing idx_execution_eval_runs_task')

    -- ── 065: policy proposal lifecycle ──────────────────────────────────────
    UNION ALL
    SELECT
        '065_policy_proposals_table_present',
        to_regclass('public.policy_proposals') IS NOT NULL,
        COALESCE(to_regclass('public.policy_proposals')::text,
                 'missing policy_proposals table')

    UNION ALL
    SELECT
        '065_policy_proposal_events_table_present',
        to_regclass('public.policy_proposal_events') IS NOT NULL,
        COALESCE(to_regclass('public.policy_proposal_events')::text,
                 'missing policy_proposal_events table')

    UNION ALL
    SELECT
        '065_policy_proposals_tenant_active_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'policy_proposals'
              AND indexname = 'idx_policy_proposals_tenant_active'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'policy_proposals'
              AND indexname = 'idx_policy_proposals_tenant_active'
            LIMIT 1
        ), 'missing idx_policy_proposals_tenant_active')

    UNION ALL
    SELECT
        '065_policy_proposal_events_proposal_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'policy_proposal_events'
              AND indexname = 'idx_policy_proposal_events_proposal'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'policy_proposal_events'
              AND indexname = 'idx_policy_proposal_events_proposal'
            LIMIT 1
        ), 'missing idx_policy_proposal_events_proposal')

    -- ── 066: trust recommendation lifecycle state ───────────────────────────
    UNION ALL
    SELECT
        '066_trust_recommendation_states_table_present',
        to_regclass('public.trust_recommendation_states') IS NOT NULL,
        COALESCE(to_regclass('public.trust_recommendation_states')::text,
                 'missing trust_recommendation_states table')

    UNION ALL
    SELECT
        '066_trust_recommendation_states_unique_tenant_recommendation',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'trust_recommendation_states'
              AND indexdef ILIKE '%UNIQUE%'
              AND indexdef ILIKE '%tenant_id%'
              AND indexdef ILIKE '%recommendation_id%'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'trust_recommendation_states'
              AND indexdef ILIKE '%UNIQUE%'
              AND indexdef ILIKE '%recommendation_id%'
            LIMIT 1
        ), 'missing UNIQUE (tenant_id, recommendation_id) on trust_recommendation_states')

    UNION ALL
    SELECT
        '066_trust_recommendation_states_tenant_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'trust_recommendation_states'
              AND indexname = 'idx_trust_rec_states_tenant'
        ),
        COALESCE((
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'trust_recommendation_states'
              AND indexname = 'idx_trust_rec_states_tenant'
            LIMIT 1
        ), 'missing idx_trust_rec_states_tenant')

    -- ── schema_migrations advisory: object checks above are authoritative ────
    -- Two incompatible ledger shapes exist in this repo (migration_name vs
    -- version). Rather than trust a ledger that may disagree with reality, this
    -- row only surfaces the ledger's presence/shape so a stale "applied" marker
    -- can be reconciled by hand. A genuine "applied but object missing" conflict
    -- shows up as a FAIL in the object checks above, which are the source of
    -- truth. This row always passes by design.
    UNION ALL
    SELECT
        'schema_migrations_advisory',
        TRUE,
        CASE
            WHEN to_regclass('public.schema_migrations') IS NULL
                THEN 'schema_migrations absent; object checks above are authoritative'
            ELSE 'schema_migrations present (cols: ' ||
                COALESCE((
                    SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'schema_migrations'
                ), '?') ||
                '); trust the object checks above, not this ledger'
        END
)
SELECT
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
    check_name,
    detail
FROM checks
ORDER BY check_name;

COMMIT;
