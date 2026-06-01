#!/usr/bin/env bash
#
# Creates a temporary mock_demo action, calls its public action endpoint with
# an Agent/app API key, and verifies the resulting run can be read back.
#
# Required:
#   API_BASE=https://<api-default-fqdn>
#   OVERTURE_API_KEY=<agent-or-console-service-key>
#
# This script intentionally does not delete the action or run. Clean up from the
# console after the QA session if the temporary records are no longer useful.
set -u

pass=0
fail=0

ok() { printf '  PASS %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail + 1)); }

req() {
  if [ -z "${!1:-}" ]; then
    printf 'ERROR: required env var %s is not set.\n' "$1" >&2
    exit 2
  fi
}

code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

extract_task_id() {
  sed -n 's/.*"task_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
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
suffix="$(date +%s)"
action_name="smoke_tmp_${suffix}"

printf '== Preconditions ==\n'
expect_code 200 'GET /healthz' "$API_BASE/healthz"
expect_code 200 'GET /readyz' "$API_BASE/readyz"
expect_code 401 'GET /v1/actions without key' "$API_BASE/v1/actions"
expect_code 200 'GET /v1/actions with key' -H "$auth_header" "$API_BASE/v1/actions"

printf '\n== Create temporary action ==\n'
payload=$(printf '{"name":"%s","display_name":"Smoke temporary action","description":"temporary action-endpoint smoke record","target_type":"mock_demo","target_url":"","method":"POST","policy_preset":"Read-only","replay_class":"read_only","approval_required":false,"irreversible":false}' "$action_name")
create_body="$(curl -sS -w '\n%{http_code}' -X POST \
  -H "$auth_header" \
  -H 'Content-Type: application/json' \
  -d "$payload" \
  "$API_BASE/v1/actions")"
create_code="$(printf '%s' "$create_body" | tail -n 1)"
if [ "$create_code" = 201 ]; then
  ok "created $action_name"
else
  bad "create $action_name -> expected 201, got $create_code"
fi

printf '\n== Call action endpoint ==\n'
run_body="$(curl -sS -w '\n%{http_code}' -X POST \
  -H "$auth_header" \
  -H 'Content-Type: application/json' \
  -d '{"input":{"source":"action-endpoint-smoke","ok":true},"metadata":{"agent_id":"manual-smoke"}}' \
  "$API_BASE/v1/actions/$action_name/run")"
run_code="$(printf '%s' "$run_body" | tail -n 1)"
run_json="$(printf '%s' "$run_body" | sed '$d')"
case "$run_code" in
  202|200) ok "POST /v1/actions/$action_name/run accepted" ;;
  *) bad "POST /v1/actions/$action_name/run -> expected 202/200, got $run_code" ;;
esac

task_id="$(printf '%s' "$run_json" | extract_task_id | head -n 1)"
if [ -n "$task_id" ]; then
  ok "run response included task_id=$task_id"
else
  bad 'run response did not include task_id'
fi

printf '\n== Verify run appears ==\n'
if [ -n "$task_id" ]; then
  expect_code 200 "GET /v1/tasks/$task_id" -H "$auth_header" "$API_BASE/v1/tasks/$task_id"
  expect_code 200 "GET /v1/actions/runs/$task_id" -H "$auth_header" "$API_BASE/v1/actions/runs/$task_id"
fi

printf '\nManual cleanup: archive action %s from the console if desired.\n' "$action_name"
printf 'Result: %s passed, %s failed.\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
