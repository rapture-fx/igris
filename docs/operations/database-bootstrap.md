# Connected database bootstrap

## Problem statement

The historical SQL files do not form one clean, sortable migration chain. A
new Connected database therefore must not be provisioned by mounting a
migration directory into PostgreSQL or by replaying every numbered file.

The failure was reproduced at commit
`c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` on disposable PostgreSQL 14.18:

1. Sorted `migrations/*.sql` stops at
   `001_production_enhancements.sql:68` because `tenant_keys` is referenced
   before `004_use_tenant_keys.sql` creates it.
2. Sorted `igris-overture/database/migrations/*.sql` reaches
   `010_provider_key_reference.sql:9` before `provider_registry` exists.
3. Prepending the older phase-13 SQL gets the root chain farther, but
   `001_production_enhancements.sql:140` then attempts a partial-index
   predicate containing `NOW()`. PostgreSQL rejects it because index
   predicates must use immutable expressions.

These failures predate the private-alpha baseline. The affected files have
history dating from November and December 2025 through March 2026, and existing
deployment documentation already treats Overture migration 010 as optional
legacy inference plumbing. Applied production history is not recorded in this
repository, so migrations 001 through 069 remain byte-for-byte unchanged.

## Historical migration roots

The repository contains three SQL roots with different roles:

- `scripts/migrations/`: the old phase-13/14 base (`001_initial_schema.sql`,
  `002_multi_tenancy.sql`). It creates a UUID-bearing legacy tenant shape and
  is not used by the current Connected proof runner.
- `migrations/`: legacy inference-provider and optimizer migrations. Docker
  Compose mounts this directory directly into `docker-entrypoint-initdb.d`.
  It has duplicate numeric prefixes and internal forward references.
- `igris-overture/database/migrations/`: the current Overture history. Current
  proof scripts apply selected files from this root and use a name-only
  `schema_migrations` table with no checksum.

`igris-overture/database/schema.sql` is only the earlier persistence schema; it
is not an authoritative current Connected schema.

The actions-first Connected track is explicitly documented in
`docs/LIVE_MODE_BRINGUP.md`: Overture migrations 001-009 and 011 onward are the
supported actions/runs/keys/runtime schema. Migration 010 crosses into the
legacy inference root. Real inference-provider routing remains a separate,
unsupported greenfield scenario until its UUID tenant model is reconciled with
the current text tenant identity.

### Inventory in execution order

Old phase-13 root:

```text
001_initial_schema.sql
002_multi_tenancy.sql
```

Legacy inference root (lexical order, which is not a valid bootstrap order):

```text
001_create_optimizer_states.sql
001_production_enhancements.sql
002_create_tenant_budgets.sql
003_create_api_keys_table.sql
004_create_provider_registry.sql
004_use_tenant_keys.sql
005_create_routing_telemetry.sql
005_create_slo_audit_events.sql
006_create_semantic_bandit_rewards.sql
007_create_policy_audit_log.sql
008_add_tier_column_to_tenants.sql
009_add_sso_providers_table.sql
010_add_budget_fields_to_tenants.sql
011_create_customer_routing_preferences.sql
012_create_cognitive_proposals.sql
013_add_tenant_row_level_security.sql
015_add_2fa_columns.sql
016_better_auth.sql
016_tenant_routing_preferences.sql
017_shadow_comparisons.sql
018_council_performance.sql
019_add_comprehensive_rls_policies.sql
020_add_performance_indexes.sql
021_add_self_tuner_config.sql
022_add_cognitive_baselines.sql
023_add_tenant_crypto_keys.sql
024_tenant_apikey_columns.sql
025_trial_system_columns.sql
026_tenant_tier_enum_values.sql
027_runtime_instances_tenant_id.sql
028_remap_legacy_tier_names.sql
```

Overture actions-first order:

```text
001_fleet_management.sql
002_license_system.sql
003_usage_tracking.sql
004_row_level_security.sql
005_runtime_instances.sql
006_execution_lineage.sql
007_pricing_model_refactor.sql
008_runtime_registry.sql
009_download_audit.sql
010_provider_key_reference.sql                     UNSUPPORTED CROSS-ROOT FILE
011_trial_system.sql
012_tenant_apikey_fields.sql
013_gap_fill.sql
014_tenant_api_keys.sql
015_better_auth.sql
016_schema_gaps.sql
017_agent_settings.sql
018_tier_change_log.sql
019_bt_definitions.sql
020_ros_topic_mappings.sql
021_agent_blackboard.sql
022_bt_state_ros_topics.sql
023_agent_mode_flags.sql
024_agent_extended_settings.sql
025_ros_containment.sql
026_ros_topic_mappings_fix.sql
027_execution_prompt_preview.sql
028_federated_learning.sql
029_council_results.sql
030_routing_config.sql
031_task_records.sql
032_task_record_artifacts.sql
033_task_proof_state.sql
034_task_cancellation.sql
035_task_failure_details.sql
036_robotics_policy_settings.sql
037_robotics_receipt_audit.sql
038_robotics_policy_lifecycle.sql
039_robotics_policy_decision_audit.sql
040_robotics_policy_lifecycle_audit.sql
041_robotics_policy_signing_keys.sql
042_robotics_policy_command_nonce_audit.sql
043_ai_capability_governance_audit.sql
044_runtime_command_clear_generation.sql
045_runtime_command_spool_observability.sql
046_runtime_command_statuses.sql
047_execution_context.sql
048_verified_execution_schema_repair.sql
049_task_proof_verification_summary.sql
050_tenant_email_alignment.sql
051_execution_governance_recovery.sql
052_runtime_callback_envelopes.sql
053_tenant_local_proof_columns.sql
054_action_definitions.sql
055_action_execution_targets.sql
056_execution_input_refs.sql
057_task_records_tenant_scoped_idempotency.sql
058_execution_lineage_tenant_bound.sql
059_execution_input_ref_audit_key_version.sql
060_execution_context_tenant_bound.sql
061_registered_agents.sql
062_task_records_registered_agent.sql
063_agent_evidence_memory.sql
064_execution_evals.sql
065_policy_proposals.sql
066_trust_recommendation_states.sql
067_action_contract_versions.sql                   FORWARD MIGRATION
068_sdk_evidence_ingestion.sql                     FORWARD MIGRATION
069_connected_immutable_records.sql                FORWARD MIGRATION
```

Within each numeric range above, the repository contains exactly one file per
number. The full filenames remain discoverable in
`igris-overture/database/migrations/`; duplicate numbering exists only in the
legacy root.

## Selected bootstrap architecture

`igris-overture/database/bootstrap/connected_actions_v066.sql` is a
schema-only baseline generated from a clean disposable replay of the supported
Overture actions-first track through 066. It contains no application rows,
database credentials, ownership clauses, or grants. The Go bootstrap command:

1. verifies the embedded baseline and forward-migration SHA-256 checksums;
2. requires PostgreSQL 14 or newer;
3. classifies the database as fresh, recorded v066, recorded v069, exact
   unrecorded v066, or unknown;
4. takes a transaction-scoped advisory lock and rechecks state under the lock;
5. installs v066 and applies 067-069 in one transaction for a fresh database;
6. records the baseline and each forward migration in
   `public.igris_schema_history` with SHA-256 checksums; and
7. verifies the resulting catalog manifest before commit.

The catalog manifest covers extensions, relations, columns and defaults,
primary/foreign/unique/check constraints, indexes and predicates, functions,
triggers, RLS flags and policies, enums/domains, sequences, views, and
materialized views, including relation and function ACLs. It excludes only migration-ledger tables and
non-semantic ownership/timestamps/OIDs.

No application startup path imports or invokes this command.

## Fresh database procedure

Use a direct PostgreSQL connection as a dedicated migration owner. Do not use a
transaction-pooled URL.

```bash
export DATABASE_URL_MIGRATION='postgresql://MIGRATION_ROLE@HOST/DATABASE?sslmode=require'
export IGRIS_DB_ROLE_MIGRATION_OWNER='MIGRATION_ROLE'
make database-bootstrap-preflight
make database-bootstrap
```

The preflight is read-only and prints the selected path, baseline checksum, and
forward migration range. It never prints the connection URL. The apply command
must report `result=current-v069 schema verified`.

