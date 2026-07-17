#!/usr/bin/env bash
# Three-way schema-1 conformance differential.
#
# Runs the frozen 120-vector candidate through all three implementations —
# the maintained Python path, the maintained production Go path, and the
# standalone independent Go verifier — and fails on any differential.
#
# Every runner enforces exact equality against the same frozen expected
# verification results, so three 120/120 passes prove pairwise agreement on
# every vector; any relaxation would surface here as a runner failure.
#
# The script needs no network: every input is committed to the repository.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
suite="$root/spec/test-vectors/suite-schema-1"
out="${1:-$(mktemp -d)}"
mkdir -p "$out"

frozen_manifest_sha="864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

echo "[1/5] frozen manifest integrity"
actual="$(sha256_file "$suite/manifest.json")"
if [ "$actual" != "$frozen_manifest_sha" ]; then
  echo "FROZEN MANIFEST CHANGED: $actual" >&2
  exit 1
fi

echo "[2/5] maintained Python runner"
(cd "$root" && PYTHONPATH="$root" uv run --project "$root/sdk/python" --no-sync \
  python -m conformance.schema1.python.runner) > "$out/python-report.json"

echo "[3/5] maintained production Go path"
(cd "$root" && go test ./igris-overture/api \
  -run '^TestSchema1ConformanceCandidate$' -count=1 -v -timeout=300s) \
  > "$out/production-go-log.txt"

echo "[4/5] standalone independent Go verifier"
(cd "$root/conformance/go-verifier" && go run ./cmd/igris-verify vectors \
  --suite "$suite") > "$out/standalone-report.json"

echo "[5/5] differential comparison"
python3 - "$out" <<'PY'
import json
import re
import sys
from pathlib import Path

out = Path(sys.argv[1])
failures: list[str] = []

python_report = json.loads((out / "python-report.json").read_text())
standalone_report = json.loads((out / "standalone-report.json").read_text())
production_log = (out / "production-go-log.txt").read_text()

for name, report in (("python", python_report), ("standalone", standalone_report)):
    if report.get("status") != "pass":
        failures.append(f"{name}: status={report.get('status')} failures={report.get('failures')}")
    if report.get("selected") != 120 or report.get("passed") != 120:
        failures.append(f"{name}: {report.get('passed')}/{report.get('selected')} is not 120/120")

if python_report.get("families") != standalone_report.get("families"):
    failures.append(
        "family selection differs: "
        f"python={python_report.get('families')} standalone={standalone_report.get('families')}"
    )
if python_report.get("suite_revision") != standalone_report.get("suite_revision"):
    failures.append("suite revision differs between runners")

if "--- PASS: TestSchema1ConformanceCandidate" not in production_log:
    failures.append("production Go candidate test did not pass")
consumed = re.search(r"vectors=(\d+)", production_log)
if not consumed or consumed.group(1) != "120":
    failures.append("production Go candidate did not consume 120 vectors")

if failures:
    print("THREE-WAY DIFFERENTIAL DETECTED:")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print("three-way agreement: python 120/120, production-go 120/120, standalone 120/120")
print(f"reports: {out}")
PY
