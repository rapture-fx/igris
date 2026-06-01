#!/usr/bin/env bash
#
# Deterministic curl smoke test for a live Igris deployment.
#
# Required:
#   API_BASE=https://<api-default-fqdn>
#
# Optional:
#   CONSOLE_BASE=https://<console-default-fqdn>
#   OVERTURE_API_KEY=<agent-or-console-service-key>
#   ADMIN_USERNAME=<console-basic-auth-user>
#   ADMIN_PASSWORD=<console-basic-auth-password>
#
# Secrets are never printed. This script creates one idempotent action named
# smoke_check when OVERTURE_API_KEY is set. It does not delete data.
set -u

pass=0
fail=0

ok() { printf '  PASS %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail + 1)); }
skip() { printf '  SKIP %s\n' "$1"; }

req() {
  if [ -z "${!1:-}" ]; then
    printf 'ERROR: required env var %s is not set.\n' "$1" >&2
    exit 2
  fi
}

mask() {
  value="${1:-}"
  if [ -z "$value" ]; then
    printf '<unset>'
    return
  fi
  prefix=$(printf '%s' "$value" | cut -c 1-12)
  printf '%s…' "$prefix"
}

code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

expect_code() {
  expected="$1"
  label="$2"
  shift 2
  got="$(code "$@")"
  if [ "$got" = "$expected" ]; then
    ok "$label -> $expected"
  else
    bad "$label -> expected $expected, got $got"
  fi
}

req API_BASE
API_BASE="${API_BASE%/}"
CONSOLE_BASE="${CONSOLE_BASE:-}"
OVERTURE_API_KEY="${OVERTURE_API_KEY:-}"

printf '== API health ==\n'
expect_code 200 'GET /healthz' "$API_BASE/healthz"
expect_code 200 'GET /readyz' "$API_BASE/readyz"

printf '\n== API auth ==\n'
expect_code 401 'GET /v1/actions without key' "$API_BASE/v1/actions"

if [ -n "$OVERTURE_API_KEY" ]; then
  printf '  using API key %s\n' "$(mask "$OVERTURE_API_KEY")"
  auth_header="Authorization: Bearer $OVERTURE_API_KEY"

  expect_code 200 'GET /v1/actions with key' \
    -H "$auth_header" "$API_BASE/v1/actions"

  create_code="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      -X POST \
      -H "$auth_header" \
      -H 'Content-Type: application/json' \
      -d '{"name":"smoke_check","display_name":"Smoke Check","description":"manual live-mode smoke action","target_type":"mock_demo","target_url":"","method":"POST","policy_preset":"Read-only","replay_class":"read_only","approval_required":false,"irreversible":false}' \
      "$API_BASE/v1/actions"
  )"
  case "$create_code" in
    201) ok 'POST /v1/actions created smoke_check' ;;
    409) ok 'POST /v1/actions smoke_check already exists' ;;
    *) bad "POST /v1/actions smoke_check -> expected 201 or 409, got $create_code" ;;
  esac

  actions_body="$(curl -sS -H "$auth_header" "$API_BASE/v1/actions" || true)"
  if printf '%s' "$actions_body" | grep -q '"name":"smoke_check"'; then
    ok 'smoke_check appears in action list'
  else
    bad 'smoke_check missing from action list'
  fi
else
  skip 'set OVERTURE_API_KEY to verify authenticated action routes'
fi

printf '\n== Console ==\n'
if [ -n "$CONSOLE_BASE" ]; then
  CONSOLE_BASE="${CONSOLE_BASE%/}"
  expect_code 200 'GET /up' "$CONSOLE_BASE/up"

  if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    expect_code 401 'GET /actions without Basic auth' "$CONSOLE_BASE/actions"

    page="$(curl -sS -u "${ADMIN_USERNAME}:${ADMIN_PASSWORD}" "$CONSOLE_BASE/actions" || true)"
    if [ -n "$page" ]; then
      if printf '%s' "$page" | grep -q 'Demo data'; then
        bad "console /actions still shows Demo data"
      else
        ok "console /actions has no Demo data chip"
      fi
    else
      bad 'console /actions returned an empty body with Basic auth'
    fi
  else
    skip 'set ADMIN_USERNAME and ADMIN_PASSWORD to verify authenticated console pages'
  fi
else
  skip 'set CONSOLE_BASE to verify console /up and /actions'
fi

printf '\nResult: %s passed, %s failed.\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
