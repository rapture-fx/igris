#!/usr/bin/env bash
set -euo pipefail

# Read-only launch schema attestation wrapper.
# Requires either IGRIS_NEON_SCHEMA_ATTESTATION_DSN or DATABASE_URL. The DSN is
# never printed. Use a direct Neon connection for schema attestation, not a
# pooled connection used by application traffic.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$ROOT_DIR/igris-overture/database/attestation/verify_launch_schema.sql"
DSN="${IGRIS_NEON_SCHEMA_ATTESTATION_DSN:-${DATABASE_URL:-}}"

if [[ -z "$DSN" ]]; then
  echo "set IGRIS_NEON_SCHEMA_ATTESTATION_DSN or DATABASE_URL to run launch schema attestation" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run launch schema attestation" >&2
  exit 2
fi

export PGOPTIONS="${PGOPTIONS:+$PGOPTIONS }-c default_transaction_read_only=on"

output="$(psql "$DSN" -X -v ON_ERROR_STOP=1 -f "$SQL_FILE")"
printf '%s\n' "$output"

if printf '%s\n' "$output" | grep -q '^FAIL|'; then
  echo "launch schema attestation failed" >&2
  exit 1
fi

echo "launch schema attestation passed"
