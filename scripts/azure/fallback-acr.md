# Fallback: Azure Container Registry (Basic) instead of GHCR

Use this **only if** pulling the private GHCR image into Container Apps is a
problem and you don't want to make the GHCR package public. ACR Basic is a paid
SKU (~a few USD/month) — GHCR is free, so try these first:

1. **Make the GHCR package public** (simplest, free): GitHub → your profile/org
   → Packages → `igris-api` / `igris-console` → Package settings → Change
   visibility → Public. Then `scripts/azure/02`/`03` need no registry creds.
2. **Private GHCR with a PAT**: create a classic PAT with `read:packages`, then
   export `GHCR_USERNAME` + `GHCR_TOKEN` before running `02`/`03`.

If neither fits, fall back to ACR Basic. **These commands are not run
automatically by any script** — paste them by hand only if you choose this path.

```bash
AZ_RG=rg-igris-prod
ACR_NAME=igrisprodacr            # must be globally unique, alphanumeric
AZ_LOCATION=southeastasia

# Create the registry (Basic SKU).
az acr create -g "$AZ_RG" -n "$ACR_NAME" --sku Basic --location "$AZ_LOCATION"

# Pull from GHCR locally and push to ACR (needs Docker + `az acr login`).
az acr login -n "$ACR_NAME"
docker pull ghcr.io/igris-inertial/system/igris-api:latest
docker tag  ghcr.io/igris-inertial/system/igris-api:latest \
            "$ACR_NAME.azurecr.io/igris-api:latest"
docker push "$ACR_NAME.azurecr.io/igris-api:latest"
# ...repeat for igris-console...
```

Then run `02`/`03` with the ACR image and credentials:

```bash
export API_IMAGE="$ACR_NAME.azurecr.io/igris-api:latest"
export GHCR_USERNAME="$ACR_NAME"
export GHCR_TOKEN="$(az acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
# (the scripts pass --registry-server/--username/--password through generically)
# NOTE: also enable the admin user once: az acr update -n "$ACR_NAME" --admin-enabled true
```

To remove the cost later: `az acr delete -g "$AZ_RG" -n "$ACR_NAME"`.
