.PHONY: run-recover-prove-local run-recover-prove-local-provision run-recover-prove-local-doctor run-recover-prove-local-migrate run-recover-prove-local-smoke igris-local-up igris-local-down igris-local-reset web-console-check test-policy-enforcement test-recovery-chaos test-runtime-callbacks test-runtime-failed-callbacks test-proof-tamper product-promise igris-doctor approval-loop-smoke approval-loop-smoke-console dogfood-migration-smoke dogfood-migration-smoke-console dogfood-routed-dev-smoke dogfood-routed-dev-smoke-console sdk-python-test sdk-python-release-check private-alpha-ci private-alpha-ci-migrations private-alpha-ci-python private-alpha-ci-go private-alpha-ci-postgres private-alpha-ci-artifacts private-alpha-ci-harness database-bootstrap-preflight database-bootstrap database-bootstrap-adopt-v066 database-roles-preflight database-roles database-staging-preflight database-staging-smoke database-staging-pg16-validate

product-promise:
	./scripts/product_promise_acceptance.sh

igris-doctor:
	./scripts/igris_doctor.sh

database-bootstrap-preflight:
	go run ./cmd/igris-db-bootstrap --mode=preflight

database-bootstrap:
	go run ./cmd/igris-db-bootstrap --mode=apply

database-bootstrap-adopt-v066:
	go run ./cmd/igris-db-bootstrap --mode=adopt-v066

database-roles-preflight:
	go run ./cmd/igris-db-roles --mode=preflight

database-roles:
	go run ./cmd/igris-db-roles --mode=apply

database-staging-preflight:
	go run ./cmd/igris-db-staging-preflight

database-staging-smoke:
	./scripts/connected/staging_smoke.sh

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

# Durable human-approval loop, end to end against the local stack:
# starter pack -> MCP call_action demo.needs_approval -> approval_required ->
# safe review fields -> reject never dispatches -> approve dispatches once ->
# completion + signed receipt. Run `make igris-local-up` first.
approval-loop-smoke:
	./scripts/approval_loop_smoke.sh

# Same loop plus the Rails console approval panel render check (needs Ruby).
approval-loop-smoke-console:
	./scripts/approval_loop_smoke.sh --with-console

# Internal dogfood workflow: controlled staging migration. Plan -> Human-gated
# approval -> gateway apply -> audit row + signed receipt; tamper + reject +
# double-approve guards included. See DOGFOOD_STAGING_MIGRATION_2026-07-03.md.
# Run `make igris-local-up` first.
dogfood-migration-smoke:
	./scripts/dogfood_migration_approval_smoke.sh

dogfood-migration-smoke-console:
	./scripts/dogfood_migration_approval_smoke.sh --with-console

# Internal dogfood workflow: route local development actions through Igris.
# run_tests is fixed and safe; push_branch/open_pr require approval and default
# to dry-run. Run `make igris-local-up` first.
dogfood-routed-dev-smoke:
	./scripts/dogfood_routed_dev_smoke.sh

dogfood-routed-dev-smoke-console:
	./scripts/dogfood_routed_dev_smoke.sh --with-console

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

sdk-python-test:
	cd sdk/python && uv sync --dev && uv run pytest && uv run ruff check . && uv run ruff format --check .

sdk-python-release-check:
	cd sdk/python && uv sync --dev && uv run pytest && uv run ruff check . && uv run ruff format --check . && uv build

# Local mirror of .github/workflows/private-alpha-ci.yml (docs/ci/private-alpha-ci.md).
# Stages: migrations, python (3.10-3.13 matrix), go, postgres (disposable DB),
# artifacts (reproducible wheel/sdist), harness (Embedded private alpha).
private-alpha-ci:
	./scripts/ci/private_alpha_ci.sh all

private-alpha-ci-migrations:
	./scripts/ci/private_alpha_ci.sh migrations

private-alpha-ci-python:
	./scripts/ci/private_alpha_ci.sh python

private-alpha-ci-go:
	./scripts/ci/private_alpha_ci.sh go

private-alpha-ci-postgres:
	./scripts/ci/private_alpha_ci.sh postgres

private-alpha-ci-artifacts:
	./scripts/ci/private_alpha_ci.sh artifacts

private-alpha-ci-harness:
	./scripts/ci/private_alpha_ci.sh harness


database-staging-pg16-validate:
	./scripts/connected/pg16_local_validate.sh
