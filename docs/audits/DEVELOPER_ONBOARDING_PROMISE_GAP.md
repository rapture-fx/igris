# Developer Onboarding Promise Gap

Date: 2026-05-23

## Goal

A developer should be able to run one AI action, inspect the execution story, simulate failure or safe recovery blocking, and inspect proof state in about 10 minutes.

## Current State

The repository has useful demo scripts, durable task routes, runtime code, and console views. The pieces exist, but the local path is not yet a single reliable onboarding flow.

## Gaps

- No root `Makefile` target exists for `make test-recovery-chaos`, `make test-policy-enforcement`, or `make test-runtime-handoff`.
- The durable task proof path requires a registered runtime public key and signed runtime artifacts; the setup instructions do not yet make this a one-command happy path.
- Failure simulation exists through tests and scripts, but the canonical product scenarios are not all runnable from one documented command.
- The console can display the story, but local developers need explicit instructions to disable mock fallback when validating real backend evidence.
- Runtime callback identity hardening is partial; signed callback setup is not documented because it does not exist yet.

## Equivalent Commands Today

Use these until canonical make targets are added:

```bash
GOCACHE=/tmp/igris-gocache-promise go test ./igris-overture/coordinator ./igris-overture/api -count=1 -timeout=180s
pnpm --filter @igris-inertial/web-console exec tsc --noEmit
pnpm --filter @igris-inertial/web-console build
git diff --check
```

## Recommended Onboarding Slice

Add a single `scripts/run-recover-prove-local.sh` flow that:

1. Starts Overture and one local runtime with a generated Ed25519 runtime identity.
2. Registers the runtime key.
3. Submits a read-only `action_task`.
4. Prints task, run, receipt, and verification URLs.
5. Runs a prepared recovery-blocking irreversible action scenario.
6. Verifies the receipt and exports redacted evidence.
