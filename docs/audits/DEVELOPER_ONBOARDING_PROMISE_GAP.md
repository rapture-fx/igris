# Developer Onboarding Promise Gap

Date: 2026-05-23

## Goal

A developer should be able to run one AI action, inspect the execution story, simulate failure or safe recovery blocking, and inspect proof state in about 10 minutes.

## Current State

The repository now has a single local promise entrypoint: `make run-recover-prove-local`. It wraps the live Action Task V1 proof demo, sends live signed runtime callbacks when Postgres is ready, then runs strict signed callback, irreversible recovery-blocking, runtime signer, and proof tamper checks.

## Gaps

- There is no live `make test-runtime-handoff` target yet; handoff blocking is covered inside `make test-recovery-chaos`.
- The durable task proof path requires a registered runtime public key and signed runtime artifacts; `make run-recover-prove-local` now handles this for the local Action Task V1 path.
- Failure simulation exists through tests and scripts, but not every canonical product scenario is live-server-backed from one command.
- The console can display the story, but local developers need explicit instructions to disable mock fallback when validating real backend evidence.
- Runtime callback identity hardening now exists in the coordinator and Rust runtime sender. The live local flow demonstrates accepted signed checkpoint/complete callbacks; `--skip-live` still falls back to route tests.

## Equivalent Commands Today

Use these for focused checks:

```bash
make run-recover-prove-local
make run-recover-prove-local-smoke
make test-policy-enforcement
make test-recovery-chaos
make test-runtime-callbacks
make test-proof-tamper
```

## Recommended Onboarding Slice

Next slice: make irreversible recovery blocking live-server-backed in the same local flow.

The current local flow already:

1. Starts Overture and one local runtime with a generated Ed25519 runtime identity.
2. Registers the runtime key.
3. Demonstrates live signed checkpoint and complete callback envelopes when Postgres is available.
4. Submits a read-only `action_task`.
5. Prints task, run, receipt, and verification URLs.
6. Runs a prepared recovery-blocking irreversible action scenario.
7. Verifies the receipt and exports redacted evidence.
