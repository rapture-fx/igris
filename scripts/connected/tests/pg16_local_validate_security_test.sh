#!/usr/bin/env bash
# Adversarial regression tests for the local PostgreSQL 16 validation helper.
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

HELPER="$ROOT/scripts/connected/pg16_local_validate.sh"
SMOKE="$ROOT/scripts/connected/staging_smoke.sh"
PG16_PREFIX="${IGRIS_TEST_PG16_PREFIX:-${IGRIS_PG16_PREFIX:-}}"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/igris-pg16-security-test.XXXXXX")"
chmod 700 "$TEST_ROOT"
unset IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN DATABASE_URL_MIGRATION

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'ok - %s\n' "$*"
}

cleanup_test_root() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup_test_root EXIT

[[ -n "$PG16_PREFIX" ]] || fail "set IGRIS_TEST_PG16_PREFIX to a verified PostgreSQL 16 prefix"
PG16_PREFIX="$(cd "$PG16_PREFIX" && pwd -P)"
for binary in initdb pg_ctl postgres psql; do
  [[ -x "$PG16_PREFIX/bin/$binary" ]] || fail "missing PostgreSQL binary: $binary"
done

assert_no_success() {
  local log_file="$1"
  if grep -q '^result=connected_pg16_local_validate_ok$' "$log_file"; then
    fail "failure path emitted the final success marker: $log_file"
  fi
}

state_dir_from_log() {
  sed -n 's/^pg16_state_dir=//p' "$1" | tail -1
}

run_injected_stage_failure() {
  local stage="$1"
  local expected="$2"
  local log_file="$TEST_ROOT/fail-${stage}.log"
  local status
  set +e
  IGRIS_PG16_PREFIX="$PG16_PREFIX" \
    IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
    IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES=1 \
    IGRIS_PG16_TEST_FAIL_STAGE="$stage" \
    "$HELPER" >"$log_file" 2>&1
  status=$?
  set -e
  [[ "$status" -eq "$expected" ]] || fail "$stage returned $status, expected $expected"
  assert_no_success "$log_file"
  local state_dir
  state_dir="$(state_dir_from_log "$log_file")"
  [[ -n "$state_dir" && ! -e "$state_dir" ]] || fail "$stage did not clean its run state"
  pass "$stage failure propagates status $expected and cleans up"
}

for case_spec in \
  bootstrap:41 \
  roles:42 \
  runtime:43 \
  contract:44 \
  e2e:45 \
  coordinator:46 \
  preflight:47 \
  smoke:49; do
  run_injected_stage_failure "${case_spec%%:*}" "${case_spec##*:}"
done

cleanup_log="$TEST_ROOT/fail-cleanup.log"
set +e
IGRIS_PG16_PREFIX="$PG16_PREFIX" \
  IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
  IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES=1 \
  IGRIS_PG16_TEST_FAIL_STAGE=cleanup \
  "$HELPER" >"$cleanup_log" 2>&1
cleanup_status=$?
set -e
[[ "$cleanup_status" -eq 77 ]] || fail "cleanup failure returned $cleanup_status, expected 77"
assert_no_success "$cleanup_log"
cleanup_state="$(state_dir_from_log "$cleanup_log")"
[[ -d "$cleanup_state/data" ]] || fail "unsafe-to-delete PGDATA was not retained"
grep -Fq "retained_state_dir=${cleanup_state}" "$cleanup_log" || fail "retained cleanup location was not reported"
postmaster_pid="$(sed -n '1p' "$cleanup_state/data/postmaster.pid")"
kill -0 "$postmaster_pid" 2>/dev/null || fail "cleanup-failure test server was not explicitly observable"
"$PG16_PREFIX/bin/pg_ctl" -D "$cleanup_state/data" -m fast -w stop >/dev/null
if kill -0 "$postmaster_pid" 2>/dev/null; then
  fail "manual cleanup did not stop the retained test server"
fi
rm -rf -- "$cleanup_state"
pass "cleanup failure is fatal, retains PGDATA, and reports recoverable state"

