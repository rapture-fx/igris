#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

ACTION_TASK_CLEAN_HOST_RECOVERY=true "$SCRIPT_DIR/action_task_v1_recovery_proof_demo.sh"
