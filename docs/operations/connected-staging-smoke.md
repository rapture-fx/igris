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

- Local PostgreSQL 14+ (this work was validated on 14.18)
- Admin DSN able to `CREATE DATABASE` / `CREATE ROLE`
- Repository checkout with Go 1.24 toolchain

## Command

```bash
export IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN='postgres://USER@localhost:5432/postgres?sslmode=disable'
make database-staging-smoke
# or:
./scripts/connected/staging_smoke.sh
```

The script refuses DSN strings that look like shared/cloud/production hosts.

## What it does **not** do

- Does not start a long-lived API process against shared infra
- Does not use production credentials or real tenant data
- Does not create Azure/Neon resources
- Does not print passwords or full secret-bearing DSNs in success output

## Expected result

```text
result=connected_staging_smoke_ok
```

Nonzero exit on any failure. Disposable database and smoke roles are dropped in
an `EXIT` trap.

## Offline journal note

The full Embedded SDK offline journal verify + HTTP evidence upload path is
covered by the private-alpha Go/Python E2E suites. This smoke focuses on the
database role boundary for Connected storage using synthetic, fully redacted
rows. Combine with `scripts/ci/private_alpha_ci.sh` harness stages when
exercising the HTTP API against a local runtime credential.
