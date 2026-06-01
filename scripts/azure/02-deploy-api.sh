#!/usr/bin/env bash
#
# 02 — Deploy the Go Overture API as a Container App (igris-api).
#
# Prereq: scripts/azure/01-create-containerapps-env.sh has run, the GHCR image
# exists (build-container-images workflow), and the Neon database is migrated
# (docs/LIVE_MODE_BRINGUP.md). Idempotent: re-running updates the app in place.
#
# Required env (export before running):
#   NEON_POOLED_URL   Neon *pooled* connection string (the running app uses this)
#   API_IMAGE         e.g. ghcr.io/igris-inertial/system/igris-api:sha-abc1234
# Optional env:
#   AZ_RG (default rg-igris-prod)  AZ_LOCATION (southeastasia)  AZ_ENV (cae-igris-prod)
#   APP_NAME (default igris-api)   API_PORT (default 8080)
#   CONSOLE_ORIGIN (default https://app.igrisinertial.com) — CORS allow-origin
#   GHCR_USERNAME + GHCR_TOKEN     only if the GHCR package is PRIVATE
#                                  (read:packages PAT). If the package is public,
#                                  leave both unset — no registry auth needed.
#   PROVIDER_MODE (default hybrid) — "hybrid" boots the actions-first deploy with
#                                  no LLM provider key. For real inference set
#                                  PROVIDER_MODE=real and add OPENAI_API_KEY /
#                                  ANTHROPIC_API_KEY as secrets (see below).
#
# Secrets are passed via `--secrets` and referenced with `secretref:` — values
# are never printed by this script.
#
# Cost guardrails: external ingress, 0.25 vCPU / 0.5Gi, min-replicas 0 (scale to
# zero), max-replicas 1.
#
# Next: scripts/azure/03-deploy-console.sh
set -euo pipefail

AZ_RG="${AZ_RG:-rg-igris-prod}"
AZ_ENV="${AZ_ENV:-cae-igris-prod}"
APP_NAME="${APP_NAME:-igris-api}"
API_PORT="${API_PORT:-8080}"
PROVIDER_MODE="${PROVIDER_MODE:-hybrid}"
CONSOLE_ORIGIN="${CONSOLE_ORIGIN:-https://app.igrisinertial.com}"

require() { [ -n "${!1:-}" ] || { echo "ERROR: required env var $1 is not set." >&2; exit 1; }; }
require NEON_POOLED_URL
require API_IMAGE

command -v az >/dev/null 2>&1 || { echo "ERROR: az CLI not found." >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERROR: run 'az login' first." >&2; exit 1; }
az extension add --name containerapp --upgrade --only-show-errors 1>/dev/null

# Optional private-GHCR auth.
REGISTRY_ARGS=()
if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo ">> Using GHCR registry credentials for user '${GHCR_USERNAME}'."
  REGISTRY_ARGS=(--registry-server ghcr.io --registry-username "${GHCR_USERNAME}" --registry-password "${GHCR_TOKEN}")
else
  echo ">> No GHCR credentials provided — assuming the image package is public."
  echo "   (If the pull fails with 'unauthorized', make the GHCR package public"
  echo "    OR set GHCR_USERNAME + GHCR_TOKEN, OR use scripts/azure/fallback-acr.md.)"
fi

# PROVIDER_MODE=hybrid/mock requires an explicit production override flag.
PROVIDER_ENV=("PROVIDER_MODE=${PROVIDER_MODE}")
if [ "${PROVIDER_MODE}" != "real" ]; then
  PROVIDER_ENV+=("ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true")
fi

COMMON_ENV=(
  "ENV=production"
  "ENABLE_PERSISTENCE=true"
  "REQUIRE_AUTH_FOR_INFERENCE=true"
  "PORT=${API_PORT}"
  "CORS_ALLOWED_ORIGINS=${CONSOLE_ORIGIN}"
  "ALLOWED_ORIGINS=${CONSOLE_ORIGIN}"
  "DATABASE_URL=secretref:database-url"
  "${PROVIDER_ENV[@]}"
)

if az containerapp show --name "${APP_NAME}" --resource-group "${AZ_RG}" >/dev/null 2>&1; then
  echo ">> Updating existing Container App '${APP_NAME}'..."
  az containerapp secret set --name "${APP_NAME}" --resource-group "${AZ_RG}" \
    --secrets "database-url=${NEON_POOLED_URL}" --only-show-errors 1>/dev/null
  az containerapp update --name "${APP_NAME}" --resource-group "${AZ_RG}" \
    --image "${API_IMAGE}" \
    --set-env-vars "${COMMON_ENV[@]}" \
    --min-replicas 0 --max-replicas 1 \
    --only-show-errors 1>/dev/null
else
  echo ">> Creating Container App '${APP_NAME}'..."
  az containerapp create \
    --name "${APP_NAME}" \
    --resource-group "${AZ_RG}" \
    --environment "${AZ_ENV}" \
    --image "${API_IMAGE}" \
    ${REGISTRY_ARGS[@]+"${REGISTRY_ARGS[@]}"} \
    --target-port "${API_PORT}" \
    --ingress external \
    --cpu 0.25 --memory 0.5Gi \
    --min-replicas 0 --max-replicas 1 \
    --secrets "database-url=${NEON_POOLED_URL}" \
    --env-vars "${COMMON_ENV[@]}" \
    --only-show-errors 1>/dev/null
fi

FQDN="$(az containerapp show --name "${APP_NAME}" --resource-group "${AZ_RG}" --query properties.configuration.ingress.fqdn -o tsv)"
echo ">> Deployed. API FQDN: https://${FQDN}"
echo ">> Verify:  curl -fsS https://${FQDN}/healthz   (liveness)"
echo ">>          curl -fsS https://${FQDN}/readyz    (DB-aware readiness)"
echo ">> Use this URL as OVERTURE_API_BASE_URL for the console until the custom"
echo ">> domain api.igrisinertial.com is bound (docs/AZURE_DNS.md):"
echo ">>   export OVERTURE_API_BASE_URL=https://${FQDN}"
echo ">> Next: scripts/azure/03-deploy-console.sh"
