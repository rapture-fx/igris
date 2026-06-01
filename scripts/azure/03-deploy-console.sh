#!/usr/bin/env bash
#
# 03 — Deploy the Rails console as a Container App (igris-console).
#
# Prereq: 02-deploy-api.sh has produced an API FQDN, the GHCR console image
# exists, and a console service key was minted (docs/LIVE_MODE_BRINGUP.md,
# `igris-overture tenant-key`). Idempotent: re-running updates in place.
#
# Required env (export before running):
#   CONSOLE_IMAGE          e.g. ghcr.io/igris-inertial/system/igris-console:sha-abc1234
#   OVERTURE_API_BASE_URL  the API FQDN from step 02 (https://igris-api.<region>.azurecontainerapps.io)
#                          or https://api.igrisinertial.com once DNS is bound
#   OVERTURE_API_KEY       igris_… console service key (minted via tenant-key)
#   RAILS_SECRET_KEY_BASE  output of `bin/rails secret` (or `openssl rand -hex 64`)
#   ADMIN_USERNAME         console front-door HTTP Basic username
#   ADMIN_PASSWORD         console front-door HTTP Basic password (long random)
# Optional env:
#   AZ_RG (rg-igris-prod)  AZ_ENV (cae-igris-prod)  APP_NAME (igris-console)
#   CONSOLE_PORT (3100)    OVERTURE_PUBLIC_API_URL (defaults to OVERTURE_API_BASE_URL)
#   APP_HOST (app.igrisinertial.com)
#   GHCR_USERNAME + GHCR_TOKEN  only if the GHCR package is PRIVATE
#
# Secrets (SECRET_KEY_BASE, OVERTURE_API_KEY, ADMIN_PASSWORD) are passed via
# `--secrets` and referenced with `secretref:` — never printed by this script.
#
# Cost guardrails: external ingress, 0.25 vCPU / 0.5Gi, min-replicas 0, max 1.
set -euo pipefail

AZ_RG="${AZ_RG:-rg-igris-prod}"
AZ_ENV="${AZ_ENV:-cae-igris-prod}"
APP_NAME="${APP_NAME:-igris-console}"
CONSOLE_PORT="${CONSOLE_PORT:-3100}"
APP_HOST="${APP_HOST:-app.igrisinertial.com}"

require() { [ -n "${!1:-}" ] || { echo "ERROR: required env var $1 is not set." >&2; exit 1; }; }
require CONSOLE_IMAGE
require OVERTURE_API_BASE_URL
require OVERTURE_API_KEY
require RAILS_SECRET_KEY_BASE
require ADMIN_USERNAME
require ADMIN_PASSWORD

OVERTURE_PUBLIC_API_URL="${OVERTURE_PUBLIC_API_URL:-$OVERTURE_API_BASE_URL}"

case "${OVERTURE_API_KEY}" in
  igris_*) : ;;
  *) echo "ERROR: OVERTURE_API_KEY must be an igris_… service key (got a different prefix)." >&2; exit 1 ;;
esac

command -v az >/dev/null 2>&1 || { echo "ERROR: az CLI not found." >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERROR: run 'az login' first." >&2; exit 1; }
az extension add --name containerapp --upgrade --only-show-errors 1>/dev/null

REGISTRY_ARGS=()
if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  REGISTRY_ARGS=(--registry-server ghcr.io --registry-username "${GHCR_USERNAME}" --registry-password "${GHCR_TOKEN}")
fi

# Non-secret env. Secrets are wired separately via secretref.
PUBLIC_ENV=(
  "RAILS_ENV=production"
  "RAILS_LOG_TO_STDOUT=1"
  "RAILS_SERVE_STATIC_FILES=1"
  "PORT=${CONSOLE_PORT}"
  "APP_HOST=${APP_HOST}"
  "OVERTURE_API_BASE_URL=${OVERTURE_API_BASE_URL}"
  "OVERTURE_PUBLIC_API_URL=${OVERTURE_PUBLIC_API_URL}"
  "ADMIN_USERNAME=${ADMIN_USERNAME}"
  "SECRET_KEY_BASE=secretref:rails-secret-key-base"
  "OVERTURE_API_KEY=secretref:overture-api-key"
  "ADMIN_PASSWORD=secretref:admin-password"
)
SECRETS=(
  "rails-secret-key-base=${RAILS_SECRET_KEY_BASE}"
  "overture-api-key=${OVERTURE_API_KEY}"
  "admin-password=${ADMIN_PASSWORD}"
)

if az containerapp show --name "${APP_NAME}" --resource-group "${AZ_RG}" >/dev/null 2>&1; then
  echo ">> Updating existing Container App '${APP_NAME}'..."
  az containerapp secret set --name "${APP_NAME}" --resource-group "${AZ_RG}" \
    --secrets "${SECRETS[@]}" --only-show-errors 1>/dev/null
  az containerapp update --name "${APP_NAME}" --resource-group "${AZ_RG}" \
    --image "${CONSOLE_IMAGE}" \
    --set-env-vars "${PUBLIC_ENV[@]}" \
    --min-replicas 0 --max-replicas 1 \
    --only-show-errors 1>/dev/null
else
  echo ">> Creating Container App '${APP_NAME}'..."
  az containerapp create \
    --name "${APP_NAME}" \
    --resource-group "${AZ_RG}" \
    --environment "${AZ_ENV}" \
    --image "${CONSOLE_IMAGE}" \
    ${REGISTRY_ARGS[@]+"${REGISTRY_ARGS[@]}"} \
    --target-port "${CONSOLE_PORT}" \
    --ingress external \
    --cpu 0.25 --memory 0.5Gi \
    --min-replicas 0 --max-replicas 1 \
    --secrets "${SECRETS[@]}" \
    --env-vars "${PUBLIC_ENV[@]}" \
    --only-show-errors 1>/dev/null
fi

FQDN="$(az containerapp show --name "${APP_NAME}" --resource-group "${AZ_RG}" --query properties.configuration.ingress.fqdn -o tsv)"
echo ">> Deployed. Console FQDN: https://${FQDN}"
echo ">> Verify:  curl -fsS https://${FQDN}/up   (expect: ok)"
echo ">> Open https://${FQDN} in a browser — front-door Basic auth will prompt."
echo ">> Then run the smoke test: see SMOKE_LIVE_MODE.md"
echo ">> Bind app.igrisinertial.com next: docs/AZURE_DNS.md"