combined_log="$TEST_ROOT/fail-primary-and-cleanup.log"
set +e
IGRIS_PG16_PREFIX="$PG16_PREFIX" \
  IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
  IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES=1 \
  IGRIS_PG16_TEST_FAIL_STAGE=e2e \
  IGRIS_PG16_TEST_FAIL_CLEANUP=1 \
  "$HELPER" >"$combined_log" 2>&1
combined_status=$?
set -e
[[ "$combined_status" -eq 45 ]] || fail "combined primary/cleanup failure returned $combined_status, expected primary status 45"
assert_no_success "$combined_log"
grep -q 'primary_status=45 cleanup_status=77' "$combined_log" || fail "combined failure did not report both statuses"
combined_state="$(state_dir_from_log "$combined_log")"
[[ -d "$combined_state/data" ]] || fail "combined failure did not retain PGDATA"
combined_pid="$(sed -n '1p' "$combined_state/data/postmaster.pid")"
"$PG16_PREFIX/bin/pg_ctl" -D "$combined_state/data" -m fast -w stop >/dev/null
if kill -0 "$combined_pid" 2>/dev/null; then
  fail "combined failure manual cleanup did not stop the test server"
fi
rm -rf -- "$combined_state"
pass "primary status is preserved while cleanup failure is also reported"

for attack in symlink stale; do
  attack_log="$TEST_ROOT/state-${attack}.log"
  set +e
  IGRIS_PG16_PREFIX="$PG16_PREFIX" \
    IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
    IGRIS_PG16_TEST_STATE_ATTACK="$attack" \
    "$HELPER" >"$attack_log" 2>&1
  attack_status=$?
  set -e
  [[ "$attack_status" -ne 0 ]] || fail "$attack state substitution was accepted"
  assert_no_success "$attack_log"
  attack_state="$(state_dir_from_log "$attack_log")"
  [[ -z "$attack_state" || ! -e "$attack_state" ]] || fail "$attack state directory was not removed"
  pass "$attack state substitution is rejected"
done

prefix_test() {
  local name="$1"
  local prefix="$2"
  local expected_status="$3"
  local log_file="$TEST_ROOT/prefix-${name}.log"
  local status
  set +e
  IGRIS_PG16_PREFIX="$prefix" \
    IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
    IGRIS_PG16_TEST_VALIDATE_PREFIX_ONLY=1 \
    "$HELPER" >"$log_file" 2>&1
  status=$?
  set -e
  [[ "$status" -eq "$expected_status" ]] || fail "$name prefix returned $status, expected $expected_status"
  if [[ "$expected_status" -eq 0 ]]; then
    grep -q '^result=pg16_prefix_validation_test_ok$' "$log_file" || fail "$name prefix did not complete validation"
  else
    assert_no_success "$log_file"
  fi
  pass "$name prefix validation status=$expected_status"
}

ln -s "$PG16_PREFIX" "$TEST_ROOT/symlink-prefix"
prefix_test symlink "$TEST_ROOT/symlink-prefix" 1
prefix_test traversal "$PG16_PREFIX/../$(basename "$PG16_PREFIX")" 1
mkdir -m 700 "$TEST_ROOT/incomplete-prefix"
prefix_test missing-binary "$TEST_ROOT/incomplete-prefix" 1
mkdir -m 700 -p "$TEST_ROOT/symlink-binary-prefix/bin"
ln -s "$PG16_PREFIX/bin/initdb" "$TEST_ROOT/symlink-binary-prefix/bin/initdb"
prefix_test symlink-binary "$TEST_ROOT/symlink-binary-prefix" 1

writable_prefix="$TEST_ROOT/writable-prefix"
mkdir -m 700 -p "$writable_prefix/bin"
for binary in initdb pg_ctl psql; do
  printf '#!/usr/bin/env bash\nexit 0\n' >"$writable_prefix/bin/$binary"
  chmod 700 "$writable_prefix/bin/$binary"
done
printf '#!/usr/bin/env bash\nprintf "postgres (PostgreSQL) 16.14\\n"\n' >"$writable_prefix/bin/postgres"
chmod 700 "$writable_prefix/bin/postgres"
chmod 777 "$writable_prefix"
prefix_test cross-user-writable-directory "$writable_prefix" 1

