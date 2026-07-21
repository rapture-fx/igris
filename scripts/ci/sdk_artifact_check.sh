#!/usr/bin/env bash
# Reproducible-artifact verification for the private-alpha Python SDK.
#
#   1. Build wheel + sdist twice, in isolated output directories, from the
#      exact checked-out commit.
#   2. Fail unless both builds produce byte-identical (SHA-256) artifacts.
#   3. Inspect artifact contents (py.typed + LICENSE present; no tests,
#      signing keys, or journals packaged).
#   4. Install the wheel and the sdist into separate clean virtual
#      environments and run import, guard-execution, key-info, verify,
#      evidence-CLI help, and pip check smokes.
#   5. Emit a machine-readable manifest (commit, filenames, sizes, SHA-256).
#
# Usage: sdk_artifact_check.sh [output-dir]
# The output directory (default: a fresh temp dir) receives build-a/,
# build-b/, and artifact-manifest.json. Nothing is published anywhere.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
SDK="$ROOT/sdk/python"

OUT="${1:-$(mktemp -d "${TMPDIR:-/tmp}/igris-artifact-check-XXXXXX")}"
mkdir -p "$OUT"
OUT=$(CDPATH= cd -- "$OUT" && pwd)
rm -rf "$OUT/build-a" "$OUT/build-b" "$OUT/venv-wheel" "$OUT/venv-sdist" \
  "$OUT/home-wheel" "$OUT/home-sdist" "$OUT/artifact-manifest.json"

command -v uv >/dev/null || { echo "FAIL: uv is required"; exit 1; }

echo "== build #1 and #2 (isolated output directories)"
uv build --out-dir "$OUT/build-a" "$SDK"
uv build --out-dir "$OUT/build-b" "$SDK"

echo "== reproducibility: compare SHA-256 across builds"
python3 - "$OUT" <<'PY'
import hashlib
import sys
from pathlib import Path

out = Path(sys.argv[1])
def digests(d: Path) -> dict[str, str]:
    files = sorted(p for p in d.iterdir() if p.suffix in (".whl", ".gz"))
    if len(files) != 2:
        raise SystemExit(f"FAIL: expected exactly wheel+sdist in {d}, found {[f.name for f in files]}")
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}

a, b = digests(out / "build-a"), digests(out / "build-b")
if a != b:
    print("FAIL: artifacts are NOT reproducible across builds")
    for name in sorted(set(a) | set(b)):
        print(f"  {name}: build-a={a.get(name, 'missing')} build-b={b.get(name, 'missing')}")
    raise SystemExit(1)
for name, sha in sorted(a.items()):
    print(f"  identical: {name} sha256={sha}")
PY

echo "== inspect artifact contents"
python3 - "$OUT/build-a" <<'PY'
import sys
import tarfile
import zipfile
from pathlib import Path

dist = Path(sys.argv[1])
wheels = sorted(dist.glob("igris_sdk-*.whl"))
sdists = sorted(dist.glob("igris_sdk-*.tar.gz"))
assert len(wheels) == 1, wheels
assert len(sdists) == 1, sdists
assert wheels[0].name.startswith("igris_sdk-"), wheels[0].name
assert sdists[0].name.startswith("igris_sdk-"), sdists[0].name

with zipfile.ZipFile(wheels[0]) as wheel:
    wheel_names = set(wheel.namelist())
    metadata = next(n for n in wheel_names if n.endswith(".dist-info/METADATA"))
    meta_text = wheel.read(metadata).decode()
assert "Name: igris-sdk" in meta_text
assert "igris/py.typed" in wheel_names
assert any(n.endswith(".dist-info/licenses/LICENSE") for n in wheel_names)
assert not any(n.startswith("tests/") for n in wheel_names)
assert not any("signing_key" in n or "journal.jsonl" in n for n in wheel_names)

with tarfile.open(sdists[0]) as sdist:
    sdist_names = set(sdist.getnames())
assert any(n.endswith("/src/igris/py.typed") for n in sdist_names)
assert any(n.endswith("/LICENSE") for n in sdist_names)
assert not any("/tests/" in n for n in sdist_names)
assert not any("signing_key" in n or "journal.jsonl" in n for n in sdist_names)
print("  contents OK: py.typed + LICENSE packaged; Name=igris-sdk; no tests, keys, or journals")
PY

WHEEL=$(ls "$OUT"/build-a/igris_sdk-*.whl)
SDIST=$(ls "$OUT"/build-a/igris_sdk-*.tar.gz)

