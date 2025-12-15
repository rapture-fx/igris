#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BIN="${BIN:-./target/release/igris-runtime}"

echo "== validate config =="
"$BIN" validate-config --config ./config.json5

echo "== status (expects server running on :8080) =="
"$BIN" status --url http://localhost:8080 || true

echo "== chat (non-stream) =="
"$BIN" chat "Say hello in one sentence." --url http://localhost:8080 --model gpt-4 || true

echo "== chat (stream) =="
"$BIN" chat "Stream 3 short words." --url http://localhost:8080 --stream || true


