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
        'tenant_tier_enum_seed_horizon_infinite',
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
        ),
        COALESCE((
            SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'tenant_tier'
        ), 'tenant_tier enum missing')

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
)
SELECT
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
    check_name,
    detail
FROM checks
ORDER BY check_name;

COMMIT;
