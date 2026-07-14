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
- The pre-role catalog hash equals the pinned bootstrap v069 digest
- A PostgreSQL 16 canonical-v2 post-role manifest uses explicit `text`
  structured rows and length-framed hashing for columns/defaults, constraints,
  indexes, triggers, policies, functions, views/rules, types, sequences,
  migration-ledger structure, relation options/partitioning, and RLS flags
- Migration-069 immutability triggers are in exact origin mode (`tgenabled=O`),
  not disabled, replica-only, or always mode
- Ownership and grants match the least-privilege role model independently of
  the structural manifest
- Migration-069 immutability triggers are enabled
- Runtime role does not own immutable tables
- Runtime cannot `UPDATE`/`DELETE` immutable rows or mutate schema history
- Runtime can insert contracts/evidence and complete idempotency updates
- RLS remains active on baseline tenant-scoped tables
- Nonzero exit on any mismatch

## Staging preflight and disposable smoke

```bash
IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN='postgres://…@localhost/postgres' \
  make database-staging-smoke
```

An externally supplied admin DSN runs **non-destructive preflight only**. The
full create/apply/smoke/drop path is available only through the PG16 validation
helper, which creates a socket-only cluster and a run-specific identity marker.
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

## PostgreSQL version evidence

| Environment | Result |
| --- | --- |
| Local PostgreSQL **14.18** (prior staging foundation branch) | Bootstrap, roles, Connected store paths, preflight, disposable smoke **passed** |
| Local PostgreSQL **16.14** (disposable localhost instance; this branch) | Bootstrap, roles, runtime-role paths, contract/evidence suites, coordinator disposable-schema harness, private-alpha cross-slice E2E, preflight, disposable smoke **passed** |
| Hosted GitHub Actions `postgres:16` | Wired in secure `private-alpha-ci.yml` `go-postgres` job; **not claimed passed until Actions runs** |

Pre-role catalog hash on both 14.18 and 16.14:

```text
034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4
```

That matches the pinned bootstrap `ExpectedV069SchemaSHA256`. No pre-role hash
update was required. After role provisioning, preflight uses a PostgreSQL
16-specific canonical structural manifest and validates ownership/grants in a
separate role-model layer. A new PostgreSQL major version requires review of all
`pg_get_*` rendering and a newly validated post-role structural hash.

Local PG16 validation helper (helper-created disposable cluster only):

```bash
# Required: an explicitly selected PostgreSQL 16 installation prefix.
IGRIS_PG16_PREFIX=/path/to/verified/postgresql-16 \
./scripts/connected/pg16_local_validate.sh
```

The helper refuses external admin DSNs. It verifies `initdb`, `pg_ctl`,
`postgres`, and `psql`, creates private run-scoped state, starts a socket-only
cluster, and binds destructive work to a marker containing the run ID, data
directory, socket directory, and port. Every validation stage is fatal. Cleanup
stops and verifies the exact postmaster before deleting state; if shutdown
cannot be proven, the helper exits nonzero and reports a bounded retained state
directory for manual remediation.

## Remaining production blockers

This branch does **not** claim production deployment readiness. Remaining
blockers include (non-exhaustive):

- Agent F independent bootstrap / staging-delta security verdict (merge gate)
- Hosted GitHub Actions execution of the newly wired PostgreSQL 16 suites
- Cloud provisioning (Azure/Neon) out of scope here
- Distributed rate limiting, tenant storage quotas
- Key rotation and fine-grained API-key scopes
- Production secrets, network isolation, and backup automation
- Multi-replica / HA topology

## Deployment status

**Not deployed.** No shared database was touched. No Azure or Neon resources
were created by this work.
