#!/usr/bin/env bash
#
# Auth bridge smoke — validates console customer-session gate and auth proxy
# without requiring production secrets. Optional env vars enable deeper checks.
#
# Required:
#   CONSOLE_BASE   e.g. http://localhost:3100 or https://console.igrisinertial.com
#
# Optional:
#   LANDING_BASE   e.g. http://localhost:3000 (for redirect target checks)
#   API_BASE       e.g. https://api.igrisinertial.com (session probe via Overture)
#   ADMIN_USERNAME / ADMIN_PASSWORD   admin Basic fallback
#   SESSION_COOKIE  full Cookie header value for customer session checks
#                   e.g. better-auth.session_token=<signed-value>
#
# Secrets are never printed.
set -u

pass=0
fail=0
skip=0

ok()   { printf '  PASS %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  FAIL %s\n' "$1"; fail=$((fail + 1)); }
skip() { printf '  SKIP %s\n' "$1"; skip=$((skip + 1)); }

req() {
  if [ -z "${!1:-}" ]; then
    printf 'ERROR: required env var %s is not set.\n' "$1" >&2
    exit 2
  fi
}

code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

headers() {
  curl -sS -D - -o /dev/null "$@"
}

req CONSOLE_BASE
CONSOLE_BASE="${CONSOLE_BASE%/}"
LANDING_BASE="${LANDING_BASE:-}"
API_BASE="${API_BASE:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SESSION_COOKIE="${SESSION_COOKIE:-}"

printf '== Auth bridge smoke ==\n'
printf '  CONSOLE_BASE=%s\n' "$CONSOLE_BASE"
[ -n "$LANDING_BASE" ] && printf '  LANDING_BASE=%s\n' "$LANDING_BASE"
[ -n "$API_BASE" ] && printf '  API_BASE=%s\n' "$API_BASE"
[ -n "$ADMIN_USERNAME" ] && printf '  ADMIN_USERNAME=<set>\n'
[ -n "$SESSION_COOKIE" ] && printf '  SESSION_COOKIE=<set>\n'
echo

printf '== Health (no gate) ==\n'
c="$(code "$CONSOLE_BASE/up")"
if [ "$c" = "200" ]; then ok 'GET /up -> 200'; else bad "GET /up -> expected 200, got $c"; fi

printf '\n== Auth API proxy (no console gate) ==\n'
auth_code="$(code "$CONSOLE_BASE/api/auth/get-session")"
case "$auth_code" in
  200) ok 'GET /api/auth/get-session -> 200 (upstream reachable)' ;;
  503) ok 'GET /api/auth/get-session -> 503 (upstream not configured — expected pre-wiring)' ;;
  502) bad 'GET /api/auth/get-session -> 502 (upstream unreachable)' ;;
  *)   bad "GET /api/auth/get-session -> unexpected $auth_code" ;;
esac

printf '\n== Protected route without credentials ==\n'
home_code="$(code "$CONSOLE_BASE/home")"
home_hdr="$(headers "$CONSOLE_BASE/home")"
case "$home_code" in
  302)
    ok 'GET /home without session -> 302 redirect'
    if [ -n "$LANDING_BASE" ]; then
      if printf '%s' "$home_hdr" | grep -qi "location:.*auth"; then
        ok 'redirect targets landing /auth'
      else
        bad 'redirect does not target /auth'
      fi
    else
      skip 'redirect target check (set LANDING_BASE)'
    fi
    ;;
  401)
    ok 'GET /home without session -> 401 (admin-only gate)'
    if printf '%s' "$home_hdr" | grep -qi 'www-authenticate:.*basic'; then
      ok 'WWW-Authenticate Basic present'
    else
      bad 'expected WWW-Authenticate Basic header'
    fi
    ;;
  200)
    bad 'GET /home without session -> 200 (gate open — misconfigured)'
    ;;
  *)
    bad "GET /home without session -> unexpected $home_code"
    ;;
esac

if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
  printf '\n== Admin Basic fallback ==\n'
  admin_code="$(code -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" "$CONSOLE_BASE/home")"
  if [ "$admin_code" = "200" ]; then
    ok 'GET /home with Basic auth -> 200'
  else
    bad "GET /home with Basic auth -> expected 200, got $admin_code"
  fi
else
  printf '\n== Admin Basic fallback ==\n'
  skip 'ADMIN_USERNAME / ADMIN_PASSWORD not set'
fi

if [ -n "$SESSION_COOKIE" ]; then
  printf '\n== Customer session ==\n'
  sess_code="$(code -H "Cookie: $SESSION_COOKIE" "$CONSOLE_BASE/home")"
  if [ "$sess_code" = "200" ]; then
    ok 'GET /home with session cookie -> 200'
  else
    bad "GET /home with session cookie -> expected 200, got $sess_code"
  fi

  bad_code="$(code -H 'Cookie: better-auth.session_token=invalid-smoke-token' "$CONSOLE_BASE/home")"
  case "$bad_code" in
    302|401) ok "GET /home with invalid cookie -> $bad_code (denied)" ;;
    *) bad "GET /home with invalid cookie -> expected 302/401, got $bad_code" ;;
  esac

  if [ -n "$API_BASE" ]; then
    API_BASE="${API_BASE%/}"
    proj_code="$(code -H "Cookie: $SESSION_COOKIE" "$API_BASE/v1/project")"
    if [ "$proj_code" = "200" ]; then
      ok 'Overture GET /v1/project with session cookie -> 200'
    else
      bad "Overture GET /v1/project with session cookie -> expected 200, got $proj_code"
    fi
    noauth_code="$(code "$API_BASE/v1/project")"
    if [ "$noauth_code" = "401" ]; then
      ok 'Overture GET /v1/project without cookie -> 401'
    else
      bad "Overture GET /v1/project without cookie -> expected 401, got $noauth_code"
    fi
  else
    skip 'Overture session probe (set API_BASE)'
  fi
else
  printf '\n== Customer session ==\n'
  skip 'SESSION_COOKIE not set'
fi

printf '\n== Summary ==\n'
printf '  pass=%s fail=%s skip=%s\n' "$pass" "$fail" "$skip"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
exit 0