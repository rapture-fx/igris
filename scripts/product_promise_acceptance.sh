#!/usr/bin/env bash
# Product-promise acceptance suite.
#
# Proves the marketed Igris journey end-to-end with local, hermetic tests:
# agents call registered actions; Igris handles policy, tenant scoping,
# idempotency, runtime dispatch, recovery, proof/receipts, and operator
# inspection. Each stage below maps to one promise in
# ops/launch/product_promise_acceptance.md.
#
# No production services, no production credentials, no secrets. Every Go
# stage runs against the in-package fake DB driver and fake runtime
# transport; the Rails stage runs the console suite in test mode.
#
# Optional env toggles (names only, no values are secrets):
#   IGRIS_PROMISE_SKIP_RAILS=1    skip the Rails console alignment stage
#   IGRIS_PROMISE_SKIP_RUNTIME=1  skip the Rust runtime crate stage
#   GOCACHE                       overrides the Go build cache location
#
# Usage: ./scripts/product_promise_acceptance.sh   (or: make product-promise)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export GOCACHE="${GOCACHE:-/tmp/igris-product-promise-gocache}"

PASS_COUNT=0
SKIP_COUNT=0
declare -a STAGE_RESULTS=()

log()  { printf '%s\n' "$*"; }
bar()  { printf '────────────────────────────────────────────────────────\n'; }

fail_stage() {
  local stage="$1" reason="$2"
  bar
  log "FAIL  ${stage}: ${reason}"
  log "Product promise NOT proven. Fix the failing stage before shipping."
  exit 1
}

# run_go_stage <stage-name> <run-regex> <pkg> [pkg...]
# Fails if any selected test fails OR if the regex selects zero tests
# (so a renamed test cannot silently hollow out a promise).
run_go_stage() {
  local stage="$1" regex="$2"
  shift 2
  bar
  log "STAGE ${stage}"
  local out rc=0
  out="$(go test "$@" -run "$regex" -count=1 -timeout=300s -v 2>&1)" || rc=$?
  if [ "$rc" -ne 0 ]; then
    printf '%s\n' "$out" | grep -E '^(--- FAIL|FAIL|panic:|\s+.*_test\.go:)' | head -40 || printf '%s\n' "$out" | tail -40
    fail_stage "$stage" "go test exited with status $rc"
  fi
  local ran
  ran="$(printf '%s\n' "$out" | grep -c -- '--- PASS' || true)"
  if [ "$ran" -lt 1 ]; then
    fail_stage "$stage" "test selector matched no tests — promise coverage drifted (regex: $regex)"
  fi
  log "PASS  ${stage} (${ran} passing checks)"
  STAGE_RESULTS+=("PASS  ${stage}")
  PASS_COUNT=$((PASS_COUNT + 1))
}

