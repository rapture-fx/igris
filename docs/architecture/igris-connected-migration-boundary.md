# ADR: Explicit operator boundary for Connected database migrations

- **Status:** Accepted
- **Date:** 2026-07-15
- **Scope:** Actions-first Connected PostgreSQL bootstrap through v069

## Context

The Connected database has two distinct concerns that must not be conflated:

1. an operator needs a deterministic way to install the supported v066
   baseline and immutable forward migrations 067 through 069; and
2. application processes need a runtime database connection that can read and
   write only the product data allowed by the Connected role model.

The original private-alpha migration guard encoded the second requirement by
rejecting every non-test Go reference to migration assets. That blanket rule
also rejected the dedicated `igris-db-bootstrap` operator tool, even though the
tool is not part of application startup.

The integration audit also found a real dependency-boundary problem that the
blanket guard exposed indirectly: the runtime server linked the bootstrap
executor and embedded migration assets through the transitive path
`database -> roles -> bootstrap -> migrations`. Runtime startup did not invoke
the executor, but carrying the executable migration path in the runtime binary
made the intended boundary harder to prove and maintain.

## Decision

Migration execution is an explicit operator operation. Immutable migration
assets may be consumed only by the dedicated Connected bootstrap executor, and
that executor may be invoked only by the `igris-db-bootstrap` command or by
tests that use disposable databases.

Read-only schema-state inspection is a separate package. Application runtime
diagnostics and staging preflight may inspect schema history, checksums, and
catalog manifests, but the read-only package does not embed migration SQL and
cannot execute DDL.

The production dependency boundary is:

```text
igris-db-bootstrap -> bootstrap executor -> migrations assets
                              |
                              v
                       read-only schema state

igris-overture runtime -> roles/diagnostics -> read-only schema state
```

The runtime dependency graph must not contain the bootstrap executor or the
migration-assets package.

## Allowed migration code boundary

- `igris-overture/database/migrations` owns immutable historical SQL assets.
- `igris-overture/database/bootstrap` is the only production package allowed
  to import those assets or execute the supported baseline/forward plan.
- `cmd/igris-db-bootstrap` is the only production command allowed to import
  the bootstrap executor.
- Tests may import the executor when they create and destroy disposable local
  databases.
- Read-only schema-state and staging-preflight packages may reference version
  names and pinned checksums, but may not import or expose migration SQL.

No other API, worker, coordinator, request-handler, SDK, or general runtime
package may import the executor, import migration assets, or invoke migration
execution.

## Credential boundary

Migration apply and v066 adoption require an explicitly configured migration
owner. The executor verifies that both the PostgreSQL session identity and
current identity match that expected role before starting a write transaction.
Preflight remains read-only and may be run with an inspection-capable operator
connection.

The bootstrap CLI accepts migration credentials only from an explicit
`--database-url` argument or `DATABASE_URL_MIGRATION`. It does not fall back to
`DATABASE_URL_RUNTIME`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, or
`POSTGRES_URL`.

The application runtime:

- never reads `DATABASE_URL_MIGRATION` as a connection fallback;
- refuses a runtime URL that is equal to the configured migration URL;
- does not own schema objects;
- has no schema `CREATE`, table `ALTER`, table `DROP`, trigger-administration,
  role-administration, or schema-history mutation privileges; and
- never repairs privilege or schema drift during startup.

Migration-owner and application-runtime role names must remain distinct.

## Guard policy

The migration guard enforces semantics rather than a blanket source ban. It
must fail when:

- migrations 067, 068, or 069 change or lose their manual-operation notices;
- a production package outside the bootstrap executor imports migration
  assets;
- a production command outside `igris-db-bootstrap` imports the executor;
- a runtime dependency graph contains the executor or migration-assets
  package;
- API, coordinator, request-handler, SDK, or runtime source invokes migration
  execution; or
- the explicit allowlist grows without a reviewed guard change.

The guard is not a substitute for PostgreSQL authorization. Database role
tests must continue to prove that runtime credentials cannot execute DDL or
mutate schema history.

## Historical migrations

Migrations 001 through 069 remain byte-identical. This decision changes only
which dedicated component may consume the existing immutable assets. It does
not reorder, edit, rename, replace, or auto-apply historical migrations.

## Consequences

- Operators retain a deterministic, fail-closed bootstrap path.
- Application startup remains migration-free even against an outdated schema.
- Runtime binaries no longer link migration SQL or the migration executor.
- Migration application requires an explicit command, explicit migration DSN,
  explicit expected owner, and database privileges granted outside the
  application runtime.
- Hosted CI and local PostgreSQL tests remain responsible for proving both the
  positive operator path and negative runtime path.
