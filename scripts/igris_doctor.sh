#!/usr/bin/env bash
# Local readiness doctor for first-agent onboarding.
#
# This script checks configuration and safe control-plane endpoints only. It
# never prints secret values and never mutates production or customer data.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PASS=0
WARN=0
FAIL=0

log() { printf '%s\n' "$*"; }

pass() {
  PASS=$((PASS + 1))
  log "PASS  $1"
}

warn() {
  WARN=$((WARN + 1))
  log "WARN  $1"
}

fail() {
  FAIL=$((FAIL + 1))
  log "FAIL  $1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

api_base="${IGRIS_API_BASE_URL:-${IGRIS_API_URL:-}}"
api_base="${api_base%/}"
api_key="${IGRIS_API_KEY:-}"
mcp_config="${IGRIS_MCP_CONFIG:-}"
runtime_install_url="${RUNTIME_BINARIES_URL:-}"
runtime_endpoint="${IGRIS_RUNTIME_ENDPOINT:-}"

http_status() {
  local method="$1" url="$2" body="${3:-}" auth="${4:-0}"
  local args=(-sS -o /dev/null -w "%{http_code}" --max-time 10 -X "$method")
  if [[ "$auth" == "1" ]]; then
    args+=(-H "Authorization: Bearer ${api_key}")
  fi
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi
  curl "${args[@]}" "$url" 2>/dev/null || printf '000'
}

json_check() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception as exc:
    print(f"invalid JSON: {exc}")
    sys.exit(1)

servers = data.get("mcpServers")
if isinstance(servers, dict):
    names = ", ".join(sorted(servers.keys())) or "(none)"
    print(f"mcpServers: {names}")
else:
    print("mcpServers object not found")
    sys.exit(2)
PY
}

# Prints has_igris=0|1 and server_names on stdout for bash parsing.
analyze_mcp_config() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception as exc:
    print(f"error=invalid JSON: {exc}")
    sys.exit(1)

servers = data.get("mcpServers")
if not isinstance(servers, dict):
    print("error=mcpServers object not found")
    sys.exit(2)

has_igris = False
for cfg in servers.values():
    if not isinstance(cfg, dict):
        continue
    command = str(cfg.get("command", "")).strip()
    args = cfg.get("args") or []
    if not isinstance(args, list):
        continue
    lowered = [str(arg).strip().lower() for arg in args]
    if command in {"igris", "igris-runtime"} and "mcp" in lowered and "serve" in lowered:
        has_igris = True
        break

names = ",".join(sorted(servers.keys())) or "(none)"
print(f"has_igris={'1' if has_igris else '0'}")
print(f"server_names={names}")
PY
}

template_output_dir() {
  local name="$1"
  printf '%s' "${ROOT}/.igris/templates/${name}"
}

validate_runtime_endpoint() {
  local value="$1"
  python3 - "$value" <<'PY'
import sys
from urllib.parse import urlparse

value = sys.argv[1].strip()
parsed = urlparse(value)
if parsed.scheme not in {"http", "https"}:
    print("runtime endpoint must use http or https")
    sys.exit(1)
if not parsed.netloc:
    print("runtime endpoint must include a host")
    sys.exit(1)
if parsed.username or parsed.password:
    print("runtime endpoint must not contain credentials")
    sys.exit(1)
if parsed.query or parsed.fragment:
    print("runtime endpoint must not contain query or fragment")
    sys.exit(1)
print("runtime endpoint shape is routable")
PY
}

log "Igris first-agent readiness doctor"
log "Repo: ${ROOT}"
log ""

if have curl; then
  pass "curl is available"
else
  fail "curl is required to check API reachability"
fi

if have python3; then
  pass "python3 is available for JSON and URL validation"
else
  warn "python3 not found; MCP config and runtime endpoint validation will be skipped"
fi

if [[ -n "$api_base" ]]; then
  pass "IGRIS_API_BASE_URL or IGRIS_API_URL is set"
else
  fail "set IGRIS_API_BASE_URL to the hosted API base URL"
fi

