# Secure external HTTPS Action targets

**Status:** implemented on `feature/external-action-targets`  
**Base:** post–PR #82 main

## Allowed target classes

| Class | Scheme | Host | Resolved addresses |
|---|---|---|---|
| `loopback_http` | `http` | `127.0.0.1`, `localhost`, `::1` | must be loopback only |
| `external_https` | `https` | non-loopback hostname or public literal | all answers must be public; deny private/link-local/metadata/CGNAT/ULA/docs |

## Enforcement points

1. **Registration** (`normalizeActionDefinitionRequest`): syntax + literal IP class (`ValidateActionTargetURLSyntax`). No DNS required so operators can register before DNS is live.
2. **Bind** (`routes_contracts.go`): full `ValidateActionTargetURL` (resolve + deny).
3. **Dispatch** (`buildBoundActionRunRequest` + `localWebhookAuthHeaders`): full re-validation.
4. **Runtime** (`igris-tools` destination policy + `HttpTool`): independent re-resolve, pin validated addrs, **never follow redirects**.

## Explicitly refused

- Arbitrary caller-supplied per-run URLs (URL comes from immutable target snapshot)
- `http://` to non-loopback
- `https://` to loopback / private / metadata
- Embedded URL userinfo
- Redirects (no credential forwarding across hops)
- Cross-tenant target references (existing tenant-scoped APIs)

## Target ownership (pilot)

Authenticated tenant-scoped `POST /v1/actions` + bind to that tenant’s target id.
No separate domain-ownership challenge in this slice. Residual risk: a tenant can point at any public HTTPS URL they do not own; SSRF controls still prevent reaching private/cloud-metadata space. Acceptable for disposable pilot; domain proof remains a follow-up.

## Adapter auth

Target-scoped header + `IGRIS_*` secret env (existing mechanism). Igris tenant API keys are never forwarded to the Action target.

## Disposable adapter

`examples/deploy_staging_https_adapter.py` — `deploy.staging` with idempotency, lookup, and pre/post-effect failure injection. Serve behind a publicly trusted HTTPS endpoint for product validation; Runtime requires a trusted certificate chain.
