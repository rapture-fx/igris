#!/usr/bin/env bash

# Igris Inertial — Core Run / Recover / Verify proof suite.
#
# Runs only the live proof scripts that prove the customer-facing core:
#
#   1. task_v1_proof_demo.sh     — Submit -> Execute -> signed Receipt -> Verify
#                                 (the canonical Task V1 golden path).
#   2. unified_execution_proof_demo.sh
#                                — Local control-plane -> Runtime unified
#                                 execution with signed envelope + receipt.
#   3. fallback_execution_proof_demo.sh
#                                — Runtime cloud-to-cloud provider fallback.
#   4. checkpoint_proof_demo.sh  — Same-host / shared-WAL checkpoint recovery.
#
# Each step is a separate process; failures abort the suite. Per-script
# artifact directories are left in $TMPDIR for inspection.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

# Build the Overture binary ONCE for the whole suite and share it (plus a
# persistent Go build cache) across all sub-proofs. Each proof otherwise rebuilds
# Overture from a cold cache (~60s x4) and leaves a ~400MB copy in its temp dir,
# which both slows the suite and fills the disk. Sub-proofs honor these env vars
# and reuse the prebuilt binary; run standalone they still build their own.
export IGRIS_PROOF_GOCACHE="${IGRIS_PROOF_GOCACHE:-$ROOT_DIR/.proof-cache/go}"
export IGRIS_PROOF_OVERTURE_BIN="${IGRIS_PROOF_OVERTURE_BIN:-$ROOT_DIR/.proof-cache/igris-overture}"
mkdir -p "$IGRIS_PROOF_GOCACHE" "$(dirname "$IGRIS_PROOF_OVERTURE_BIN")"
echo "[suite] Building Overture once for the suite (shared by all proofs)..."
rm -f "$IGRIS_PROOF_OVERTURE_BIN"   # force one fresh build per suite invocation
(
  cd "$ROOT_DIR"
  GOCACHE="$IGRIS_PROOF_GOCACHE" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
    go build -o "$IGRIS_PROOF_OVERTURE_BIN" ./cmd/igris-overture
)
echo "[suite] Overture prebuilt: $IGRIS_PROOF_OVERTURE_BIN"

run_step() {
  local label="$1"
  local script="$2"
  echo ""
  echo "=========================================================="
  echo "[$label] $script"
  echo "=========================================================="
  if [[ ! -x "$SCRIPT_DIR/$script" ]]; then
    echo "missing or non-executable: $SCRIPT_DIR/$script" >&2
    exit 1
  fi
  # Run the child script, but never let a transient signal/cleanup mask its
  # exit code. We capture explicitly and abort the suite if non-zero so the
  # final summary line can never be reached after a failed step.
  local rc=0
  set +e
  "$SCRIPT_DIR/$script"
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    echo ""
    echo "Proof suite aborted: $script failed with exit code $rc" >&2
    exit "$rc"
  fi
}

run_step "1/4" "task_v1_proof_demo.sh"
run_step "2/4" "unified_execution_proof_demo.sh"
run_step "3/4" "fallback_execution_proof_demo.sh"
run_step "4/4" "checkpoint_proof_demo.sh"

echo ""
echo "Core proof suite passed: Run, Recover, and Verify all green."
