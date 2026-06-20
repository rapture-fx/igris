# Azure Container Apps — custom domains & DNS

Bind the two product hostnames to the Container Apps after `scripts/azure/02`
and `03` have deployed and their default FQDNs respond. Landing and docs stay
on Cloudflare Pages — this file does not touch them.

| Hostname                  | Points at                | Container App   |
| ------------------------- | ------------------------ | --------------- |
| `api.igrisinertial.com`   | Go Overture API          | `igris-api`     |
| `app.igrisinertial.com`   | Rails console            | `igris-console` |

DNS is in Cloudflare. Use **DNS only** (grey cloud), not Proxied — Container
Apps terminates TLS for the custom domain and issues a free managed
certificate; an extra proxy hop complicates that and streaming endpoints.

## Steps (repeat per hostname)

Container Apps validates domain ownership with a `asuid.<host>` TXT record plus
a CNAME to the app's default FQDN.

```bash
AZ_RG=rg-igris-prod
APP=igris-api                       # or igris-console
HOST=api.igrisinertial.com          # or app.igrisinertial.com

# 1. Default FQDN of the app (CNAME target) and the ownership token.
FQDN=$(az containerapp show -g "$AZ_RG" -n "$APP" \
  --query properties.configuration.ingress.fqdn -o tsv)
ASUID=$(az containerapp show -g "$AZ_RG" -n "$APP" \
  --query properties.customDomainVerificationId -o tsv)
echo "CNAME  $HOST            -> $FQDN   (DNS only)"
echo "TXT    asuid.$HOST      -> $ASUID"
```

In Cloudflare → `igrisinertial.com` zone, add:

| Type  | Name              | Target              | Proxy    |
| ----- | ----------------- | ------------------- | -------- |
| CNAME | `api` / `app`     | `$FQDN`             | DNS only |
| TXT   | `asuid.api` / `asuid.app` | `$ASUID`    | n/a      |

Then bind the hostname and let Azure issue a managed certificate:

```bash
# 2. Add the hostname (validates the TXT record).
az containerapp hostname add -g "$AZ_RG" -n "$APP" --hostname "$HOST"

# 3. Bind + provision a free managed cert (auto-renews).
az containerapp hostname bind -g "$AZ_RG" -n "$APP" --hostname "$HOST" \
  --environment cae-igris-prod --validation-method CNAME
```

## After both domains are live

Repoint the console at the API's stable hostname and redeploy the console:

```bash
export OVERTURE_API_BASE_URL=https://overture.igrisinertial.com
# re-run scripts/azure/03-deploy-console.sh with the other required env vars
```

Verify:

```bash
curl -fsS https://overture.igrisinertial.com/healthz   # liveness
curl -fsS https://overture.igrisinertial.com/readyz    # DB-aware
curl -fsS https://app.igrisinertial.com/up        # console (no auth challenge)
```

## Retiring the old Cloudflare Pages console mapping

If `app.igrisinertial.com` was previously mapped to the (now removed) Next.js
console on Cloudflare Pages, remove that custom-domain mapping from the Pages
project before adding the CNAME above, then verify `app.igrisinertial.com`
resolves to the Container App FQDN. Dashboard-only work — nothing in the repo
points at the Pages project.
