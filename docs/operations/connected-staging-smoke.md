# Connected staging smoke procedure

## Purpose

Prove a **disposable** Connected staging path end-to-end without shared
infrastructure:

1. Fresh bootstrap through v069
2. Least-privilege role provisioning
3. Staging preflight
4. Synthetic ActionContract row + idempotency completion as runtime
5. Synthetic fully-redacted Embedded evidence batch/event as runtime
6. Read-only operator can inspect and cannot mutate

## Prerequisites

- An explicitly selected PostgreSQL 16 installation for a full disposable smoke
- An admin DSN only for non-destructive preflight
- Repository checkout with Go 1.24 toolchain
- For PostgreSQL 16 specifically, the server must provide the `uuid-ossp`
  extension (standard on Homebrew/Docker Postgres images; required by the
  actions-first baseline)

## External target: non-destructive preflight only

```bash
export IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN='postgres://USER@localhost:5432/postgres?sslmode=disable'
make database-staging-smoke
```

This mode does not create or drop databases or roles. An external DSN is never
accepted by the release helper for destructive validation; host deny lists are
not treated as proof that a database is disposable.

## Helper-created target: full disposable smoke

```bash
IGRIS_PG16_PREFIX=/path/to/verified/postgresql-16 \
  ./scripts/connected/pg16_local_validate.sh
```

The helper starts its own socket-only cluster, creates a run-specific identity
marker, generates randomized database and role names, and passes the verified
identity to `staging_smoke.sh`. Direct disposable mode is intentionally not an
operator interface: it refuses work without matching run ID, server data
directory, socket, port, marker row, and generated role namespace.

## What it does **not** do

- Does not start a long-lived API process against shared infra
- Does not use production credentials or real tenant data
- Does not create Azure/Neon resources
- Does not print passwords or full secret-bearing DSNs in success output

## Expected result

```text
result=connected_staging_smoke_ok
```

Nonzero exit on any failed stage, including E2E and cleanup. The final marker is
not printed on failure. The disposable database and generated roles are removed
only after positive cluster identity is reverified. If PostgreSQL cannot be
proven stopped, the helper retains PGDATA, exits nonzero, and reports the private
run-state directory instead of deleting potentially live state.

## Offline journal note

The full Embedded SDK offline journal verify + HTTP evidence upload path is
covered by the private-alpha Go/Python E2E suites. This smoke focuses on the
database role boundary for Connected storage using synthetic, fully redacted
rows. Its runtime behavior uses `SET ROLE` on an administrator-authenticated
connection; it does not prove a dedicated runtime LOGIN or certificate path.
That remains an explicit private-alpha limitation.
