#!/usr/bin/env bash
# Igris Inertial — cURL reference
# Set IGRIS_API_KEY before running any command.
#
# Usage:
#   export IGRIS_API_KEY=igris_...
#   bash curl_reference.sh

set -euo pipefail

BASE="https://overture.igrisinertial.com"
KEY="${IGRIS_API_KEY:?Set IGRIS_API_KEY first}"

echo "=== 1. Health check (no auth) ==="
curl -fsSL "${BASE}/healthz"
echo

echo "=== 2. Basic inference ==="
curl -fsSL -X POST "${BASE}/v1/infer" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Reply in one sentence: what is Thompson Sampling?"}],
    "max_tokens": 64
  }'
echo

echo "=== 3. Register a runtime instance ==="
curl -fsSL -X POST "${BASE}/api/v1/runtime/register" \
  -H "X-API-Key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "curl-test-device",
    "platform": "linux-amd64",
    "version": "0.1.0"
  }'
echo

echo "=== 4. List fleet devices ==="
curl -fsSL "${BASE}/v1/devices" \
  -H "X-API-Key: ${KEY}"
echo

echo "=== 5. Get BT state for an agent ==="
AGENT_ID="${IGRIS_AGENT_ID:-placeholder-agent-id}"
curl -fsSL "${BASE}/v1/agents/${AGENT_ID}/bt-state" \
  -H "X-API-Key: ${KEY}"
echo

echo "=== 6. List policy bounds ==="
curl -fsSL "${BASE}/v1/policy/bounds" \
  -H "X-API-Key: ${KEY}"
echo

echo "=== 7. Download runtime checksum (public, no auth) ==="
curl -fsSL "${BASE}/v1/runtime/checksum?platform=linux-amd64"
echo

echo "Done."
