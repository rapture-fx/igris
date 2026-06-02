#!/usr/bin/env bash
#
# Creates the Azure Entra app registration, service principal, GitHub Actions
# federated credential, and resource-group-scoped role assignment for manual
# production deploy workflows. No client secret is created or stored.
set -euo pipefail

AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-igris-prod}"
AZURE_ROLE="${AZURE_ROLE:-Container Apps Contributor}"
AZURE_CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-cae-igris-prod}"
AZURE_API_APP="${AZURE_API_APP:-igris-api}"
AZURE_CONSOLE_APP="${AZURE_CONSOLE_APP:-igris-console}"
APP_NAME="${APP_NAME:-igris-github-actions-production}"
FEDERATED_CREDENTIAL_NAME="${FEDERATED_CREDENTIAL_NAME:-github-production-environment}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"

require() {
  if [ -z "${!1:-}" ]; then
    echo "ERROR: required env var $1 is not set." >&2
    exit 1
  fi
}

require GITHUB_OWNER
require GITHUB_REPO

command -v az >/dev/null 2>&1 || { echo "ERROR: az CLI not found." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not found." >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERROR: run 'az login' first." >&2; exit 1; }

AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-$(az account show --query tenantId -o tsv)}"

scope="/subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/${AZURE_RESOURCE_GROUP}"
subject="repo:${GITHUB_OWNER}/${GITHUB_REPO}:environment:${GITHUB_ENVIRONMENT}"

echo ">> Ensuring Entra app registration '${APP_NAME}'..."
app_id="$(
  az ad app list \
    --display-name "${APP_NAME}" \
    --query '[0].appId' \
    -o tsv
)"

if [ -z "${app_id}" ]; then
  app_id="$(az ad app create --display-name "${APP_NAME}" --query appId -o tsv)"
fi

object_id="$(az ad app show --id "${app_id}" --query id -o tsv)"

echo ">> Ensuring service principal..."
sp_object_id="$(
  az ad sp show --id "${app_id}" --query id -o tsv 2>/dev/null || true
)"
if [ -z "${sp_object_id}" ]; then
  sp_object_id="$(az ad sp create --id "${app_id}" --query id -o tsv)"
fi

echo ">> Ensuring federated credential for ${subject}..."
existing_credential="$(
  az ad app federated-credential list \
    --id "${object_id}" \
    --query "[?name=='${FEDERATED_CREDENTIAL_NAME}'].name | [0]" \
    -o tsv
)"

if [ -z "${existing_credential}" ]; then
  credential_json="$(
    jq -n \
      --arg name "${FEDERATED_CREDENTIAL_NAME}" \
      --arg subject "${subject}" \
      '{
        name: $name,
        issuer: "https://token.actions.githubusercontent.com",
        subject: $subject,
        audiences: ["api://AzureADTokenExchange"]
      }'
  )"
  az ad app federated-credential create \
    --id "${object_id}" \
    --parameters "${credential_json}" \
    --only-show-errors 1>/dev/null
fi

echo ">> Ensuring '${AZURE_ROLE}' role assignment at ${scope}..."
assignment_count="$(
  az role assignment list \
    --assignee "${app_id}" \
    --role "${AZURE_ROLE}" \
    --scope "${scope}" \
    --query 'length(@)' \
    -o tsv
)"

if [ "${assignment_count}" = "0" ]; then
  az role assignment create \
    --assignee "${app_id}" \
    --role "${AZURE_ROLE}" \
    --scope "${scope}" \
    --only-show-errors 1>/dev/null
fi

cat <<EOF
>> Add these GitHub environment variables to '${GITHUB_ENVIRONMENT}':
AZURE_CLIENT_ID=${app_id}
AZURE_TENANT_ID=${AZURE_TENANT_ID}
AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}
AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}
AZURE_CONTAINERAPPS_ENV=${AZURE_CONTAINERAPPS_ENV}
AZURE_API_APP=${AZURE_API_APP}
AZURE_CONSOLE_APP=${AZURE_CONSOLE_APP}

>> Add deployment secrets separately in GitHub. This script does not print secrets.
EOF
