# External-engineer validation — secure HTTPS Action targets

Branch: `feature/external-action-targets`  
Base: post–PR #82 main (`3c6f09b57…`)

## Prerequisites

1. Public HTTPS URL for `examples/deploy_staging_https_adapter.py` with a **publicly trusted** certificate (Runtime uses rustls / webpki roots; self-signed will fail).
2. Runtime config includes the adapter hostname in `allowed_http_domains`.
3. Env:
   - `IGRIS_BASE_URL`, tenant API credentials for `Igris.from_env()`
   - `IGRIS_DEPLOY_STAGING_ADAPTER_TOKEN` on the adapter host
   - Matching `IGRIS_*` secret env on Overture for target metadata auth

## One-time setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install igris-sdk
```

```python
from igris import Igris
igris = Igris.from_env()
igris.configure_action(
    action="deploy.staging",
    # register target + bind via REST/SDK helpers your environment exposes;
    # target_url must be https://<public-host>/v1/deploy/staging
)
```

Target metadata must include:

- `local_auth_header_name`: `X-Igris-Adapter-Token`
- `local_auth_secret_env`: e.g. `IGRIS_DEPLOY_STAGING_ADAPTER_TOKEN`

## Ordinary journey

```python
run = igris.run(
    "deploy.staging",
    input={"service": "api", "environment": "staging", "image_tag": "sha-demo"},
    idempotency_key="ext-demo-001",
)
run.wait()
print(run.proof())
```

No Runtime IDs, checkpoint IDs, or raw contract hashes after setup.

## Failure scenarios

| Scenario | How | Expect |
|---|---|---|
| A normal | default POST | one deployment; Run `completed`; Proof retrievable |
| B recoverable | `X-Igris-Fail-Before-Effect: 1` then retry | recovery; still one deployment |
| C uncertain | `X-Igris-Fail-After-Effect: 1` | `reconciliation_required`; no auto-replay; operator confirm → `cryptographic_proof=false` |

## Security negatives (must deny)

`http://` external, localhost/private/metadata HTTPS, DNS→denied IP, redirect to denied space, cross-tenant target, run-time URL override, wrong `contract_hash`, missing/conflicting idempotency key.

## Residual

Domain-ownership challenge is not implemented for the pilot; authenticated tenant configuration + SSRF controls are the gate. Operator reconciliation `auth_method=session` remains P1 defense-in-depth (API keys already lack `IsAdmin`).
