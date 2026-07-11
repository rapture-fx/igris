#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# Embedded means both Connected variables are absent, not merely empty.
unset IGRIS_API_URL IGRIS_API_KEY
if [[ -z "${IGRIS_HOME:-}" ]]; then
  IGRIS_HOME=$(mktemp -d "${TMPDIR:-/tmp}/igris-private-alpha.XXXXXX")
  export IGRIS_HOME
fi

python "$SCRIPT_DIR/refund_demo.py"
igris key-info
igris verify "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"
python "$SCRIPT_DIR/inspect_journal.py" "$IGRIS_HOME/journal.jsonl"
