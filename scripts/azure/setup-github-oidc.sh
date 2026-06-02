#!/usr/bin/env bash
#
# Creates the Azure Entra app registration, service principal, GitHub Actions
# federated credentials, and resource-group-scoped role assignment for manual
# staging and production deploy workflows. No client secret is created or stored.
set -euo pipefail

AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-igris-prod}"
AZURE_ROLE="${AZURE_ROLE:-Container Apps Contributor}"
AZURE_CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-cae-igris-prod}"
AZURE_API_APP="${AZURE_API_APP:-igris-api}"
AZURE_CONSOLE_APP="${AZURE_CONSOLE_APP:-igris-console}"
APP_NAME="${APP_NAME:-igris-github-actions-azure-deploy}"
GITHUB_ENVIRONMENTS="${GITHUB_ENVIRONMENTS:-staging production}"

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

for github_environment in ${GITHUB_ENVIRONMENTS}; do
  case "${github_environment}" in
    staging|production) ;;
    *)
      echo "ERROR: GITHUB_ENVIRONMENTS may only contain staging and production." >&2
      exit 1
      ;;
  esac

  credential_name="github-${github_environment}-environment"
  subject="repo:${GITHUB_OWNER}/${GITHUB_REPO}:environment:${github_environment}"

  echo ">> Ensuring federated credential for ${subject}..."
  existing_credential="$(
    az ad app federated-credential list \
      --id "${object_id}" \
      --query "[?name=='${credential_name}'].name | [0]" \
      -o tsv
  )"

  if [ -z "${existing_credential}" ]; then
    credential_json="$(
      jq -n \
        --arg name "${credential_name}" \
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
done

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
>> Add these GitHub environment variables to both 'staging' and 'production':
AZURE_CLIENT_ID=${app_id}
AZURE_TENANT_ID=${AZURE_TENANT_ID}
AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}
AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}
AZURE_CONTAINERAPPS_ENV=${AZURE_CONTAINERAPPS_ENV}
AZURE_API_APP=${AZURE_API_APP}
AZURE_CONSOLE_APP=${AZURE_CONSOLE_APP}

>> Add deployment secrets separately in GitHub. This script does not print secrets.
>> Configure required reviewers on the GitHub 'production' environment.
EOF
