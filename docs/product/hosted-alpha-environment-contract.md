# Hosted Alpha environment contract

Status: approval-required; no provisioning authorized
Evidence snapshot: 2026-07-25 on `ops/hosted-alpha-environment-contract`

## Purpose and scope

This is the single pre-provisioning contract for one operator-assisted Hosted Alpha user. It preserves the ratified Action -> Run -> Proof model, starts with `deploy.staging`, and does not authorize a Runtime/Overture redesign, protocol change, console build, cloud mutation, migration, package publication, or DNS change.

Repository source proves implementation intent, not a cloud resource exists. Statuses are `VERIFIED_EXISTS`, `DECLARED_NOT_VERIFIED`, `REQUIRED_NEW`, `OBSOLETE`, or `UNKNOWN`. Azure, Neon, Cloudflare, and Resend authenticated read-only access was unavailable for this audit.

## Product and security assumptions

- Public objects: Action, Run, Proof; Reconciliation is the exceptional, attributable resolution of an uncertain effect and is never cryptographic proof.
- The managed REST API and Python SDK are public. Overture and Runtime are operated internal services; a broad console, fleet work, workflow builder, robotics, and new SDKs remain deferred.
- Preserve server-side authentication, authorization, tenant ownership, idempotency, durable state, explicit uncertainty, and no blind replay.
- Targets are exact HTTPS hostnames, deny-by-default. Preserve SSRF denial, DNS re-resolution/address pinning, redirect refusal, target-scoped credentials, and business idempotency. Never forward Igris tenant credentials.

## Evidence inventory

| Area | State | Evidence / consequence |
| --- | --- | --- |
| Azure subscription, resource groups, Container Apps, registry, identities, Key Vault, logs, networking | `UNKNOWN` | Azure CLI/workload identity unavailable. |
| `rg-igris-prod`, `cae-igris-prod`, `igris-api`, `igris-console`, `igris-auth`, `southeastasia` | `DECLARED_NOT_VERIFIED` | Present in scripts/workflows only; do not reuse until ownership/lifecycle are proven. |
| GHCR API/auth/console images | `DECLARED_NOT_VERIFIED` | Build and digest-deploy workflows exist; package visibility/digests unverified. |
| Neon project, branch, database, roles, restore point, applied schema | `UNKNOWN` | No Neon API/CLI or safe direct read access. |
| Migrations 070--072 | `VERIFIED_EXISTS` | Ordered manual-only SQL files; applied state unknown. |
| Cloudflare Pages | `DECLARED_NOT_VERIFIED` | PR #84 Pages checks passed for `igris`, `igris-inertial`, `docs-igris`; dashboard, domains, and production state unknown. |
| BetterAuth / Resend | `UNKNOWN` | Deployment configuration exists; provider status and domain verification unknown. |
| GitHub deploy environments | `VERIFIED_EXISTS` | Only `Preview` and `Production` exist; both show no protection rules/admin bypass. Workflows require lower-case `staging`/`production`: blocking mismatch. |

## Naming, ownership, and regional decisions

| Decision | Required contract | State |
| --- | --- | --- |
| Azure subscription and resource group | Dedicated `rg-igris-hosted-alpha`, never unverified `*-prod`; tag `service=igris`, `environment=hosted-alpha`, owner, cost-center. | `OPEN_DECISION` |
| Region | Select after first-user latency, Neon location/data residency, and service availability review. `southeastasia` is a declaration only. | `OPEN_DECISION` |
| Container Apps | Dedicated Consumption environment with separate Log Analytics workspace and budget alert. | `REQUIRED_NEW` |
| Deployment units | Separate `igris-api` (Overture), `igris-runtime`, and `igris-auth`. Console is not an alpha prerequisite. | `APPROVED_CONTRACT` |
| Registry | Private GHCR images deployed by immutable digest. Managed identity/ACR is a separate future approval, not assumed. | `APPROVED_CONTRACT` |
| Runtime exposure | Internal ingress only; API is the only public execution ingress. | `APPROVED_CONTRACT` |
| Secret store | Azure Key Vault plus managed identities and secret references; Container App/GitHub secret values are not the long-term source of truth. | `OPEN_DECISION` |
| GitHub environments | Protected lower-case `staging` and `production`, required reviewer, restricted branches, no admin bypass. | `REQUIRED_NEW` |