## Existing database procedure

A database already created by this mechanism is handled automatically:

- recorded v066: verify the v066 catalog and apply 067-069 atomically;
- recorded v069: verify checksums and the catalog, then no-op;
- any inconsistent ledger or catalog: fail closed.

Older actions-first databases may have no checksum ledger. Adoption is
supported only when the complete catalog is an exact v066 match:

```bash
export DATABASE_URL_MIGRATION='postgresql://MIGRATION_ROLE@HOST/DATABASE?sslmode=require'
export IGRIS_DB_ROLE_MIGRATION_OWNER='MIGRATION_ROLE'
make database-bootstrap-preflight
# Review the exact-v066 result and take a backup.
make database-bootstrap-adopt-v066
```

Apply and adoption verify that both PostgreSQL `session_user` and
`current_user` equal `IGRIS_DB_ROLE_MIGRATION_OWNER` before opening the write
transaction. A superuser connection, runtime URL, `SET ROLE` session, or
generic `DATABASE_URL` fallback is refused by the bootstrap command.

Ordinary `database-bootstrap` refuses an unrecorded baseline. Adoption is an
explicit operator action; it records v066 only after proving the corresponding
schema exists, then applies 067-069. Existing rows are not rewritten.

## Baseline checksum and versioning

- component: `connected-actions`
- cutoff: `v066`
- baseline SHA-256:
  `7b657178b48c9d1bc92daf55f73c85540df1c84213d1366af09e60b49d727097`
- expected v066 catalog SHA-256:
  `5ff504aec3d36e5a0f4ff2efc708158bd18e352e04d38171d58f6aa3c90f6aec`
- expected v069 catalog SHA-256:
  `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`

Changing a baseline is a new reviewed baseline version. Never replace the file
while retaining its version or checksum. Forward migrations retain their own
source-file checksums in the ledger.

## Failure and rollback behavior

Baseline installation and 067-069 use one transaction. SQL failure, checksum
mismatch, catalog mismatch, cancellation, or lost connectivity rolls back the
whole invocation. A retry begins from the last committed state. No failed or
partial migration is recorded as applied.

The command refuses:

- PostgreSQL older than 14;
- a non-empty unknown public schema;
- a missing ledger on anything other than exact v066;
- exact v066 adoption through ordinary apply mode;
- a wrong baseline or migration checksum;
- a ledger that claims objects which are absent or changed;
- a partial 067-069 ledger; or
- state that changes between preflight and the locked transaction.

See `database-migration-recovery.md` for operator recovery steps.

## Disaster-recovery considerations

Backups remain mandatory. The baseline is a provisioning artifact, not a
replacement for physical backups or point-in-time recovery. Restore into an
isolated database, validate the ledger and catalog with preflight, exercise the
application contract tests, and only then promote it.

Migration 069 makes accepted Connected records immutable. During an audited
offline restore, only the table owner or superuser may temporarily disable its
named triggers. Re-enable them before any application role can connect and run
preflight afterward. Application roles must not own schema objects or receive
trigger-management privileges.

## Migrations 067 through 069 manual application

They remain repository migration files and are not folded into v066. The
explicit bootstrap command applies them after the baseline and records their
individual checksums. This is still a manual operational action; nothing runs
them on API startup. Existing v066 databases use the same forward path.

## Production deployment prerequisites

Before production use:

- use a dedicated migration role and separate least-privilege application role;
- define and review production ownership/grants (the repository does not yet
  manage a complete application-role grant set);
- use UTF-8, TLS, a direct connection, backup/PITR, and a tested restore;
- run the bootstrap integration suite on the target PostgreSQL major version;
- run API, contract, evidence lifecycle, migration-069 immutability, and tenant
  isolation tests against a disposable clone; and
- archive command output and ledger/catalog attestations without credentials.

## Unsupported scenarios

- Greenfield inference-provider routing from the legacy root.
- Automatic adoption of arbitrary or partially migrated schemas.
- Creating a baseline from a live database with unknown provenance.
- PostgreSQL 13 or older.
- Pooled migration connections, shared-development mutation, application
  startup migration, downgrade, or history rewrite.