skip_stage() {
  local stage="$1" reason="$2"
  bar
  log "SKIP  ${stage}: ${reason}"
  STAGE_RESULTS+=("SKIP  ${stage} (${reason})")
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

API_PKG="./igris-overture/api"
COORD_PKG="./igris-overture/coordinator"

# 1. Registered action happy path: create + run through REST returns a
#    durable run id, redacted input summary, proof status, and is
#    tenant-scoped end to end.
run_go_stage "rest-registered-action-happy-path" \
  'TestHandleActionRun(RegisteredActionDispatchesToFakeRuntime|UsesRegisteredActionDefinition|RequiresRegisteredAction|DoesNotRevealCrossTenantActionID|IgnoresBodyTenantOverride|RejectsRawTaskPayloadWithoutRegisteredAction)|TestHandleActionCreate(PersistsDefinition|DoesNotPersistRawSensitiveInputMetadata)|TestHandleActionGetIsTenantScoped|TestBuildActionRunResponseDoesNotExposeRawProofOrSecrets' \
  "$API_PKG"

# 2. Idempotent replay: same key returns the same run, never a duplicate
#    dispatch — proven on both the REST and MCP surfaces, plus cross-tenant
#    key isolation.
run_go_stage "idempotent-replay-no-duplicate-work" \
  'TestProductPromiseRESTIdempotentReplay|TestMCPCallAction(IdempotentReplay|SameTenantIdempotency|CrossTenantSameIdempotencyKey|CrossTenantReplay)' \
  "$API_PKG"

# 3. MCP gateway: tools/list schema, call_action rides the registered-action
#    path, and raw execution material (tenant_id, task_definition,
#    runtime_endpoint, runtime_id, ciphertext, nonce, ...) is rejected
#    before any handler runs.
run_go_stage "mcp-call-action-gateway" \
  'TestMCPToolsListReturnsStrictSchemas|TestMCPCallAction(UsesExistingActionRunPath|RegisteredActionDispatchesToFakeRuntime|RawTaskPayloadDoesNotDispatch|UnknownActionDoesNotDispatch|CrossTenantActionDoesNotDispatch)|TestMCPStrictValidationRejectsInvalidParamsBeforeHandlers|TestProductPromiseMCPCallActionRejectsRawExecutionOverrideFields|TestMCPListActionsIsTenantScoped|TestMCPGetActionRedactsUnsafeFields' \
  "$API_PKG"

# 4. Safe inspection: get_run / get_run_evidence / list_runs return
#    metadata only — no raw bodies, ciphertext, nonces, key material,
#    hostnames, or historical checkpoint payloads.
run_go_stage "run-and-evidence-output-is-metadata-safe" \
  'TestMCPGetRun|TestMCPListRuns|TestMCPSafeRunResponsesDoNotExposeHistoricalCheckpointPayloads|TestMCPListRuntimesDoesNotLeak|TestBuildTaskResponseRedactsHistoricalUnsafeTaskDefinitionInputs' \
  "$API_PKG"

# 5. runtime_unavailable: a local_runtime action with no healthy routable
#    runtime is refused explicitly — never silently accepted.
run_go_stage "runtime-unavailable-is-explicit" \
  'TestHandleActionRunLocalRuntimeFailsSafelyWithNoRoutableRuntime|TestMCPListRuntimesDoesNotMarkEndpointlessRuntimeRoutable' \
  "$API_PKG"

# 6. Dispatch + signed callbacks: Overture dispatches to the runtime
#    endpoint; unsigned/bad/replayed callbacks are rejected and persisted as
#    violations; valid signed callbacks checkpoint/complete/fail the run.
run_go_stage "runtime-dispatch-and-signed-callbacks" \
  'TestHandleActionRunRegisteredActionDispatchesToFakeRuntime|TestRuntimeCallbackEnvelopeRejectionPathsPersistViolations|TestHandleTask(Checkpoint|Complete|Failed)(ReturnsLifecycleMetadata|ReturnsRecoveryMetadata|Rejects)|TestRuntimeCallbackNonceReplayStillBlocksBeforeCleanup' \
  "$API_PKG"

# 7. Failure + recovery visibility: failed runs are inspectable with safe,
#    useful reasons; recovery state is surfaced; irreversible work is never
#    blindly replayed and approval gates hold.
run_go_stage "failure-and-recovery-visibility" \
  'TestHandleGetTaskReturns|TestHandleListTasksIncludes|TestBuildTaskResponseIncludesFailureReasonAndCheckpointMetadata|TestBuildTaskFailureDetailsResponse|TestNormalizeActionDefinitionRejectsIrreversibleFallbackByDefault|TestEvaluateActionPolicy(BlocksIrreversibleRecoveryReplay|RequiresApprovalBeforeExecution)|TestRuntimeFailedRecoveryDecisionBlocksIrreversibleReplay' \
  "$API_PKG" "$COORD_PKG"

# 8. Rails console alignment: the operator console renders actions, runs,
#    runtimes, and proof/receipt/evidence metadata from the same API truth,
#    without echoing secrets or raw payload bodies.
#    /home is onboarding; /overview is workspace — use
#    test/support/console_page_assertions.rb when asserting page content.
if [ "${IGRIS_PROMISE_SKIP_RAILS:-0}" = "1" ]; then
  skip_stage "rails-console-alignment" "IGRIS_PROMISE_SKIP_RAILS=1"
elif ! command -v rbenv >/dev/null 2>&1; then
  skip_stage "rails-console-alignment" "rbenv not found — run manually: cd web/apps/rails-console && RBENV_VERSION=3.2.2 rbenv exec bundle exec rails test"
else
  bar
  log "STAGE rails-console-alignment"
  if (cd web/apps/rails-console && RBENV_VERSION=3.2.2 rbenv exec bundle exec rails test); then
    log "PASS  rails-console-alignment"
    STAGE_RESULTS+=("PASS  rails-console-alignment")
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    fail_stage "rails-console-alignment" "rails test suite failed"
  fi
fi

# 9. Runtime crates: the local execution/WAL layer the dispatch path relies
#    on stays green.
if [ "${IGRIS_PROMISE_SKIP_RUNTIME:-0}" = "1" ]; then
  skip_stage "runtime-crates" "IGRIS_PROMISE_SKIP_RUNTIME=1"
elif ! command -v cargo >/dev/null 2>&1; then
  skip_stage "runtime-crates" "cargo not found — run manually: cargo test --manifest-path igris-runtime/Cargo.toml -p igris-tools -p igris-wal --lib"
else
  bar
  log "STAGE runtime-crates"
  if cargo test --manifest-path igris-runtime/Cargo.toml -p igris-tools -p igris-wal --lib; then
    log "PASS  runtime-crates"
    STAGE_RESULTS+=("PASS  runtime-crates")
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    fail_stage "runtime-crates" "cargo tests failed"
  fi
fi

bar
log "Product promise acceptance summary"
for line in "${STAGE_RESULTS[@]}"; do
  log "  $line"
done
log ""
log "Stages passed: ${PASS_COUNT}  skipped: ${SKIP_COUNT}"
log ""
log "Still manual (requires a disposable tenant + live environment):"
log "  - the first-external-user dry run: ops/launch/first_external_user_dry_run.md"
log "  - production Neon schema attestation (read-only scripts, run outside this suite)"
log ""
if [ "$SKIP_COUNT" -gt 0 ]; then
  log "NOTE: ${SKIP_COUNT} stage(s) skipped — the promise is only fully proven when every stage runs."
fi
log "All executed stages passed."
