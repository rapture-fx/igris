.PHONY: run-recover-prove-local test-policy-enforcement test-recovery-chaos test-runtime-callbacks test-proof-tamper

run-recover-prove-local:
	./scripts/run-recover-prove-local.sh

test-policy-enforcement:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/coordinator ./igris-overture/api -run 'TestEvaluateActionPolicy|TestHandleTaskSubmit|TestBuildTaskSubmitRequest' -count=1 -timeout=180s

test-recovery-chaos:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/coordinator ./igris-overture/api -run 'Test.*Recovery|Test.*Handoff|TestHandleTask(Checkpoint|Complete|Failed)ReturnsTransitionRejectedPayload' -count=1 -timeout=180s

test-runtime-callbacks:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/api -run 'TestHandleTask(Checkpoint|Complete|Failed)|TestRuntimeCallbackEnvelope' -count=1 -timeout=180s
	cargo test --manifest-path igris-runtime/crates/igris-server/Cargo.toml runtime_callback --features agent-platform

test-proof-tamper:
	GOCACHE=/tmp/igris-gocache-local-promise go test ./igris-overture/api -run 'TestVerifyReceipt(StoredValuesAloneCannotMarkVerifiedTrue|ReturnsCleanlyWithoutRuntimeIdentity|ChainLinkRejects.*|ChainLinkVerifiesPriorReceipt|ChainLinkGenesisIsValid)' -count=1 -timeout=180s
