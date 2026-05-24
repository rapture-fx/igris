# Developer Onboarding Promise Gap

Date: 2026-05-24

## Goal

A developer should be able to run one AI action, inspect the execution story, simulate failure or safe recovery blocking, and inspect proof state in about 10 minutes.

## Current State

The repository now has a one-command local promise entrypoint:
`make run-recover-prove-local-provision`. It provisions or reuses local
Postgres, applies Overture migrations, runs the doctor, then calls
`make run-recover-prove-local`. The live demo wraps the Action Task V1 proof
demo, sends live signed checkpoint/complete callbacks, then runs a deterministic
live failed-callback and irreversible recovery-blocking scenario. It still runs
strict callback rejection, runtime signer, recovery, and proof tamper checks.

On 2026-05-24 the full live path completed against local Postgres, without
`--skip-live`, after applying the additive recovery/callback migrations through
`make run-recover-prove-local-migrate`.

Validated evidence:

- successful task ID: `b9f812df-f1c3-4990-a991-eb05dae1b235`
- failure task ID: `ce6ebb94-044d-48f2-905c-6a48d3ecb04b`
- runtime ID: `ed5cc5b1-efc0-4e98-ae8f-9411889719e2`
- execution ID: `019e5924-8ade-7c70-b58f-1a115d3d92d8`
- receipt verify HTTP status: `200`
- task proof verify HTTP status: `200`
- signed callback mode: `live-server-backed`
- failure/recovery mode: `live-server-backed`

Docker status: optional, not a gate for local onboarding. On this machine,
`docker`, `docker compose`, and `docker-compose` are unavailable, so the
Docker-backed proof loop has not honestly completed. The validated local
onboarding path is Homebrew/manual Postgres; Docker should be validated later on
a Docker-enabled machine as a convenience path.

## Gaps

- There is no live `make test-runtime-handoff` target yet; handoff blocking is covered inside `make test-recovery-chaos`.
- The durable task proof path requires a registered runtime public key and signed runtime artifacts; `make run-recover-prove-local` now handles this for the local Action Task V1 path.
- The console can display the story, but local developers need explicit instructions to disable mock fallback when validating real backend evidence.
- Runtime callback identity hardening now exists in the coordinator and Rust runtime sender. The live local flow demonstrates accepted signed checkpoint, complete, and failed callbacks; `--skip-live` still falls back to route tests.
- The local setup path now provisions or reuses local Postgres, with
  Homebrew/manual Postgres as the validated macOS path and optional Docker
  support for contributors who already have Docker installed.
- Console typechecking should use `make web-console-check`, which runs the Next
  build before `tsc --noEmit` so generated `.next/types` files exist.

## Equivalent Commands Today

Use these for focused checks:

```bash
make run-recover-prove-local
make run-recover-prove-local-provision
make igris-local-up
make igris-local-down
make igris-local-reset
make run-recover-prove-local-doctor
make run-recover-prove-local-migrate
make run-recover-prove-local-smoke
make test-policy-enforcement
make test-recovery-chaos
make test-runtime-callbacks
make test-runtime-failed-callbacks
make test-proof-tamper
```

## Recommended Onboarding Slice

Next slice: keep Homebrew/manual onboarding as the primary validated proof path,
then ask a second engineer or Docker-enabled machine to validate optional Docker
provisioning separately. After that, add alert thresholds for rejected callback
spikes and keep hardening console inspection around unavailable proof states.

The current local flow already:

1. Starts Overture and one local runtime with a generated Ed25519 runtime identity.
2. Registers the runtime key.
3. Demonstrates live signed checkpoint, complete, and failed callback envelopes when Postgres is available.
4. Submits the successful local `action_task`.
5. Prints task, run, receipt, and verification URLs.
6. Runs a live recovery-blocking irreversible action scenario and prints its task, recovery event, and console URLs.
7. Verifies the receipt and exports redacted evidence.
8. Shows rejected runtime callback counts and violation labels in the console
   when persisted rejection evidence exists.
9. Fails preflight before partial startup when Postgres, migrations, or ports
   are not ready.
10. Provisions or reuses local Postgres through an explicit DSN, Homebrew
    Postgres on macOS, or optional Docker Compose when available.
