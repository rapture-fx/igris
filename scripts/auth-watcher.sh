#!/usr/bin/env bash
# Igris Auth Error Watcher
# Tails the console container logs and fires a Telegram alert when Better Auth
# logs a server-side error (5xx, exception, or crash).
#
# Run as a systemd service — see scripts/auth-watcher.service
# Or manually: nohup /home/wira/igris/scripts/auth-watcher.sh &

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
COOLDOWN=120   # seconds between alerts for same error type (avoid spam)

tg() {
    [ -z "$BOT_TOKEN" ] && return
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -d chat_id="${CHAT_ID}" \
        -d text="$1" \
        -d parse_mode="HTML" \
        -o /dev/null
}

LAST_AUTH_ALERT=0
LAST_CRASH_ALERT=0

echo "[auth-watcher] Starting — watching igris-console logs..."

docker logs -f igris-console 2>&1 | while IFS= read -r line; do
    NOW=$(date +%s)
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M UTC')

    # Auth errors — Better Auth 5xx or unhandled exception
    if echo "$line" | grep -qiE '"status":\s*5[0-9]{2}|BetterAuthError|unhandledRejection|FATAL|panic'; then
        if (( NOW - LAST_AUTH_ALERT > COOLDOWN )); then
            LAST_AUTH_ALERT=$NOW
            SNIPPET=$(echo "$line" | cut -c1-200)
            tg "⚠️ <b>Igris — Auth error detected</b>
<code>${SNIPPET}</code>
${TIMESTAMP}"
        fi
    fi

    # Container crash / Next.js hard crash
    if echo "$line" | grep -qiE 'SIGTERM|SIGKILL|Error: Cannot find module|SyntaxError|ReferenceError.*is not defined'; then
        if (( NOW - LAST_CRASH_ALERT > COOLDOWN )); then
            LAST_CRASH_ALERT=$NOW
            SNIPPET=$(echo "$line" | cut -c1-200)
            tg "💥 <b>Igris — Console crash detected</b>
<code>${SNIPPET}</code>
${TIMESTAMP}"
        fi
    fi
done
