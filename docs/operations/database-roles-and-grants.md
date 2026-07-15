# Connected database roles and grants

## Supported actions-first scope

This role model applies only to the actions-first Connected baseline produced by
the deterministic bootstrap (`docs/operations/database-bootstrap.md`):

- ActionContract storage (`action_contract_versions`, `contract_sync_idempotency`)
- SDK signing keys and Embedded evidence (`sdk_signing_keys`,
  `sdk_evidence_batches`, `sdk_evidence_events`, `evidence_ingest_idempotency`)
- Supporting actions-first baseline tables through Overture v066 plus migrations
  067–069
- Migration ledger `igris_schema_history`
- Migration-069 immutability triggers

## Unsupported legacy provider scope

Do **not** use this model to bootstrap or reconcile:

- Legacy inference-provider greenfield schema
- `provider_registry` path
- Optimizer / provider bootstrap
- Managed runtime execution storage as a substitute for Embedded evidence

## Migration-owner versus runtime credentials

| Variable | Role | Use |
| --- | --- | --- |
| `DATABASE_URL_MIGRATION` | `igris_migration_owner` | Bootstrap and forward migrations; role provisioning may separately use an authorized operator connection |
| `DATABASE_URL_RUNTIME` | `igris_app_runtime` | Go API process |
| `DATABASE_URL` / `POSTGRES_URL` | Runtime only (legacy alias) | Accepted by the API when `DATABASE_URL_RUNTIME` is unset |

Hard rules:

- The API **never** falls back to `DATABASE_URL_MIGRATION`.
- If `DATABASE_URL_RUNTIME` / `DATABASE_URL` equals `DATABASE_URL_MIGRATION`,
  the runtime config refuses the URL.
- Bootstrap apply/adopt requires direct migration-owner credentials; a
  superuser using `SET ROLE` is not accepted as the bootstrap credential.
- Role provisioning requires an explicitly supplied authorized operator
  connection and remains separate from application startup.
- Passwords are never embedded in repository SQL artifacts.

Optional role name overrides:

- `IGRIS_DB_ROLE_MIGRATION_OWNER` (default `igris_migration_owner`)
- `IGRIS_DB_ROLE_APP_RUNTIME` (default `igris_app_runtime`)
- `IGRIS_DB_ROLE_READ_ONLY_OPERATOR` (default `igris_read_only_operator`)
- `IGRIS_DB_ROLE_BACKUP_RESTORE` (default `igris_backup_restore`)

## Role model

### `igris_migration_owner`

- Owns repository-managed Connected schema objects after provisioning.
- May run bootstrap and forward migrations.
- Must not be used by the running API.

### `igris_app_runtime`

- Used by the Go API.
- Must not own tables, functions, triggers, or migration ledger objects.
- Must not `ALTER` schema, disable triggers, create extensions, or manage roles.
- Receives `SELECT` + `INSERT` on immutable Connected tables.
- Receives narrow `UPDATE` only on idempotency tables
  (`contract_sync_idempotency`, `evidence_ingest_idempotency`).
- Receives DML on other mutable application tables required for staging API
  operation, without ownership or DDL.
- Has **no** privileges on `igris_schema_history`.

### `igris_read_only_operator`

- `SELECT` on application tables for tenant-scoped operational inspection.
- Cannot insert, update, delete, truncate, alter, or manage triggers/roles.

### `igris_backup_restore`

- `SELECT` for controlled logical backup (`pg_dump` style).
- No ordinary application login workflow.
- Restore that needs trigger suspension or owner-level rewrites is an **explicit
  administrative** procedure using the migration owner or superuser, documented
  in the recovery runbook. Never grant trigger-disable rights to the API role.

## Role provisioning

```bash
# Preflight (fail closed if roles/grants/ownership are wrong)
DATABASE_URL_MIGRATION='postgres://…' go run ./cmd/igris-db-roles --mode=preflight

# Apply (idempotent)
DATABASE_URL_MIGRATION='postgres://…' go run ./cmd/igris-db-roles --mode=apply
```

Makefile targets:

- `make database-roles-preflight`
- `make database-roles`

Provisioning:

1. Creates missing roles as `LOGIN` **without passwords**.
2. Reassigns public schema object ownership to the migration owner.
3. Applies least-privilege grants and revokes `PUBLIC`.
4. Pins `search_path` on `SECURITY DEFINER` functions.
5. Re-verifies and fails closed on residual issues.

Set role passwords out of band (`ALTER ROLE … PASSWORD` via a secrets manager,
or use peer/cert auth). Never commit passwords.

## Startup diagnostic

When `DB_RUNTIME_PRIVILEGE_DIAGNOSTIC=true` or `DB_FAIL_FAST=true`, API connect
logs a credential-safe privilege diagnostic (`db_runtime_user=…`,
`db_runtime_privilege_status=ok|unsafe`). With `DB_FAIL_FAST=true`, unsafe
states refuse startup. Drift is **never** auto-repaired at API boot.

## Manual migration requirement

Schema changes remain manual/explicit via bootstrap or operator-run migrations.
Application startup must not auto-migrate.
