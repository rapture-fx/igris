# Connected private staging foundation

## Supported actions-first scope

Private Connected staging is optional infrastructure for:

- ActionContract synchronization
- Centrally verified Embedded evidence
- SDK signing-key registration (public keys only)
- Idempotency records for contract sync and evidence ingest
- Migration-069 immutability protections

Connected is **not** a prerequisite for Embedded SDK use.

## Unsupported legacy provider scope

Out of scope for this staging foundation:

- Legacy inference-provider greenfield schema
- `provider_registry` path
- Optimizer and provider bootstrap
- Managed runtime execution storage

## Migration-owner versus runtime credentials

Use separate credentials:

```bash
export DATABASE_URL_MIGRATION='postgres://igris_migration_owner@…/connected_staging'
export DATABASE_URL_RUNTIME='postgres://igris_app_runtime@…/connected_staging'
```

The API reads `DATABASE_URL_RUNTIME` (preferred) or `DATABASE_URL` /
`POSTGRES_URL`. It never falls back to `DATABASE_URL_MIGRATION`. See
`docs/operations/database-roles-and-grants.md`.

## Role provisioning

After schema bootstrap:

```bash
make database-roles-preflight
make database-roles
```

## Greenfield bootstrap

Empty database:

```bash
DATABASE_URL_MIGRATION='…' make database-bootstrap-preflight
DATABASE_URL_MIGRATION='…' make database-bootstrap
DATABASE_URL_MIGRATION='…' make database-roles
DATABASE_URL_MIGRATION='…' make database-staging-preflight
```

Details: `docs/operations/database-bootstrap.md`.

## Existing v066 adoption

Exact unrecorded v066 schema only:

```bash
DATABASE_URL_MIGRATION='…' go run ./cmd/igris-db-bootstrap --mode=adopt-v066
DATABASE_URL_MIGRATION='…' make database-roles
```

Unknown or partial schemas fail closed.

## Preflight checks

```bash
make database-staging-preflight
```

Verifies:

- Schema history includes v066 + 067 + 068 + 069 with pinned checksums
- Catalog hash equals bootstrap v069 digest **or** the supported post-role
  ACL-adjusted equivalent (ledger + ownership + grants)
- Migration-069 immutability triggers are enabled
- Runtime role does not own immutable tables
- Runtime cannot `UPDATE`/`DELETE` immutable rows or mutate schema history
- Runtime can insert contracts/evidence and complete idempotency updates
- RLS remains active on baseline tenant-scoped tables
- Nonzero exit on any mismatch

## Staging smoke procedure

```bash
IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN='postgres://…@localhost/postgres' \
  make database-staging-smoke
```

See `docs/operations/connected-staging-smoke.md`.

## Failure and rollback behavior

- Bootstrap and role provisioning run in transactions with advisory locks.
- Failed applies roll back; partial 067–069 ledgers are refused.
- Privilege drift is detected by preflight/diagnostics; it is not auto-repaired
  at API startup.
- Recovery steps: `docs/operations/database-migration-recovery.md`.

## Backup and restore boundary

- `igris_backup_restore` may `SELECT` for logical dumps.
- Restores that disable immutability triggers require migration-owner/superuser
  and must re-enable triggers before returning the database to service.
- Application roles must never receive trigger-management rights.

## Manual migration requirement

No application-startup auto-migrations. Operators run bootstrap / role tools
explicitly.

## Single-replica alpha limitation

Private alpha Connected staging assumes a single PostgreSQL primary. There is
no multi-primary, logical-decoding fan-out, or distributed rate-limit store in
this foundation.

## Remaining production blockers

This branch does **not** claim production deployment readiness. Remaining
blockers include (non-exhaustive):

- Agent F independent bootstrap security verdict (merge gate)
- Hosted PostgreSQL 16 CI proof for this branch’s full role suite
- Cloud provisioning (Azure/Neon) out of scope here
- Distributed rate limiting, tenant storage quotas
- Key rotation and fine-grained API-key scopes
- Production secrets, network isolation, and backup automation
- Multi-replica / HA topology

## Deployment status

**Not deployed.** No shared database was touched. No Azure or Neon resources
were created by this work.