special_prefix="$TEST_ROOT/prefix with spaces ; dollar-\$(literal)"
mkdir -m 700 -p "$special_prefix/bin"
for binary in initdb pg_ctl psql; do
  printf '#!/usr/bin/env bash\nexit 0\n' >"$special_prefix/bin/$binary"
  chmod 700 "$special_prefix/bin/$binary"
done
printf '#!/usr/bin/env bash\nprintf "postgres (PostgreSQL) 16.14\\n"\n' >"$special_prefix/bin/postgres"
chmod 700 "$special_prefix/bin/postgres"
prefix_test quoted-special-path "$special_prefix" 0

for dsn in \
  'postgresql://postgres@localhost/postgres' \
  'postgresql://postgres@[::1]/postgres' \
  'postgresql://postgres@127.1/postgres' \
  'postgresql://postgres@local-alias.invalid/postgres' \
  'postgresql://postgres@/postgres?host=%2Ftmp' \
  'not-a-postgresql-url'; do
  dsn_log="$TEST_ROOT/external-dsn-$RANDOM.log"
  set +e
  IGRIS_PG16_PREFIX="$PG16_PREFIX" IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN="$dsn" \
    "$HELPER" >"$dsn_log" 2>&1
  dsn_status=$?
  set -e
  [[ "$dsn_status" -eq 2 ]] || fail "external DSN was not refused before use"
  assert_no_success "$dsn_log"
done
pass "external localhost, IPv6, socket, alias, and malformed DSNs are refused"

missing_identity_log="$TEST_ROOT/missing-identity.log"
set +e
IGRIS_CONNECTED_SMOKE_MODE=disposable \
  IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN='postgresql://postgres@localhost/postgres' \
  "$SMOKE" >"$missing_identity_log" 2>&1
missing_identity_status=$?
set -e
[[ "$missing_identity_status" -eq 2 ]] || fail "missing disposable identity was accepted"
grep -q 'missing or invalid run-specific cluster identity' "$missing_identity_log" || fail "missing identity refusal was not explicit"
pass "missing cluster identity refuses destructive smoke"

run_injected_stage_failure identity 2

unrelated_root="$(mktemp -d /tmp/igris-unrelated.XXXXXX)"
chmod 700 "$unrelated_root"
unrelated_data="$unrelated_root/data"
unrelated_socket="$unrelated_root/socket"
mkdir -m 700 -p "$unrelated_data" "$unrelated_socket"
unrelated_port="$(python3 -c 'import secrets; print(20000 + secrets.randbelow(40000))')"
"$PG16_PREFIX/bin/initdb" -D "$unrelated_data" --auth-local=trust --auth-host=reject \
  --locale=C --encoding=UTF8 --username=postgres --no-instructions >/dev/null
"$PG16_PREFIX/bin/pg_ctl" -D "$unrelated_data" \
  -o "-p ${unrelated_port} -k ${unrelated_socket} -c listen_addresses=''" -w start >/dev/null
unrelated_pid="$(sed -n '1p' "$unrelated_data/postmaster.pid")"
cleanup_unrelated() {
  if kill -0 "$unrelated_pid" 2>/dev/null; then
    "$PG16_PREFIX/bin/pg_ctl" -D "$unrelated_data" -m fast -w stop >/dev/null
  fi
  rm -rf -- "$unrelated_root"
}
trap 'cleanup_unrelated; cleanup_test_root' EXIT
"$PG16_PREFIX/bin/psql" -h "$unrelated_socket" -p "$unrelated_port" -U postgres -d postgres \
  -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE ROLE igris_app_runtime;
CREATE DATABASE igris_connected_smoke;
SQL
unrelated_dsn="postgresql://postgres@/postgres?host=$(python3 -c 'from urllib.parse import quote; import sys; print(quote(sys.argv[1], safe=""))' "$unrelated_socket")&port=${unrelated_port}"
set +e
IGRIS_PG16_PREFIX="$PG16_PREFIX" IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN="$unrelated_dsn" \
  "$HELPER" >"$TEST_ROOT/unrelated-refusal.log" 2>&1
