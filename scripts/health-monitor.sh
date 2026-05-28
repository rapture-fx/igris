#!/usr/bin/env bash
# Igris Health Monitor
# Runs as a cron job every minute. Sends Telegram alerts only on state changes
# (down → alert once, recovery → alert once — no spam).
#
# Cron setup (run as wira on VPS):
#   crontab -e
#   * * * * * /home/wira/igris/scripts/health-monitor.sh >> /var/log/igris-health.log 2>&1

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
COMPOSE_FILE="/home/wira/igris/docker-compose.production.yml"
STATE_DIR="/tmp/igris-health-state"
mkdir -p "$STATE_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────

tg() {
    local msg="$1"
    [ -z "$BOT_TOKEN" ] && { echo "[warn] TELEGRAM_BOT_TOKEN not set"; return; }
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -d chat_id="${CHAT_ID}" \
        -d text="${msg}" \
        -d parse_mode="HTML" \
        -o /dev/null
}

# Only alert on state change. Returns 0 if alert should fire, 1 if already in that state.
state_changed() {
    local service="$1" status="$2"   # status: "up" or "down"
    local state_file="${STATE_DIR}/${service}"
    local prev="up"
    [ -f "$state_file" ] && prev=$(cat "$state_file")
    echo "$status" > "$state_file"
    [ "$prev" != "$status" ]
}

check_http() {
    local url="$1"
    curl -fsS --max-time 5 "$url" -o /dev/null 2>/dev/null
}

check_container() {
    local name="$1"
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
    # Accept healthy or containers without healthcheck that are running
    if [ "$health" = "healthy" ]; then
        echo "up"
    elif [ "$health" = "missing" ]; then
        echo "down"
    else
        local running
        running=$(docker inspect --format='{{.State.Running}}' "$name" 2>/dev/null || echo "false")
        [ "$running" = "true" ] && echo "up" || echo "down"
    fi
}

# ── Checks ────────────────────────────────────────────────────────────────────

TIMESTAMP=$(date '+%Y-%m-%d %H:%M UTC')

declare -A SERVICES=(
    ["postgres"]="igris-postgres"
    ["cache"]="igris-dragonfly"
    ["api"]="igris-overture"
    ["caddy"]="igris-caddy"
)

for svc in "${!SERVICES[@]}"; do
    container="${SERVICES[$svc]}"
    status=$(check_container "$container")
    if state_changed "$svc" "$status"; then
        if [ "$status" = "down" ]; then
            tg "🔴 <b>Igris — $svc DOWN</b>
Container <code>$container</code> is not healthy.
${TIMESTAMP}"
        else
            tg "🟢 <b>Igris — $svc recovered</b>
Container <code>$container</code> is back up.
${TIMESTAMP}"
        fi
    fi
done

# ── HTTP endpoint checks ───────────────────────────────────────────────────────

declare -A ENDPOINTS=(
    ["api_health"]="http://localhost:8080/healthz"
    ["console_health"]="http://127.0.0.1:3005/"
    ["public_console"]="https://console.igrisinertial.com"
    ["public_api"]="https://overture.igrisinertial.com/healthz"
)

for name in "${!ENDPOINTS[@]}"; do
    url="${ENDPOINTS[$name]}"
    if check_http "$url"; then
        status="up"
    else
        status="down"
    fi
    if state_changed "http_${name}" "$status"; then
        if [ "$status" = "down" ]; then
            tg "🔴 <b>Igris — endpoint unreachable</b>
<code>${url}</code> is not responding.
${TIMESTAMP}"
        else
            tg "🟢 <b>Igris — endpoint recovered</b>
<code>${url}</code> is back online.
${TIMESTAMP}"
        fi
    fi
done

# ── Auth endpoint sanity check ─────────────────────────────────────────────────
# Expects a 200 or 401 (both mean the auth server is alive). 5xx = broken.

AUTH_URL="https://console.igrisinertial.com/api/auth/get-session"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$AUTH_URL" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" =~ ^5 ]] || [ "$HTTP_CODE" = "000" ]; then
    auth_status="down"
else
    auth_status="up"
fi

if state_changed "auth_endpoint" "$auth_status"; then
    if [ "$auth_status" = "down" ]; then
        tg "🔴 <b>Igris — Auth server ERROR</b>
<code>/api/auth/get-session</code> returned HTTP <b>${HTTP_CODE}</b>.
Better Auth may be crashing.
${TIMESTAMP}"
    else
        tg "🟢 <b>Igris — Auth server recovered</b>
<code>/api/auth/get-session</code> responding normally (HTTP ${HTTP_CODE}).
${TIMESTAMP}"
    fi
fi