if [[ -n "$api_key" ]]; then
  if [[ "$api_key" == igris_* ]]; then
    pass "IGRIS_API_KEY is set and has the expected prefix"
  else
    fail "IGRIS_API_KEY is set but does not use the expected igris_ prefix"
  fi
else
  fail "set IGRIS_API_KEY; the value will not be printed"
fi

if have curl && [[ -n "$api_base" ]]; then
  status="$(http_status GET "${api_base}/v1/health")"
  case "$status" in
    200|204) pass "API health endpoint is reachable (${status})" ;;
    000) fail "API health endpoint is unreachable; check IGRIS_API_BASE_URL and network access" ;;
    *) warn "API health endpoint returned ${status}; verify the base URL is correct" ;;
  esac
fi

if have curl && [[ -n "$api_base" && -n "$api_key" ]]; then
  status="$(http_status GET "${api_base}/v1/actions" "" 1)"
  case "$status" in
    200) pass "API key was accepted by GET /v1/actions" ;;
    401|403) fail "API key was rejected by GET /v1/actions (${status})" ;;
    000) fail "authenticated API check could not reach GET /v1/actions" ;;
    *) warn "GET /v1/actions returned ${status}; inspect API availability and tenant setup" ;;
  esac

  mcp_body='{"jsonrpc":"2.0","id":"doctor","method":"tools/list","params":{}}'
  status="$(http_status POST "${api_base}/v1/mcp" "$mcp_body" 1)"
  case "$status" in
    200) pass "MCP tools/list succeeded on POST /v1/mcp" ;;
    401|403) fail "MCP tools/list rejected the API key (${status})" ;;
    404) warn "POST /v1/mcp returned 404; the deployment may not expose HTTP MCP" ;;
    000) fail "MCP tools/list could not reach POST /v1/mcp" ;;
    *) warn "MCP tools/list returned ${status}; verify MCP route availability" ;;
  esac
fi

if [[ -n "$mcp_config" ]]; then
  if [[ -f "$mcp_config" ]]; then
    if have python3; then
      if output="$(json_check "$mcp_config" 2>&1)"; then
        pass "IGRIS_MCP_CONFIG is valid JSON (${output})"
      else
        fail "IGRIS_MCP_CONFIG could not be validated: ${output}"
      fi
    fi
  else
    fail "IGRIS_MCP_CONFIG points to a file that does not exist"
  fi
else
  warn "IGRIS_MCP_CONFIG is unset; skipping local MCP client config validation"
fi

igris_cli=""
if have igris; then
  igris_cli="igris"
  pass "igris CLI is available"
elif have igris-runtime; then
  igris_cli="igris-runtime"
  pass "igris-runtime CLI is available"
else
  warn "igris CLI not found in PATH; install it before generating agent templates"
fi

template_suggest=""
mcp_candidate=""
mcp_kind=""

if [[ -f "${ROOT}/.cursor/mcp.json" ]]; then
  mcp_candidate="${ROOT}/.cursor/mcp.json"
  mcp_kind="cursor"
elif [[ -n "$mcp_config" && -f "$mcp_config" ]]; then
  mcp_candidate="$mcp_config"
  mcp_kind="claude-code"
fi

if [[ -n "$mcp_candidate" ]]; then
  if have python3; then
    if analyze_output="$(analyze_mcp_config "$mcp_candidate" 2>&1)"; then
      has_igris="$(printf '%s\n' "$analyze_output" | awk -F= '/^has_igris=/{print $2}')"
      server_names="$(printf '%s\n' "$analyze_output" | awk -F= '/^server_names=/{print $2}')"
      if [[ "$has_igris" == "1" ]]; then
        pass "Igris MCP bridge configured in ${mcp_kind} MCP file (${server_names})"
      else
        warn "MCP file ${mcp_candidate} has no igris mcp serve entry (${server_names})"
        template_suggest="$mcp_kind"
      fi
    else
      warn "Could not analyze MCP file ${mcp_candidate}: ${analyze_output}"
    fi
  fi
else
  warn "No local MCP config detected (.cursor/mcp.json or IGRIS_MCP_CONFIG)"
  if [[ -z "$template_suggest" ]]; then
    template_suggest="list"
  fi
