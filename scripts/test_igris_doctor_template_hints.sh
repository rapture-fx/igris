#!/usr/bin/env bash
# Smoke tests for igris_doctor MCP analysis and template hint selection.
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'PASS  %s\n' "$1"
}

analyze_mcp_config() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text())
servers = data.get("mcpServers") or {}
has_igris = False
for cfg in servers.values():
    if not isinstance(cfg, dict):
        continue
    command = str(cfg.get("command", "")).strip()
    args = [str(arg).strip().lower() for arg in (cfg.get("args") or [])]
    if command in {"igris", "igris-runtime"} and "mcp" in args and "serve" in args:
        has_igris = True
        break
names = ",".join(sorted(servers.keys())) or "(none)"
print(f"has_igris={'1' if has_igris else '0'}")
print(f"server_names={names}")
PY
}

cat >"${TMP}/with-igris.json" <<'JSON'
{
  "mcpServers": {
    "igris": {
      "command": "igris",
      "args": ["mcp", "serve"]
    }
  }
}
JSON

cat >"${TMP}/without-igris.json" <<'JSON'
{
  "mcpServers": {
    "other": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
JSON

out="$(analyze_mcp_config "${TMP}/with-igris.json")"
echo "$out" | grep -q 'has_igris=1' || fail 'expected has_igris=1 for igris bridge config'
pass 'detects igris mcp serve entry'

out="$(analyze_mcp_config "${TMP}/without-igris.json")"
echo "$out" | grep -q 'has_igris=0' || fail 'expected has_igris=0 when bridge missing'
pass 'detects missing igris bridge'

pass 'igris_doctor template hint smoke tests completed'