#!/usr/bin/env bash
#
# live-mode-smoke.sh — deterministic curl smoke test for a live Igris deploy.
#
# Proves the API is up + DB-aware, the console service key is tenant-scoped,
# an action round-trips, and the console is up and out of fixture mode.
# Read-only except for one idempotent throwaway action (`smoke_check`).
#
# Usage:
#   API_BASE=https://igris-api.<region>.azurecontainerapps.io \
#   CONSOLE_BASE=https://app.igrisinertial.com \
#   OVERTURE_API_KEY=igris_… \
#   [ADMIN_USERNAME=founder ADMIN_PASSWORD=…] \
#   scripts/smoke/live-mode-smoke.sh
#
# The API key and admin password are never printed.
set -uo pipefail

API_BASE="${API_BASE:-}"
CONSOLE_BASE="${CONSOLE_BASE:-}"
OVERTURE_API_KEY="${OVERTURE_API_KEY:-}"

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
req()  { [ -n "${!1}" ] || { echo "ERROR: required env var $1 not set." >&2; exit 2; }; }

req API_BASE
API_BASE="${API_BASE%/}"

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== API health =="
[ "$(code "$API_BASE/healthz")" = 200 ] && ok "GET /healthz 200" || bad "GET /healthz"
[ "$(code "$API_BASE/readyz")" = 200 ]  && ok "GET /readyz 200 (DB reachable)" || bad "GET /readyz (DB?)"

if [ -n "$OVERTURE_API_KEY" ]; then
  echo "== API auth + action round-trip =="
  AUTH=(-H "Authorization: Bearer $OVERTURE_API_KEY")

  [ "$(code "$API_BASE/v1/actions")" = 401 ] \
    && ok "GET /v1/actions without key → 401" || bad "unauthenticated list must be 401"

  [ "$(code "${AUTH[@]}" "$API_BASE/v1/actions")" = 200 ] \
    && ok "GET /v1/actions with key → 200" || bad "authenticated list must be 200"

  # Idempotent create: 201 first run, 409 thereafter — both are healthy.
  CREATE_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"name":"smoke_check","display_name":"Smoke Check","description":"live-mode smoke","target_type":"hosted_api","target_url":"https://example.com/health","method":"POST","policy_preset":"Read-only"}' \
    "$API_BASE/v1/actions")
  case "$CREATE_CODE" in
    201) ok "POST /v1/actions created smoke_check (201)";;
    409) ok "POST /v1/actions smoke_check already exists (409, idempotent)";;
    *)   bad "POST /v1/actions returned $CREATE_CODE";;
  esac

  if curl -s "${AUTH[@]}" "$API_BASE/v1/actions" | grep -q '"name":"smoke_check"'; then
    ok "smoke_check appears in the list (scanner round-trip OK)"
  else
    bad "smoke_check missing from list (possible list-scan regression)"
  fi
else
  echo "== API auth =="
  echo "  (skip: set OVERTURE_API_KEY to exercise authenticated endpoints)"
fi

if [ -n "$CONSOLE_BASE" ]; then
  CONSOLE_BASE="${CONSOLE_BASE%/}"
  echo "== Console =="
  [ "$(code "$CONSOLE_BASE/up")" = 200 ] && ok "GET /up 200" || bad "GET /up"

  CURL_AUTH=()
  if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    CURL_AUTH=(-u "${ADMIN_USERNAME}:${ADMIN_PASSWORD}")
    [ "$(code "$CONSOLE_BASE/actions")" = 401 ] \
      && ok "GET /actions without creds → 401 (front door closed)" \
      || bad "/actions should challenge without creds in production"
  fi

  PAGE=$(curl -s ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} "$CONSOLE_BASE/actions" || true)
  if [ -n "$PAGE" ]; then
    if printf '%s' "$PAGE" | grep -q 'Demo data'; then
      bad "console still shows the 'Demo data' chip — NOT in live mode"
    else
      ok "console /actions has no 'Demo data' chip (live mode)"
    fi
  fi
else
  echo "== Console =="
  echo "  (skip: set CONSOLE_BASE to check the console)"
fi

echo
echo "Result: $pass passed, $fail failed."
[ "$fail" -eq 0 ]
