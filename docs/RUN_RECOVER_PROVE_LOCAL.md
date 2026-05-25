# Run, Recover, Prove Locally

This runbook demonstrates the core Igris promise on a developer machine:

1. run a deterministic local `action_task`,
2. prove signed runtime callback enforcement,
3. show live irreversible recovery blocking when local Postgres is available,
4. verify proof where signed runtime artifacts exist.

## Quick Start

Recommended local path for a first-time developer:

```bash
make run-recover-prove-local-provision
```

This provisions or reuses local Postgres, applies Overture migrations, runs the
doctor, then executes the full live demo. On macOS it works with Homebrew
Postgres; if Docker is installed it can use Docker Compose; and if you already
have Postgres, it reuses `DATABASE_URL` or `POSTGRES_URL`. It does not pass
`--skip-live`.

Expected successful output includes:

- successful task ID,
- failure task ID,
- runtime ID,
- execution ID,
- receipt and task proof verification HTTP status `200`,
- proof and recovery URLs,
- path to a redacted evidence summary JSON.

For the receipt/proof model, read
[Receipt and Proof Spec v0.1](./specs/IGRIS_RECEIPT_PROOF_SPEC_V0_1.md). For
the recovery-blocking scenario in plain language, read
[Replay Safety Demo](./REPLAY_SAFETY_DEMO.md). For cold external testing, use
[External Tester Checklist](./EXTERNAL_TESTER_CHECKLIST.md).

If Postgres is already prepared, the direct live entrypoint remains:

```bash
make run-recover-prove-local
```

Use these focused helpers when debugging setup:

```bash
make igris-local-up
make run-recover-prove-local-doctor
make run-recover-prove-local-migrate
```

The script fails loudly when local prerequisites are missing. It does not fake
proof and does not enable unsigned runtime callback compatibility.

## One-Command Local Setup

- Go, Cargo/Rust, Node, curl, lsof, and psql on PATH.
- Local Postgres through Homebrew, Docker Compose, or an existing
  `DATABASE_URL`/`POSTGRES_URL`.
- Ports `8080`, `8081`, `18090`, and `18091` available.

Recommended local run:

```bash
make run-recover-prove-local-provision
```

The provisioning command reuses an explicitly configured `DATABASE_URL` or
`POSTGRES_URL` first. Otherwise it uses Docker Compose when available, or
Homebrew Postgres on macOS. It writes a local-only
`.env.run-recover-prove-local` file for provisioned local databases and that
file is ignored by git. The command prints only host, port, database, auth
presence, and sslmode; it does not print the raw DSN or password.

## Homebrew Postgres

Homebrew Postgres is the primary validated macOS path. The helper tries a
compatible installation (`postgresql@16`, then older compatible formulas),
starts it with `brew services start` when available, creates `igris_overture`
only if missing, and writes a passwordless local user DSN to
`.env.run-recover-prove-local`.

```bash
brew install postgresql@16
make run-recover-prove-local-provision
```

This path has completed the full live Run / Recover / Prove demo without
`--skip-live`, with live-server-backed signed callbacks, live-server-backed
failure/recovery evidence, and both verification endpoints returning HTTP `200`.

## Manual Postgres

Manual Postgres is also supported. Set `DATABASE_URL` or `POSTGRES_URL` in the
current shell, or provide it through `.env`, then run:

```bash
make run-recover-prove-local-provision
```

The scripts reuse the provided database and still redact connection details.

## Optional Docker

Docker remains supported as an optional reproducible setup for contributors who
already have Docker installed. It is not required for the main local proof loop.

Docker lifecycle:

```bash
make igris-local-up       # start/provision Postgres, migrate, doctor
make igris-local-down     # stop Docker services, keep database volume
make igris-local-reset    # explicit destructive reset of Docker DB volume
```

`igris-local-reset` is the only local helper that deletes Docker-managed
Postgres data. It also removes `.env.run-recover-prove-local` so the next run
generates a fresh local password.

The migration helper uses `igris-overture/database/migrations`, not the older
top-level migration directory. It applies the live-demo required Overture
migrations on clean and existing local schemas, including runtime registry,
BetterAuth baseline tables, task records, proof state, recovery governance, and
signed callback nonce tables. It intentionally avoids unrelated legacy product
migrations that are not needed to prove the Run/Recover/Prove loop.

The flow starts Overture on `127.0.0.1:8081`, starts one Rust runtime on
`127.0.0.1:8080`, registers the runtime Ed25519 public key, submits a
local action workflow, verifies the resulting receipt, then submits a controlled
demo failure task that is classified irreversible/non-replayable.

## Strict Callback Mode