fi

for template_name in claude-code codex cursor custom-agent; do
  if [[ -d "$(template_output_dir "$template_name")" ]]; then
    pass "Agent template output exists at .igris/templates/${template_name}"
    if [[ "$template_suggest" == "$template_name" ]]; then
      template_suggest=""
    fi
  fi
done

if have curl && [[ -n "$api_base" && -n "$api_key" ]]; then
  actions_body="$(curl -sS --max-time 10 -H "Authorization: Bearer ${api_key}" "${api_base}/v1/actions" 2>/dev/null || true)"
  if printf '%s' "$actions_body" | grep -q 'demo\.echo'; then
    pass "starter pack action demo.echo is registered"
  else
    warn "demo.echo is not registered; run: ${igris_cli:-igris} packs install starter"
  fi
fi

if [[ -n "$runtime_install_url" ]]; then
  if have curl; then
    status="$(http_status HEAD "$runtime_install_url")"
    case "$status" in
      200|302|307|308) pass "RUNTIME_BINARIES_URL is reachable (${status})" ;;
      000) fail "RUNTIME_BINARIES_URL is unreachable" ;;
      *) warn "RUNTIME_BINARIES_URL returned ${status}; verify release artifact availability" ;;
    esac
  fi
else
  warn "RUNTIME_BINARIES_URL is unset; skipping runtime binary source check"
fi

if have curl && [[ -n "$api_base" ]]; then
  status="$(http_status GET "${api_base}/v1/runtime/checksum")"
  case "$status" in
    200) pass "runtime checksum endpoint is reachable" ;;
    404) warn "runtime checksum endpoint returned 404; runtime install metadata may be missing" ;;
    000) warn "runtime checksum endpoint could not be reached" ;;
    *) warn "runtime checksum endpoint returned ${status}" ;;
  esac
fi

if [[ -n "$runtime_endpoint" ]]; then
  if have python3; then
    if output="$(validate_runtime_endpoint "$runtime_endpoint" 2>&1)"; then
      pass "IGRIS_RUNTIME_ENDPOINT shape is valid (${output})"
      if have curl; then
        status="$(http_status GET "${runtime_endpoint%/}/v1/health")"
        case "$status" in
          200|204) pass "local runtime health endpoint is reachable (${status})" ;;
          404) warn "runtime endpoint is reachable but /v1/health returned 404; verify runtime route shape" ;;
          000) fail "IGRIS_RUNTIME_ENDPOINT is not reachable from this machine" ;;
          *) warn "runtime health endpoint returned ${status}" ;;
        esac
      fi
    else
      fail "IGRIS_RUNTIME_ENDPOINT is invalid: ${output}"
    fi
  fi
else
  warn "IGRIS_RUNTIME_ENDPOINT is unset; local_runtime actions will require a connected runtime before running"
fi

log ""
if [[ -n "$igris_cli" ]]; then
  log "Agent template next steps:"
  case "$template_suggest" in
    claude-code|codex|cursor|custom-agent)
      log "  ${igris_cli} templates install ${template_suggest}"
      log "  ${igris_cli} templates verify ${template_suggest}"
      if [[ -n "$api_key" ]]; then
        log "  ${igris_cli} packs install starter   # when starter actions are missing"
      fi
      ;;
    list)
      log "  ${igris_cli} templates list"
      log "  ${igris_cli} templates install claude-code   # Claude Code MCP"
      log "  ${igris_cli} templates install cursor        # Cursor MCP"
      log "  ${igris_cli} templates install codex         # terminal / Codex-style agents"
      ;;
    "")
      log "  ${igris_cli} templates verify claude-code   # or the template you installed"
      ;;
  esac
  log "  Docs: web/apps/web-docs-hub/content/docs/agent-templates.mdx"
fi

log ""
log "Summary: ${PASS} passed, ${WARN} warning(s), ${FAIL} failure(s)"

if [[ "$FAIL" -gt 0 ]]; then
  log "Result: not ready. Fix FAIL items before first-agent dry run."
  exit 1
fi

log "Result: ready enough for non-production first-agent checks. Review WARN items before staging or production."
