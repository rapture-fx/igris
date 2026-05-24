# Run, Recover, Prove Locally

This runbook demonstrates the core Igris promise on a developer machine:

1. run a deterministic local `action_task`,
2. prove signed runtime callback enforcement,
3. show live irreversible recovery blocking when local Postgres is available,
4. verify proof where signed runtime artifacts exist.

The main entrypoint is:

```bash
make run-recover-prove-local
```

The script fails loudly when local prerequisites are missing. It does not fake
proof and does not enable unsigned runtime callback compatibility.

## Prerequisites

- Go, Cargo/Rust, Node, curl, lsof, and psql on PATH.
- A local Postgres database with the Overture migrations applied.
- `DATABASE_URL` or `POSTGRES_URL` pointing at that database, or a `.env` file
  containing one of those values.
- Ports `8080`, `8081`, `18090`, and `18091` available.

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
make run-recover-prove-local
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

## Console

When validating real backend evidence, disable console mock fallback. Use the
local backend URLs printed by the script and inspect:

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
