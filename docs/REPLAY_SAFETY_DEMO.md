# Replay Safety Demo

This demo explains why Igris blocks automatic replay for irreversible or non-replayable work.

## Problem

An AI action may fail after a side effect has already happened. For example, a task can write to an external system, send a command, or commit a step, then fail before the whole workflow finishes.

Blindly retrying that action can be dangerous because the side effect may run twice. Igris treats that as a recovery decision, not a normal retry.

## Scenario

The local proof loop includes a deterministic failure path. The runtime is configured for an opt-in demo failure, sends a signed failed callback, and Overture records a conservative recovery decision:

```text
action requested
  -> policy decision
  -> runtime boundary recorded
  -> checkpoint / committed step
  -> signed failed callback accepted
  -> recovery decision
  -> automatic_replay_blocked
  -> replay_allowed=false
  -> proof and receipt state inspected
```

In normal language: the system saw that work had reached a point where automatic replay could duplicate an irreversible action, so it recorded the failure and blocked automatic replay. An operator can inspect the task, policy, recovery event, runtime boundary, and receipt/proof status before deciding what to do next.

## Run It

Use the validated local path:

```bash
make run-recover-prove-local-provision
```

The command provisions or reuses local Postgres, runs migrations, starts Overture and one local runtime, registers the runtime key, runs the successful action path, then runs the deterministic failed-callback and recovery-blocking path. It does not pass `--skip-live`.

`--skip-live` is not a product demo. It is useful for route tests and fallback checks when local Postgres or live services are unavailable, but it does not start the live Overture/runtime/Postgres proof loop.

## Expected Output

A successful live run includes these lines or equivalents:

```text
live action path:              real
signed callback mode:          live-server-backed
failure/recovery mode:         live-server-backed
receipt verify HTTP status:    200
task verify HTTP status:       200
```

The run also prints IDs and URLs similar to:

```text
task_id:                       REDACTED_SUCCESS_TASK_ID
failure task_id:               REDACTED_FAILURE_TASK_ID
runtime_id:                    REDACTED_RUNTIME_ID
execution_id:                  REDACTED_EXECUTION_ID
recovery event URL:            http://127.0.0.1:8081/v1/execution/governance/recovery-events?task_id=REDACTED_FAILURE_TASK_ID
task API:                      http://127.0.0.1:8081/v1/tasks/REDACTED_SUCCESS_TASK_ID
run API:                       http://127.0.0.1:8081/v1/execution/runs/REDACTED_EXECUTION_ID
receipts API:                  http://127.0.0.1:8081/proof/receipts
violations API:                http://127.0.0.1:8081/v1/execution/governance/boundary-violations
```

Do not paste raw environment values, raw database URLs, private keys, tokens, or raw callback bodies into shared transcripts.

## What Is Live-Server-Backed

In the full local proof loop:

- Overture runs on `127.0.0.1:8081`.
- The Rust runtime runs on `127.0.0.1:8080`.
- The runtime registers an Ed25519 public key.
- Checkpoint, complete, and failed callbacks are sent to Overture and signed by the runtime.
- Overture validates callback envelope identity, timestamp, body digest, signature, and nonce replay protection.
- The irreversible recovery-blocking event is persisted by Overture.
- Receipt verification and task proof verification return HTTP `200`.

When `--skip-live` is used, callback enforcement, recovery blocking, signer behavior, and proof tamper behavior are test-backed checks. They are useful, but they are not the same as the live product path.

## What To Inspect

Use the URLs printed by the run.

API checks:

- `GET /v1/tasks/:task_id`
- `GET /v1/tasks/:failure_task_id`
- `GET /v1/execution/runs/:execution_id`
- `GET /proof/receipts`
- `POST /proof/receipts/verify`
- `POST /v1/tasks/:task_id/proof/verify`
- `GET /v1/execution/governance/recovery-events?task_id=:failure_task_id`
- `GET /v1/execution/governance/boundary-violations`

Console checks, when a console URL is printed:

- Success task detail shows policy, runtime boundary, checkpoint/completion, and proof state.
- Failure task detail shows failed status and recovery event details.
- Recovery event includes `event_type=automatic_replay_blocked` and `replay_allowed=false`.
- Proof view shows receipt status and verification fields.
- Violations/governance views show rejected callback evidence when replay or callback validation tests have persisted violations.

For real backend inspection, disable console mock fallback:

```bash
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
NEXT_PUBLIC_API_URL=http://127.0.0.1:8081
```

## Why This Matters

Irreversible/non-replayable means Igris should not automatically run the action again just because a process failed. The system records what it knows, blocks automatic replay, and leaves an inspectable recovery decision. That is the safety behavior this demo is meant to make concrete.

