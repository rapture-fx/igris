# Durable Action Quickstart

Ordinary managed Igris is **Action → Run → Proof**.

```python
from igris import Igris

igris = Igris.from_env()
run = igris.run(
    "deploy.staging",
    input={"service": "api", "commit": "abc123"},
    idempotency_key="deploy:api:abc123",
)
run.wait()
proof = run.proof()
```

You do not need to understand Overture, Runtime, checkpoints, WAL, or binding
IDs to run an Action that is already configured for your tenant.

Embedded `igris.wrap_tool` / `@igris.guard` remain a **separate local profile**
of the same product. Setting `IGRIS_API_URL` alone never remotes them.

## Install (supported alpha path)

`igris-sdk` is not currently published on PyPI. Do **not** run
`pip install igris`; that name resolves to an unrelated project. From a
repository checkout or operator-provided alpha kit:

```bash
python -m venv .venv && source .venv/bin/activate
python -m pip install -U pip
python -m pip install ./sdk/python
```

## Prerequisites

* Igris API endpoint (`IGRIS_API_URL`)
* Tenant API key (`IGRIS_API_KEY`, `igris_…`)
* An Action that has already been configured once for your tenant (see below)
* For external targets, a public HTTPS URL whose hostname is present in
  Runtime `allowed_http_domains`

## Ordinary journey (after one-time setup)

```python
from igris import Igris

igris = Igris.from_env()  # or Igris(endpoint="…", api_key="igris_…")

run = igris.run(
    "deploy.staging",
    input={"service": "api", "commit": "abc123"},
    idempotency_key="deploy:api:abc123",  # required business key — never random
)
status = run.wait()
proof = run.proof()
print(status.status, proof.schema, proof.statuses)
```

`wait()` and `proof()` are methods on the returned Run handle. The SDK does
not retry consequential effects when an outcome is uncertain.

## One-time Action setup (advanced)

Do this when introducing a new Action version — not on every run.

1. Declare the consequential operation with Embedded `wrap_tool` (local gate).
2. Register a webhook Action target (today: loopback HTTP adapters for local /
   staging dogfood; see “External HTTPS targets” below).
3. Call `igris.configure_action(...)` once to sync the ActionContract and
   ensure an exact contract-hash binding.

```python
from igris import Igris, wrap_tool
from igris.approval import ApprovalDecision


class AlwaysAllow:
    def decide(self, request):
        _ = request
        return ApprovalDecision("allowed", "setup")


def deploy_staging(service: str, commit: str) -> dict:
    return {"service": service, "commit": commit, "effect": "deployed"}


tool = wrap_tool(
    deploy_staging,
    action="deploy.staging",
    risk="critical",
    approval="never",
    approval_provider=AlwaysAllow(),
)

igris = Igris.from_env()
# create_action_target is advanced — typically done by an operator once.
target = igris.create_action_target(
    name="deploy_staging_adapter",
    target_url="https://deploy.example.com/v1/deploy/staging",
    target_type="webhook",
    replay_class="non_retryable",
    approval_required=True,
    irreversible=True,
    target_metadata={
        "local_auth_header_name": "X-Igris-Adapter-Token",
        "local_auth_secret_env": "IGRIS_DEMO_ADAPTER_TOKEN",
    },
)
igris.configure_action(
    tool,
    target_action_id=target.id,
    input_mapping={"service": "service", "commit": "commit"},
)
# From here: igris.run("deploy.staging", input=…, idempotency_key=…)
```

Low-level `sync_contract`, `create_binding`, and `IgrisDurableClient` remain
available for infrastructure users.

## Failure handling: Reconciliation

If a consequential external effect is **genuinely uncertain**, Igris stops
automatic replay. The Run surfaces `ReconciliationRequiredError` /
`reconciliation_required`. Operator reconciliation is an attributable
assertion (`cryptographic_proof=false`), not cryptographic proof of the
external effect. See `docs/api/operator-reconciliation.md`.

## Proof claims

**Igris Run Proof** links truthful claims. Runtime receipts and Action
Protocol Evidence remain distinct — Proof does not merge them into one
cryptographic artifact.

The Igris Action Protocol is the open trust / interoperability layer for
independently verifiable Evidence. It is not the ordinary managed onboarding
workflow.

## External HTTPS targets

Managed Igris accepts public HTTPS Action targets and rejects public HTTP,
loopback/private/metadata HTTPS destinations, unsafe DNS answers, and
redirects. The Runtime independently requires the exact target hostname in
`allowed_http_domains`. The configured target URL comes from the immutable
binding; callers cannot override it per Run.

Use a publicly trusted certificate and target-scoped authentication. Igris
tenant API keys are never forwarded to the target. For local development only,
loopback HTTP remains supported.