## Service topology and hostname map

```text
SDK / REST client -> https://api.<approved-alpha-domain> -> Overture/API -> Neon
                                      |-> internal signed callbacks -> Runtime
                                      |-> exact HTTPS target + target-scoped credential
Operator browser -> Cloudflare landing/docs; optional console -> auth.<approved-alpha-domain> -> BetterAuth + Resend
```

| Name | Contract | State |
| --- | --- | --- |
| `api.<approved-alpha-domain>` | Public TLS API, rate limited, no database exposure | `OPEN_DECISION` |
| `auth.<approved-alpha-domain>` | Public BetterAuth, exact trusted origins | `OPEN_DECISION` |
| Runtime hostname | None; do not publish Runtime | `APPROVED_CONTRACT` |
| Landing/docs | Separate Cloudflare Pages projects; shared `web/` dashboard root remains wrangler-free | `DECLARED_NOT_VERIFIED` |
| Historic `api.igrisinertial.com`, `app.igrisinertial.com`, `overture.igrisinertial.com` | Repository references only, not DNS ownership/live routing proof | `DECLARED_NOT_VERIFIED` |

The docs Pages `wrangler.toml` still has a placeholder project name; dashboard confirmation is required before any deployment.

## Neon and migrations

Use one approved Igris Neon project with a protected `hosted-alpha` branch/database. Separate roles: break-glass owner; manual migration owner using `DATABASE_URL_DIRECT`; API/auth runtime roles using separate least-privilege pooled URLs; read-only incident role. Record resource identifiers only in the private release record. Require a restore point and restore test before migration.

| File | SHA-256 | Dependency |
| --- | --- | --- |
| `070_contract_execution_bindings.sql` | `8857c9dfe976a31bc0ffa22599f99d885a00b2d40208d4603d3ba26ace133319` | after immutable 069 |
| `071_run_scoped_evidence_link_exclusivity.sql` | `a34a25764eb3ca7a0dc7573ed21e36f4bd4986deb19c3a4510f85d5eebc893b7` | after 070 |
| `072_operator_reconciliation_events.sql` | `bf8192199029dc078aba60639467c4f2172545fe1d1801e9e6288a5c812911b3` | after 070 and 071 |

Apply exactly 070, 071, 072, each manually and transactionally. Runtime/application startup never runs migrations. Migration rollback is a restore point or additive approved repair, never history rewrite.

## Overture, Runtime, gateway, and keyring

`igris-api` is public and enforces auth, tenancy, Action validation, idempotency, Run durability, target policy, `/healthz`, and database-aware `/readyz`. It fails closed when persistence, authentication, or sensitive-input protection is unavailable.

`igris-runtime` is a pinned existing image with stable identity and internal ingress. Never set `IGRIS_ALLOW_INSECURE_DEV_MODE`. Signed callback acceptance requires the registered/assigned runtime identity, tenant/task binding, freshness timestamp, nonce, canonical digest, and signature; replay is rejected. A shared API key is not a replacement for that model.

The DB-write gateway is disabled by default. If later approved, it is a separate internal service with TLS, service identity, tenant-bound requests, explicit table-prefix allowlist, transaction bounds, audit logs, and no arbitrary SQL.

`IGRIS_EXECUTION_INPUT_REF_KEYS` is a versioned keyring and `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION` selects encryption. Rotation is add -> deploy/read both -> verify -> retire after retention. Losing all retained versions makes encrypted inputs unrecoverable and halts affected execution.

## BetterAuth, Resend, API keys, targets

