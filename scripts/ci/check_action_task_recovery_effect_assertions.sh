#!/usr/bin/env bash
# Static regression guard: cumulative Action Task V1 recovery expects
# EXPECTED_HTTP_AFTER=2, while Clock 3B alone requires EFFECT_COUNT_AFTER=1.
# Fail closed if the one-effect assertion is again applied outside Clock 3B mode.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
HARNESS="$ROOT/scripts/action_task_v1_recovery_proof_demo.sh"

if [[ ! -f "$HARNESS" ]]; then
  echo "FAIL: missing recovery harness: $HARNESS" >&2
  exit 1
fi

python3 - "$HARNESS" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()

if 'EXPECTED_HTTP_AFTER="2"' not in text:
    print("FAIL: cumulative EXPECTED_HTTP_AFTER=2 expectation missing from harness", file=sys.stderr)
    sys.exit(1)

# Every EFFECT_COUNT_AFTER != "1" assertion must also mention CLOCK3B_MODE on
# the same conditional line (or an immediately wrapping Clock 3B guard).
pattern = re.compile(
    r'^\s*if\s+\[\[\s*(.+?)\s*\]\];\s*then\s*$',
    re.MULTILINE,
)
effect_checks = []
for match in pattern.finditer(text):
    condition = match.group(1)
    if 'EFFECT_COUNT_AFTER' in condition and '!=' in condition and '"1"' in condition:
        effect_checks.append(condition)

if not effect_checks:
    print("FAIL: Clock 3B EFFECT_COUNT_AFTER==1 assertion missing from harness", file=sys.stderr)
    sys.exit(1)

for condition in effect_checks:
    if "CLOCK3B_MODE" not in condition:
        print(
            "FAIL: EFFECT_COUNT_AFTER==1 assertion is not scoped to CLOCK3B_MODE:\n"
            f"  if [[ {condition} ]]; then",
            file=sys.stderr,
        )
        sys.exit(1)

print("action-task recovery effect assertions: OK (Clock 3B-scoped; cumulative HTTP=2 preserved)")
PY