unrelated_status=$?
set -e
[[ "$unrelated_status" -eq 2 ]] || fail "helper did not refuse the unrelated cluster"
role_still_present="$("$PG16_PREFIX/bin/psql" -h "$unrelated_socket" -p "$unrelated_port" -U postgres -d postgres -X -Atc "SELECT count(*) FROM pg_roles WHERE rolname = 'igris_app_runtime';")"
db_still_present="$("$PG16_PREFIX/bin/psql" -h "$unrelated_socket" -p "$unrelated_port" -U postgres -d postgres -X -Atc "SELECT count(*) FROM pg_database WHERE datname = 'igris_connected_smoke';")"
[[ "$role_still_present" == 1 && "$db_still_present" == 1 ]] || fail "unrelated role or database was modified"
cleanup_unrelated
trap cleanup_test_root EXIT
pass "an unrelated local cluster with matching legacy names remains untouched"

signal_test() {
  local signal_name="$1"
  local expected="$2"
  local log_file="$TEST_ROOT/signal-${signal_name}.log"
  python3 - "$HELPER" "$PG16_PREFIX" "$signal_name" "$expected" "$log_file" <<'PY'
import os
import signal
import subprocess
import sys
import time

helper, prefix, signal_name, expected, log_path = sys.argv[1:]
environment = os.environ.copy()
environment.update({
    "IGRIS_PG16_PREFIX": prefix,
    "IGRIS_PG16_ENABLE_TEST_HOOKS": "1",
    "IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES": "1",
    "IGRIS_PG16_TEST_PAUSE_STAGE": "bootstrap",
})
with open(log_path, "w+") as output:
    process = subprocess.Popen([helper], stdout=output, stderr=subprocess.STDOUT, env=environment)
    deadline = time.time() + 30
    while time.time() < deadline:
        output.flush()
        output.seek(0)
        if "test-only pause stage=bootstrap" in output.read():
            break
        if process.poll() is not None:
            raise SystemExit(f"helper exited before signal: {process.returncode}")
        time.sleep(0.1)
    else:
        process.kill()
        raise SystemExit("helper did not reach signal pause")
    process.send_signal(getattr(signal, "SIG" + signal_name))
    status = process.wait(timeout=30)
    if status != int(expected):
        raise SystemExit(f"{signal_name} returned {status}, expected {expected}")
PY
  assert_no_success "$log_file"
  local state_dir
  state_dir="$(state_dir_from_log "$log_file")"
  [[ -n "$state_dir" && ! -e "$state_dir" ]] || fail "$signal_name did not clean its state"
  pass "$signal_name preserves deterministic status $expected and cleans up"
}

signal_test INT 130
signal_test TERM 143

concurrent_one="$TEST_ROOT/concurrent-one.log"
concurrent_two="$TEST_ROOT/concurrent-two.log"
IGRIS_PG16_PREFIX="$PG16_PREFIX" IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
  IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES=1 "$HELPER" >"$concurrent_one" 2>&1 &
pid_one=$!
IGRIS_PG16_PREFIX="$PG16_PREFIX" IGRIS_PG16_ENABLE_TEST_HOOKS=1 \
  IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES=1 "$HELPER" >"$concurrent_two" 2>&1 &
pid_two=$!
wait "$pid_one"
wait "$pid_two"
grep -q '^result=connected_pg16_local_validate_ok$' "$concurrent_one" || fail "first concurrent helper failed"
grep -q '^result=connected_pg16_local_validate_ok$' "$concurrent_two" || fail "second concurrent helper failed"
state_one="$(state_dir_from_log "$concurrent_one")"
state_two="$(state_dir_from_log "$concurrent_two")"
[[ -n "$state_one" && -n "$state_two" && "$state_one" != "$state_two" ]] || fail "concurrent runs reused state"
[[ ! -e "$state_one" && ! -e "$state_two" ]] || fail "concurrent runs left state behind"
pass "concurrent helper runs use isolated state and both clean up"

if rg -n '/tmp/igris-pg16-prefix\.path' scripts/connected >/dev/null; then
  fail "predictable shared prefix state path remains in executable scripts"
fi
pass "predictable shared prefix state path is absent"

printf 'result=pg16_local_validate_security_tests_ok\n'
