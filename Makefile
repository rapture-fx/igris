.PHONY: run-recover-prove-local run-recover-prove-local-provision run-recover-prove-local-doctor run-recover-prove-local-migrate run-recover-prove-local-smoke igris-local-up igris-local-down igris-local-reset web-console-check test-policy-enforcement test-recovery-chaos test-runtime-callbacks test-runtime-failed-callbacks test-proof-tamper

run-recover-prove-local:
	./scripts/run-recover-prove-local.sh

run-recover-prove-local-provision:
	./scripts/igris-local-provision.sh run

igris-local-up:
	./scripts/igris-local-provision.sh up

igris-local-down:
	./scripts/igris-local-provision.sh down

igris-local-reset:
	./scripts/igris-local-provision.sh reset

run-recover-prove-local-doctor:
	./scripts/run-recover-prove-local.sh --doctor

run-recover-prove-local-migrate:
	./scripts/run-recover-prove-local.sh --migrate

run-recover-prove-local-smoke:
	IGRIS_LOCAL_PROMISE_SKIP_LIVE=true ./scripts/run-recover-prove-local.sh --skip-live

web-console-check:
	pnpm --filter @igris-inertial/web-console build
	pnpm --filter @igris-inertial/web-console exec tsc --noEmit

test-policy-enforcement:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/coordinator ./igris-overture/api -run 'TestEvaluateActionPolicy|TestHandleTaskSubmit|TestBuildTaskSubmitRequest' -count=1 -timeout=180s

test-recovery-chaos:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/coordinator ./igris-overture/api -run 'Test.*Recovery|Test.*Handoff|TestHandleTask(Checkpoint|Complete|Failed)ReturnsTransitionRejectedPayload' -count=1 -timeout=180s

test-runtime-callbacks:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/api -run 'TestHandleTask(Checkpoint|Complete|Failed)|TestRuntimeCallbackEnvelope' -count=1 -timeout=180s
	cargo test --manifest-path igris-runtime/crates/igris-server/Cargo.toml runtime_callback --features agent-platform

test-runtime-failed-callbacks:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/api ./igris-overture/coordinator -run 'TestHandleTaskFailed|TestRuntimeCallbackEnvelope|TestRuntimeFailedRecoveryDecisionBlocksIrreversibleReplay' -count=1 -timeout=180s
	cargo test --manifest-path igris-runtime/crates/igris-server/Cargo.toml runtime_callback --features agent-platform
	cargo test --manifest-path igris-runtime/crates/igris-server/Cargo.toml local_demo_failure --features agent-platform

test-proof-tamper:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/api -run 'TestVerifyReceipt(StoredValuesAloneCannotMarkVerifiedTrue|ReturnsCleanlyWithoutRuntimeIdentity|ChainLinkRejects.*|ChainLinkVerifiesPriorReceipt|ChainLinkGenesisIsValid)' -count=1 -timeout=180s