smoke() {
  # smoke <venv-dir> <igris-home> <artifact>
  local venv="$1" home="$2" artifact="$3"
  python3 -m venv "$venv"
  local py="$venv/bin/python" igris="$venv/bin/igris"
  "$py" -m pip install --quiet --disable-pip-version-check "$artifact"

  # Embedded-only smokes: make sure no Connected configuration leaks in.
  local -a clean_env=(env -u IGRIS_API_URL -u IGRIS_API_KEY "IGRIS_HOME=$home")

  "${clean_env[@]}" "$py" -c "from importlib.metadata import metadata; m=metadata('igris-sdk'); assert m['Name']=='igris-sdk'; print('dist OK', m['Name'], m['Version'])"
  "${clean_env[@]}" "$py" -c "import igris; from igris import guard, IgrisDurableClient, wrap_tool; print('import OK', igris.__version__, IgrisDurableClient.__name__, wrap_tool.__name__)"
  "${clean_env[@]}" "$py" - <<'PY'
import igris

@igris.guard(action="ci.artifact.smoke", risk="low", approval="never")
def probe(value: int):
    return value * 2

assert probe(21) == 42
print("guard execution OK")
PY
  "${clean_env[@]}" "$py" - <<'PY'
import igris
from igris import IgrisDurableClient

# Construction must succeed without a network request.
client = IgrisDurableClient(
    endpoint="https://example.invalid",
    api_key="igris_dummy_not_a_real_key",
)
assert client is not None
print("IgrisDurableClient construct OK")
PY
  "${clean_env[@]}" "$py" - <<'PY'
import igris

def existing_tool(value: int, access_token: str):
    return value + 1

wrapped = igris.wrap_tool(
    existing_tool, action="ci.artifact.wrap", risk="low", approval="never", redact=["value"]
)
assert wrapped(1, access_token="synthetic") == 2

def other_tool(flag: bool):
    return flag

tools = igris.wrap_tools(
    [other_tool],
    configuration={"other_tool": {"action": "ci.artifact.wraps", "approval": "never"}},
)
assert tools[0](True) is True

missing = [name for name in igris.__all__ if not hasattr(igris, name)]
assert not missing, f"__all__ names missing from package: {missing}"
assert issubclass(igris.ToolWrapError, igris.ContractError)
print(f"wrap_tool/wrap_tools OK; all {len(igris.__all__)} __all__ exports present")
PY
  "${clean_env[@]}" "$igris" key-info
  "${clean_env[@]}" "$igris" verify "$home/journal.jsonl" --public-key "$home/verify_key.pem"
  # The guard probe retains an ordinary argument, so inspect must classify
  # the journal as needing acknowledgement (documented exit code 3).
  local inspect_rc=0
  "${clean_env[@]}" "$igris" evidence inspect || inspect_rc=$?
  if [[ "$inspect_rc" -ne 3 ]]; then
    echo "FAIL: evidence inspect expected exit 3 (acknowledgement required), got $inspect_rc"
    exit 1
  fi
  "${clean_env[@]}" "$igris" evidence sync --help | grep -q -- "--allow-unredacted" \
    || { echo "FAIL: evidence sync --help does not document --allow-unredacted"; exit 1; }
  "${clean_env[@]}" "$igris" evidence status --help >/dev/null
  "$py" -m pip check
  echo "  smoke OK: $(basename "$artifact")"
}

echo "== clean-environment install + smoke (wheel)"
smoke "$OUT/venv-wheel" "$OUT/home-wheel" "$WHEEL"

echo "== clean-environment install + smoke (sdist)"
smoke "$OUT/venv-sdist" "$OUT/home-sdist" "$SDIST"

echo "== write artifact manifest"
COMMIT=$(git -C "$ROOT" rev-parse HEAD)
python3 - "$OUT" "$COMMIT" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

out, commit = Path(sys.argv[1]), sys.argv[2]
artifacts = []
for p in sorted((out / "build-a").iterdir()):
    if p.suffix not in (".whl", ".gz"):
        continue
    artifacts.append(
        {
            "filename": p.name,
            "size_bytes": p.stat().st_size,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        }
    )
manifest = {
    "commit": commit,
    "source": "sdk/python",
    "builds_compared": 2,
    "reproducible": True,
    "artifacts": artifacts,
}
path = out / "artifact-manifest.json"
path.write_text(json.dumps(manifest, indent=2) + "\n")
print(path.read_text())
PY

echo "artifact check: OK (manifest at $OUT/artifact-manifest.json)"
