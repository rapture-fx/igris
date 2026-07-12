#!/usr/bin/env bash
# Run the Embedded private-alpha.2 acceptance harness and assert the exact
# expected journal shape: eleven signed events (6 decisions: 5 allowed /
# 1 denied; 5 outcomes: 4 succeeded / 1 failed) produced by one decorated
# action, wrapped synchronous tools, and one wrapped async tool — plus the
# evidence privacy behavior (inspect exit code 3, fail-closed sync refusal,
# one-shot --allow-unredacted acknowledgement via a recording client).
#
# Purely local: never passes Connected configuration, never requires an
# external endpoint, and never reads an API key. The alpha.1 harness
# (run_alpha_harness.sh) is unchanged.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

LOG=$(mktemp "${TMPDIR:-/tmp}/igris-alpha2-harness-XXXXXX.log")
trap 'rm -f "$LOG"' EXIT

env -u IGRIS_API_URL -u IGRIS_API_KEY \
  -u IGRIS_ALPHA_TEST_API_URL -u IGRIS_ALPHA_TEST_API_KEY \
  python3 -u "$ROOT/scripts/private-alpha/validate_alpha2.py" 2>&1 | tee "$LOG"

expected=(
  "SUMMARY: PASS"
  "OK: 11 event(s) verified"
  "events: 11 (decisions: 6, outcomes: 5)"
  "classifications: fully_redacted=3, partially_redacted=3, no_arguments=0, unknown=0"
  "PRIVACY REFUSAL: sync refused before any upload"
  "ACKNOWLEDGED UPLOAD: 11 events to the recording client"
  "SECOND SYNC REFUSED: --allow-unredacted was not persisted"
)
fail=0
for pattern in "${expected[@]}"; do
  if ! grep -qF "$pattern" "$LOG"; then
    echo "FAIL: harness output missing expected marker: $pattern"
    fail=1
  fi
done
if [[ "$fail" -ne 0 ]]; then
  echo "alpha.2 harness: FAIL (journey output did not match the expected shape)"
  exit 1
fi

echo "alpha.2 harness: OK (11 events, privacy refusal + one-shot acknowledgement)"