The local promise flow requires signed runtime callback envelopes. It refuses to
run if `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` is enabled, then exports it as
`false` for child commands.

The signed callback demonstration is live-server-backed when the live path runs.
Overture passes an explicit callback base URL and auth header to the runtime
during local dispatch. The runtime signs checkpoint, complete, and failed
callback bodies with its Ed25519 identity and sends them to Overture with
`X-Igris-Callback-Envelope`. The runtime also writes a redacted local JSONL
evidence file containing callback type, task ID, runtime ID, body digest, HTTP
status, and accepted flag.

When `--skip-live` is used, callback enforcement is fallback-test-backed. The
tests exercise the real coordinator routes and prove that missing, malformed,
stale, replayed, body-tampered, wrong-runtime, missing-key, and terminal-state
callbacks are rejected and persisted as safe violation evidence.

## Commands

```bash
make run-recover-prove-local-provision
make igris-local-up
make igris-local-down
make igris-local-reset
make run-recover-prove-local
make run-recover-prove-local-doctor
make run-recover-prove-local-migrate
make run-recover-prove-local-smoke
make test-policy-enforcement
make test-recovery-chaos
make test-runtime-callbacks
make test-runtime-failed-callbacks
make test-proof-tamper
```

For environments without local Postgres, the trust-boundary checks can be run
without the live action path:

```bash
./scripts/run-recover-prove-local.sh --skip-live
```

`--skip-live` is not a full product demonstration. It only runs callback,
recovery-blocking, runtime signer, and proof tamper checks.

## Output

On success, the script prints:

- task ID,
- runtime ID,
- execution ID,
- receipt verification HTTP status,
- task proof verification HTTP status,
- failure task ID,
- failed callback evidence path,
- recovery event URL,
- task API URL,
- execution run API URL,
- receipt/proof API URL,
- boundary violation API URL,
- console task/proof/violation URLs when `CONSOLE_URL` or `--console-base-url`
  is set,
- path to redacted evidence summary JSON.

The redacted summary excludes private keys, raw API keys, session tokens,
credentials, raw callback bodies, and raw environment values.

Validation status:

- macOS/Homebrew Postgres completed the full live demo on 2026-05-24 and is the
  primary validated local onboarding path.
- Docker validation is optional and still pending on this workstation because
  neither `docker` nor `docker-compose` is installed here. Do not claim the
  Docker path is validated until `make run-recover-prove-local-provision`
  completes on a Docker-enabled machine without `--skip-live`.

Sanitized Homebrew fallback live output from 2026-05-24:

```text
live action path:              real
task_id:                       b9f812df-f1c3-4990-a991-eb05dae1b235
runtime_id:                    ed5cc5b1-efc0-4e98-ae8f-9411889719e2
execution_id:                  019e5924-8ade-7c70-b58f-1a115d3d92d8
signed callback mode:          live-server-backed
failure/recovery mode:         live-server-backed
failure task_id:               ce6ebb94-044d-48f2-905c-6a48d3ecb04b
receipt verify HTTP status:    200
task verify HTTP status:       200
recovery event URL:            http://127.0.0.1:8081/v1/execution/governance/recovery-events?task_id=ce6ebb94-044d-48f2-905c-6a48d3ecb04b
task API:                      http://127.0.0.1:8081/v1/tasks/b9f812df-f1c3-4990-a991-eb05dae1b235
run API:                       http://127.0.0.1:8081/v1/execution/runs/019e5924-8ade-7c70-b58f-1a115d3d92d8
receipts API:                  http://127.0.0.1:8081/proof/receipts
violations API:                http://127.0.0.1:8081/v1/execution/governance/boundary-violations
console task:                  http://127.0.0.1:3000/execution/tasks/b9f812df-f1c3-4990-a991-eb05dae1b235
console failure task:          http://127.0.0.1:3000/execution/tasks/ce6ebb94-044d-48f2-905c-6a48d3ecb04b
console proof:                 http://127.0.0.1:3000/proof/receipts
console violations:            http://127.0.0.1:3000/proof/violations
```

Optional Docker validation output has the same shape, with the provisioning
helper also printing when Docker is the path used:

```text
[local-db] provisioning Postgres with Docker Compose
[local-db] Docker Postgres is ready
[local-db] provisioning path used: Docker
```

## Console

When validating real backend evidence, disable console mock fallback. Use the
local backend URLs printed by the script and inspect:

```bash
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
NEXT_PUBLIC_API_URL=http://127.0.0.1:8081
```

- `/execution/tasks/:task_id`
- `/execution/tasks/:failure_task_id`
- `/execution/runs/:execution_id`
- `/proof/receipts`
- `/proof/violations`

