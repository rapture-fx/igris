#!/usr/bin/env bash
# Run the Embedded private-alpha acceptance harness and assert the exact
# expected journal shape: five signed events with the expected class
# breakdown (2 allowed decisions, 1 denied decision, 1 succeeded outcome,
# 1 failed outcome), all offline-verified.
#
# Connected validation stays disabled: this wrapper never passes --connected,
# never requires an external endpoint, and never reads an API key.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

LOG=$(mktemp "${TMPDIR:-/tmp}/igris-alpha-harness-XXXXXX.log")
trap 'rm -f "$LOG"' EXIT

# The harness must run Embedded-only even if the caller's shell has
# Connected configuration exported.
env -u IGRIS_API_URL -u IGRIS_API_KEY \
  -u IGRIS_ALPHA_TEST_API_URL -u IGRIS_ALPHA_TEST_API_KEY \
  "$ROOT/scripts/private-alpha/validate_embedded.sh" 2>&1 | tee "$LOG"

expected=(
  "SUMMARY: PASS"
  "OK: 5 event(s) verified"
  "events: 5"
  "decision.allowed: 2"
  "decision.denied: 1"
  "outcome.succeeded: 1"
  "outcome.failed: 1"
)
fail=0
for pattern in "${expected[@]}"; do
  if ! grep -qF "$pattern" "$LOG"; then
    echo "FAIL: harness output missing expected marker: $pattern"
    fail=1
  fi
done
if [[ "$fail" -ne 0 ]]; then
  echo "alpha harness: FAIL (event breakdown did not match the expected five events)"
  exit 1
fi

echo "alpha harness: OK (5 events, expected class breakdown, offline-verified)"