`igris-auth` needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`, `NEXT_PUBLIC_LANDING_URL`, and `IGRIS_REQUIRE_EMAIL_VERIFICATION`. It trusts only selected auth/landing origins. Resend requires a verified domain and `RESEND_FROM_EMAIL`; when verification is required, missing mail configuration blocks deployment. OAuth is deferred.

The first API key is created by a named authenticated operator through the tenant-scoped key API, shown once, securely delivered, and recorded by key ID/fingerprint and issuance event only. It is never a deployment or target credential.

For each Action, record the exact target hostname, owner, credential reference, timeout, business-idempotency field, and reviewed policy version. Reject redirects, unlisted hosts, plain HTTP, and unsafe/rebound addresses.

## Observability and secret names

Minimum alpha telemetry: bounded redacted logs with Action ID, Run ID, tenant pseudonym, Runtime execution ID, image digest/revision, target hostname, state transition, error class, and reconciliation ID. Retain 30 days unless policy requires more. Alert on readiness failure, callback rejections, unknown-effect state, migration attempts by workload identities, and auth/error spikes. Never log keys, cookies, bearer tokens, email addresses, bodies, connection strings, or target credentials.

| Consumer | Names only | Failure / rotation owner |
| --- | --- | --- |
| API | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `IGRIS_API_KEY_HMAC_SECRET`, `IGRIS_EXECUTION_INPUT_REF_KEYS`, `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION` | Platform security; missing required material fails closed. |
| Auth | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` | Identity owner; shared auth-secret rotation is coordinated. |
| Runtime | `IGRIS_API_KEY`, `IGRIS_RUNTIME_SECRET` or `IGRIS_RUNTIME_API_KEY`, `RUNTIME_CALLBACK_PRIVATE_KEY`, `IGRIS_OVERTURE_PUBLIC_KEY` | Runtime owner; missing identity prevents registration/dispatch. |
| Gateway | `IGRIS_DB_WRITE_GATEWAY_URL`, gateway service credential | Data owner; absence disables gateway. |
| CI | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `GHCR_USERNAME`, `GHCR_TOKEN` | Platform owner; OIDC is mandatory for Azure. |

## CI/CD, approvals, rollback, cost

Builds publish reviewed GHCR images; deploy workflows accept only full immutable digests. GitHub OIDC must be least-privilege scoped to the dedicated alpha group. Gates: founder on decisions; platform owner on inventory/identity; database owner before migration; security owner before target allowlist; release owner after smoke.

Rollback boundaries are independent: image to prior digest/revision; config to prior reviewed revision; database to restore/additive repair; keys retain prior decrypt versions; DNS only through an incident decision. Never replay an uncertain effect or delete immutable Proof/Reconciliation history.

No fixed cost is claimed until subscription, region, warm-runtime policy, and provider plans are confirmed. Planning inputs: Azure Consumption charges after free grant/usage, Neon plan/storage/compute, domain, Logs ingestion/retention, Cloudflare Pages, and Resend. Record a regional calculator estimate and budget cap before approval; see [Azure](https://azure.microsoft.com/en-us/pricing/details/container-apps/), [Neon](https://neon.com/pricing), [Cloudflare Pages](https://www.cloudflare.com/developer-platform/products/pages/), and [Resend](https://resend.com/pricing).

## External User #1 and blockers

The operator verifies the target, creates account/tenant, issues one scoped key, privately delivers a reviewed wheel with SHA-256, configures one `deploy.staging` Action, then records success, denial, duplicate/idempotency, unknown-effect/no-replay, Proof, and attributable Reconciliation evidence. The user never receives platform credentials.

Deferred: self-service, public PyPI release, broad console, fleet/robotics, speculative execution, workflow builder, marketplace, new SDKs, and protocol changes.

Open blockers: approve subscription/group/region/domain/owners; prove Azure/Neon/Cloudflare/Resend inventory read-only; select Neon project/branch/restore policy; choose email verification and sender; decide warm Runtime/cost cap; create protected matching GitHub environments. Legacy repository-wide deployment secret names were observed in GitHub; they are not alpha credentials and must be separately owner-inventoried/revoked if obsolete rather than copied into the new environment. Verdict: `DISCOVERY_BLOCKED`; this is a fail-closed implementation plan, not permission to provision.
