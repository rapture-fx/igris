#!/usr/bin/env bash
#
# 01 — Create the Azure Container Apps environment (Consumption plan).
#
# Run once, after `az login`. Idempotent: re-running is safe. Creates only:
#   - resource providers (Microsoft.App, Microsoft.OperationalInsights)
#   - a Container Apps managed environment in rg-igris-prod / southeastasia
#
# It creates NO VM, AKS, App Service, Azure Postgres, Storage Account, NAT
# Gateway, Application Gateway, private endpoint, or Container Registry.
# The database is Neon (external) — nothing here provisions one.
#
# Cost note: `az containerapp env create` auto-creates a small Log Analytics
# workspace for container logs (well within the free 5 GB/mo tier at this
# volume). To run with zero log ingestion instead, append:
#     --logs-destination none
# to the `az containerapp env create` call below.
#
# Next: scripts/azure/02-deploy-api.sh
set -euo pipefail

AZ_RG="${AZ_RG:-rg-igris-prod}"
AZ_LOCATION="${AZ_LOCATION:-southeastasia}"
AZ_ENV="${AZ_ENV:-cae-igris-prod}"

command -v az >/dev/null 2>&1 || { echo "ERROR: az CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli" >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERROR: not logged in. Run: az login" >&2; exit 1; }

echo ">> Subscription: $(az account show --query name -o tsv)"
echo ">> Resource group: ${AZ_RG} | Location: ${AZ_LOCATION} | Env: ${AZ_ENV}"

echo ">> Ensuring the containerapp az extension is present..."
az extension add --name containerapp --upgrade --only-show-errors 1>/dev/null

echo ">> Registering resource providers (idempotent)..."
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

echo ">> Ensuring resource group exists (idempotent)..."
az group create --name "${AZ_RG}" --location "${AZ_LOCATION}" --only-show-errors 1>/dev/null

if az containerapp env show --name "${AZ_ENV}" --resource-group "${AZ_RG}" >/dev/null 2>&1; then
  echo ">> Container Apps environment '${AZ_ENV}' already exists — nothing to do."
else
  echo ">> Creating Container Apps environment '${AZ_ENV}' (Consumption)..."
  az containerapp env create \
    --name "${AZ_ENV}" \
    --resource-group "${AZ_RG}" \
    --location "${AZ_LOCATION}" \
    --only-show-errors
fi

echo ">> Done. Environment '${AZ_ENV}' is ready."
echo ">> Next: AZ_RG=${AZ_RG} AZ_ENV=${AZ_ENV} scripts/azure/02-deploy-api.sh"
