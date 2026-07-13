#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [[ -z "${IGRIS_ALPHA_TEST_API_URL:-}" || -z "${IGRIS_ALPHA_TEST_API_KEY:-}" ]]; then
  printf '%s\n' "Connected validation requires IGRIS_ALPHA_TEST_API_URL and IGRIS_ALPHA_TEST_API_KEY." >&2
  exit 2
fi
exec python3 -u "$SCRIPT_DIR/validate_private_alpha.py" --connected
