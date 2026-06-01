#!/usr/bin/env bash
#
# Verifies runtime-key metadata and, optionally, mints one runtime key.
#
# Required:
#   API_BASE=https://<api-default-fqdn>
#   OVERTURE_API_KEY=<console-service-key>
#
# Optional:
#   CREATE_RUNTIME_KEY=1
#
# The raw runtime key is never printed. If CREATE_RUNTIME_KEY=1 is set, copy
# the key from the console during manual QA instead of relying on this script.
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
req OVERTURE_API_KEY

API_BASE="${API_BASE%/}"
auth_header="Authorization: Bearer $OVERTURE_API_KEY"

printf '== Preconditions ==\n'
expect_code 200 'GET /healthz' "$API_BASE/healthz"
expect_code 200 'GET /readyz' "$API_BASE/readyz"

printf '\n== Runtime key metadata ==\n'
expect_code 401 'GET /v1/runtime/api-key without key' "$API_BASE/v1/runtime/api-key"
metadata="$(curl -sS -H "$auth_header" "$API_BASE/v1/runtime/api-key" || true)"
if printf '%s' "$metadata" | grep -Eq '"has_key"[[:space:]]*:'; then
  ok 'GET /v1/runtime/api-key returns metadata only'
else
  bad 'GET /v1/runtime/api-key did not return expected metadata'
fi
if printf '%s' "$metadata" | grep -q '"api_key"'; then
  bad 'runtime key metadata exposed a raw api_key'
else
  ok 'runtime key metadata does not expose a raw key'
fi

printf '\n== Runtime key creation ==\n'
if [ "${CREATE_RUNTIME_KEY:-}" = "1" ]; then
  body="$(curl -sS -w '\n%{http_code}' -X POST -H "$auth_header" "$API_BASE/v1/runtime/api-key")"
  status="$(printf '%s' "$body" | tail -n 1)"
  json="$(printf '%s' "$body" | sed '$d')"
  if [ "$status" = 201 ]; then
    ok 'POST /v1/runtime/api-key created a runtime key'
  else
    bad "POST /v1/runtime/api-key -> expected 201, got $status"
  fi
  if printf '%s' "$json" | grep -q '"api_key"'; then
    ok 'creation response included read-once raw key (redacted by script)'
  else
    bad 'creation response did not include read-once raw key'
  fi
  prefix="$(printf '%s' "$json" | sed -n 's/.*"prefix"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -n "$prefix" ]; then
    printf '  INFO created runtime key prefix %s…\n' "$prefix"
  fi
else
  skip 'set CREATE_RUNTIME_KEY=1 to mint a runtime key; prefer console manual QA for copy-once validation'
fi

printf '\nResult: %s passed, %s failed.\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
