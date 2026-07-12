# Private-Alpha CI — reproducible release verification on every PR

Workflow: `.github/workflows/private-alpha-ci.yml`
Local mirror: `make private-alpha-ci` (stages: `-migrations`, `-python`,
`-go`, `-postgres`, `-artifacts`, `-harness`).

This pipeline makes the private-alpha release candidate
(`release/igris-private-alpha-v0.1.0-alpha.1`) reproducible on every pull
request. It verifies; it never publishes, deploys, tags, or applies shared
migrations.

## Jobs

| Job | What it proves | Timeout |
| --- | --- | --- |
| `migration-guard` | Migrations 067/068/069 keep their manual-only wording; nothing outside tests/docs references them; no non-test Go code reads the migrations directory (`scripts/ci/check_manual_migrations.sh`) | 5 min |
| `python-matrix` | Full SDK suite + Ruff lint/format on real CPython 3.10, 3.11, 3.12, 3.13 | 20 min |
| `go-suites` | `go build ./...`, focused `go vet` on release-critical packages, canonical-JSON + ActionContract conformance, complete API suite (incl. route manifest/surface), coordinator suite | 30 min |
| `go-postgres` | Contract + evidence lifecycle, concurrency, idempotency, immutability, redirect-refusal, and cross-slice E2E suites against an ephemeral `postgres:16` service container | 30 min |
| `sdk-artifacts` | Wheel + sdist build twice with identical SHA-256, contents inspected, clean-venv wheel/sdist installs with import/guard/key-info/verify/evidence-help/pip-check smokes, machine-readable manifest (`scripts/ci/sdk_artifact_check.sh`) | 20 min |
| `alpha-harness` | `scripts/private-alpha/validate_embedded.sh` passes and produces exactly the expected five-event journal breakdown (`scripts/ci/run_alpha_harness.sh`) | 15 min |

## Interpreter correctness in the matrix

`sdk/python/.python-version` pins 3.11 for local development. uv honors that
file, so a naive matrix can silently run 3.11 in all four jobs. The matrix
therefore exports `UV_PYTHON=<matrix version>` (which overrides
`.python-version`) and every job **asserts** `sys.version_info[:2]` matches
the matrix entry before running a single test. The local mirror does the same
with per-version `UV_PROJECT_ENVIRONMENT` directories.

## Workflow security model

- Triggered by `pull_request` — **never** `pull_request_target`. Fork PRs get
  a read-only token and no access to repository secrets.
- Workflow-level `permissions: contents: read`; no job requests more.
- All actions pinned to immutable commit SHAs (tag noted in a comment).
- `actions/checkout` runs with `persist-credentials: false` everywhere.
- Concurrency group cancels superseded runs of the same ref (except `main`).
- Explicit `timeout-minutes` on every job.
- No PR-controlled metadata (title, branch name, body) is interpolated into
  any shell command.
- No production credentials, Azure secrets, or shared-database DSNs exist in
  this workflow. The only DSN points at the job-scoped ephemeral Postgres
  service container.
- The only uploaded artifacts are the SDK wheel/sdist and their manifest —
  inspected by the same job to contain no tests, signing keys, or journals —
  retained 14 days as private CI artifacts. Nothing is published to any
  package index.

## Migrations 067–069 stay manual

The contract/evidence tests apply migrations 054/067/068/069 themselves,
inside disposable schemas of the ephemeral test database (see
`igris-overture/api/routes_contracts_postgres_test.go`). The
`migration-guard` job fails the build if:

- any of the three migration files loses its "manual migration runbook" /
  "NOT applied" wording,
- a workflow, non-test Go file, or operational script starts referencing
  those migration filenames,
- any non-test Go source references `database/migrations` (startup
  auto-migration).

## Connected validation

The alpha harness runs **Embedded-only** (`validate_embedded.sh`). Connected
validation (`--connected`) requires a dedicated disposable backend and is
deliberately not wired into CI; it must never point at a shared environment
or use a real API key. The Connected surface is still covered — by the
`go-postgres` E2E jobs, which start a loopback Overture instance inside the
test process.

## Local mirror

```bash
make private-alpha-ci             # all stages
make private-alpha-ci-python      # matrix only (PA_CI_PY_VERSIONS to narrow)
make private-alpha-ci-postgres    # disposable DB on the local Postgres server
```

The `postgres` stage creates a uniquely named disposable database on the
local server (override host/port/user with `PA_CI_PG_HOST` / `PA_CI_PG_PORT`
/ `PA_CI_PG_USER`), runs the suites, and drops it. It never prints connection
strings and never touches shared databases.

## Known limitations

- GitHub-hosted execution of this workflow has not run until the branch is
  pushed; everything above is validated by running the underlying commands
  locally.
- `sdk/python` has no `uv.lock`, so dev-dependency resolution (pytest, ruff)
  floats within `pyproject.toml` constraints. Runtime dependency is
  `cryptography` only. Committing a lockfile is a possible follow-up owned by
  the SDK, not this pipeline.
- Repository-wide `go vet` has pre-existing defects (see the merge manifest
  §7); the workflow reports them in a non-blocking informational step rather
  than suppressing or fixing them here.
- The Postgres service container uses the `postgres:16` tag (matching
  `backend-postgres.yml`) rather than an image digest.

## Pre-existing workflow findings (recorded, not fixed here)

Observed at the release-candidate commit, in workflows owned by other tracks:

- No workflow uses `pull_request_target` (good).
- PR-triggered workflows (`sdk-python.yml`, `backend-postgres.yml`,
  `docs-quality.yml`, `proof-gate.yml`, `runtime-ci.yml`, `ros2-hil.yml`)
  declare no `permissions:` block, inheriting the repository default token.
- All actions are pinned to mutable tags (`@v4`, `@v5`), not commit SHAs.
- No PR workflow uses `concurrency` cancellation.
- `backend-postgres.yml`'s job has no `timeout-minutes`.
- Checkouts leave `persist-credentials` at its default (`true`).
- `sync-docs.yml` interpolates `secrets.DOCS_SYNC_TOKEN` into a `git clone`
  URL on the command line.
- `sdk-python.yml`'s matrix does not override `sdk/python/.python-version`
  and does not assert the active interpreter, so its four matrix jobs can
  all resolve to CPython 3.11. The new `python-matrix` job closes this gap.
