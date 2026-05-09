#!/bin/zsh

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
  "$SCRIPT_DIR/$script"
}

run_step "1/4" "task_v1_proof_demo.sh"
run_step "2/4" "unified_execution_proof_demo.sh"
run_step "3/4" "fallback_execution_proof_demo.sh"
run_step "4/4" "checkpoint_proof_demo.sh"

echo ""
echo "Core proof suite passed: Run, Recover, and Verify all green."