Missing proof must be treated as unavailable, not verified.

The Overview page's Execution Trust Summary includes `Rejected runtime
callbacks`. The violations page labels rejected callback evidence as replay
attempt, stale callback, body mismatch, wrong runtime, or rejected callback
based on the persisted rejection reason.

## What Is Demonstrated

Production-ready locally:

- Runtime key registration through the existing runtime registration endpoint.
- Durable task submission for a deterministic local `action_task`.
- Runtime boundary and policy evidence for the task path.
- Live signed runtime-to-coordinator callbacks for checkpoint and complete in
  the Action Task V1 path when local Postgres is available.
- Live signed failed callback in the local deterministic failure scenario when
  local Postgres is available.
- Live irreversible/non-replayable recovery blocking from the failed task's
  recorded action policy. The task detail and recovery governance endpoints show
  `automatic_replay_blocked` with replay disabled and reason
  `irreversible action cannot be automatically replayed during recovery`.
- Signed receipt verification with a registered runtime key.
- Strict signed callback validation in coordinator routes.
- Rejected callback violation persistence.
- Rejected callback counts in the governance summary, sourced from persisted
  `boundary_violations` evidence.
- Runtime callback nonce cleanup. Accepted callback nonces are retained for at
  least the callback freshness window; the application default is 24 hours.
- Irreversible/non-replayable recovery policy blocking.
- Demo-only deterministic runtime failure. It is opt-in and requires
  `IGRIS_ENABLE_LOCAL_DEMO_FAILURE=true`; normal runtime tasks ignore
  `local_demo_failure`.
- Proof tamper and missing-key behavior through route tests.

Experimental or not fully live in this script:

- The runtime still returns the synchronous submit response so Overture can
  persist execution artifacts and receipts in the existing durable path. Live
  callbacks now mutate lifecycle state; the synchronous response remains the
  artifact carriage path for compatibility.
- Broad multi-runtime portability.
- OS/container-level boundary enforcement beyond runtime-supported controls.
- `--skip-live` remains fallback-test-backed for failed callbacks and recovery
  blocking because it does not start Overture, Runtime, or Postgres.

## Failure Behavior

The script exits non-zero if:

- Postgres is unavailable for the live path,
- runtime key registration fails,
- signed receipt verification does not return HTTP 200,
- strict signed callback tests fail,
- live failure/recovery evidence is missing when Postgres is available,
- irreversible recovery-blocking tests fail,
- proof tamper tests fail,
- any required command is missing.

## Troubleshooting

Postgres missing or unreachable:

```bash
make igris-local-up
pg_isready -h localhost -p 5432
make run-recover-prove-local-doctor
```

The doctor prints a sanitized database summary with host, port, database, auth
presence, and sslmode. It does not print passwords or raw DSNs.

Docker unavailable:

```bash
docker compose version
docker info
```

Start Docker Desktop or install Docker Engine with Compose, then rerun
`make run-recover-prove-local-provision`. On macOS without Docker, install
Homebrew Postgres with `brew install postgresql@16` and rerun the same command.

Homebrew Postgres unavailable:

```bash
brew install postgresql@16
brew services start postgresql@16
make run-recover-prove-local-provision
```

Migrations missing:

```bash
make run-recover-prove-local-migrate
make run-recover-prove-local-doctor
```

Required live-demo schema includes `task_records`, `wal_checkpoints`,
`execution_context`, `execution_lineage`, `runtime_instances`,
`action_policy_decisions`, `task_recovery_events`, `execution_boundaries`,
`boundary_violations`, and `runtime_callback_nonces`.

Ports in use:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
lsof -nP -iTCP:18090 -sTCP:LISTEN
lsof -nP -iTCP:18091 -sTCP:LISTEN
```

Runtime key registration failure means Overture started but did not accept the
generated runtime identity. Check the live run's `overture.log` and
`runtime-register-response.json` under the printed artifacts directory.

Missing callback evidence means the runtime did not write accepted signed
checkpoint, complete, and failed callback rows to the printed JSONL file. Keep
`IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` unset or false; unsigned compatibility
is intentionally rejected by this flow.

Proof verification is honest. It is verified only when signed runtime artifacts
and a registered runtime key exist. If either is missing, proof must be treated
as unavailable or unverifiable, not as verified.

Frontend console checks:

```bash
make web-console-check
```

Run the build before `tsc --noEmit` because the console TypeScript config
includes Next-generated `.next/types/**/*.ts` files. Running `tsc --noEmit` on a
clean tree before `next build` can fail only because those generated files do
not exist yet.
