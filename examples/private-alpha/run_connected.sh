#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [[ -z "${IGRIS_API_URL:-}" || -z "${IGRIS_API_KEY:-}" ]]; then
  printf '%s\n' "Set both IGRIS_API_URL and IGRIS_API_KEY for a disposable test endpoint." >&2
  exit 2
fi
if [[ -z "${IGRIS_HOME:-}" ]]; then
  IGRIS_HOME=$(mktemp -d "${TMPDIR:-/tmp}/igris-private-alpha-connected.XXXXXX")
  export IGRIS_HOME
fi

python "$SCRIPT_DIR/refund_demo.py"
igris verify "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"

SYNC_OUTPUT=$(igris evidence sync "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem")
printf '%s\n' "$SYNC_OUTPUT"
BATCH_ID=$(printf '%s\n' "$SYNC_OUTPUT" | python -c 'import re, sys; match = re.search(r"^  batch ([^:]+):", sys.stdin.read(), re.MULTILINE); print(match.group(1) if match else "")')
if [[ -z "$BATCH_ID" ]]; then
  printf '%s\n' "No new batch id was returned; evidence may already be up to date." >&2
  exit 1
fi
igris evidence status "$BATCH_ID"
