.PHONY: run-recover-prove-local run-recover-prove-local-smoke test-policy-enforcement test-recovery-chaos test-runtime-callbacks test-runtime-failed-callbacks test-proof-tamper

run-recover-prove-local:
	./scripts/run-recover-prove-local.sh

run-recover-prove-local-smoke:
	IGRIS_LOCAL_PROMISE_SKIP_LIVE=true ./scripts/run-recover-prove-local.sh --skip-live

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
