# Hosted Alpha Enablement Plan

Status: Implementation-ready plan; no deployment authorized

Product truth: `docs/product/PRD.md`

Target: one operator-assisted external engineer using `deploy.staging`

## Outcome and boundary

This plan turns the Hosted Alpha `NOT_READY` verdict into a dependency-ordered
implementation sequence. It uses the existing Overture, Runtime, REST, Python
SDK, BetterAuth, API-key, Reconciliation, and Proof paths. It does not authorize
a new execution capability, Runtime or Overture redesign, production
deployment, shared-database mutation, secret mutation, or package publication.

The first acceptance path is:

**configure `deploy.staging` → issue one API key → Action → Run → Proof**

An uncertain external effect must stop automatic replay and enter exceptional
Reconciliation.

## Dependency order

| Order | Workstream | Depends on | Exit evidence |
|---:|---|---|---|
| 0 | Hosted environment contract | reconciled product PR | Protected `staging` GitHub environment; Azure resource names, DNS, log workspace, secret names, owners, and rollback digests documented. |
| 1 | Neon provisioning and migrations 070–072 | 0 | Dedicated staging branch/database, direct and pooled URLs stored separately, backup/restore point recorded, migrations verified through 072. |
| 2 | Execution-input encryption keys | 0 | Versioned keyring and active version exist only in the secret store; API preflight fails closed when absent and passes when configured. |
| 3 | BetterAuth and Resend | 1, 0 | Signup, verification email, verification callback, login, session lookup, expiry, and replay tests pass against staging. |
| 4 | Azure Overture/API | 1, 2, 3 | Pinned API digest deployed; `/healthz` and `/readyz` pass; unauthenticated protected request is denied; authenticated API-key request is tenant-scoped. |
| 5 | Managed Runtime | 4 | Existing Runtime artifact deployed with secure config; registration and heartbeat pass; no insecure development mode; prior digest/config retained. |
| 6 | External target policy | 5 | Exact public HTTPS hostname allowlisted; DNS/IP and redirect controls pass; target credential stored separately; target idempotency contract recorded. |
| 7 | API-key issuance | 3, 4 | Named agent key created through authenticated `POST /v1/api-keys`, raw value delivered once through an approved channel, list/revoke tested. |
| 8 | Alpha wheel distribution | reconciled product PR | Versioned wheel built and inspected, SHA-256 recorded, clean-installed, and privately delivered; no PyPI publication required. |
| 9 | Hosted Action → Run → Proof smoke | 4, 5, 6, 7, 8 | Real `deploy.staging` success plus denial, duplicate, timeout/uncertain-effect, no-blind-replay, Proof, and Reconciliation evidence recorded. |

Workstreams 1, 2, and 8 may proceed in parallel after workstream 0. The final
smoke is blocked until every dependency is green.

## Workstream 0: hosted environment contract

Use the next implementation branch:

`ops/hosted-alpha-environment-contract`

Required repository work:

1. Create or document a protected GitHub `staging` environment. Resolve the
   current `Preview` versus `staging` naming mismatch.
2. Inventory the existing Azure Container Apps environment and identify the
   API, auth, console-if-used, and Runtime app names.
3. Define custom hostnames, certificates, allowed origins, and callback URLs.
4. Make API and Runtime deployment preflights validate required secret
   references by name and presence without printing values.
5. Define Azure Log Analytics queries for Action ID, Run ID, Runtime execution
   ID, uncertain effects, and Reconciliation events.
6. Record the last-known-good immutable digest for every deployed service.

No resource creation or mutation belongs in the reconciliation PR.

## Workstream 1: Neon and migrations 070–072

Manual prerequisites:

- dedicated staging Neon branch/database;
- pooled runtime URL and direct operator URL;
- TLS required;
- migration owner role separated from application runtime role;
- backup or branch restore point;
- maintenance owner and explicit apply approval.

Freeze and verify the migration bytes before application:

```bash
shasum -a 256 \
  igris-overture/database/migrations/070_contract_execution_bindings.sql \
  igris-overture/database/migrations/071_run_scoped_evidence_link_exclusivity.sql \
  igris-overture/database/migrations/072_operator_reconciliation_events.sql
```

Expected SHA-256:

```text
8857c9dfe976a31bc0ffa22599f99d885a00b2d40208d4603d3ba26ace133319  070_contract_execution_bindings.sql
a34a25764eb3ca7a0dc7573ed21e36f4bd4986deb19c3a4510f85d5eebc893b7  071_run_scoped_evidence_link_exclusivity.sql
bf8192199029dc078aba60639467c4f2172545fe1d1801e9e6288a5c812911b3  072_operator_reconciliation_events.sql
```

Approved operator commands, one migration at a time:

```bash
psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -1 \
  -f igris-overture/database/migrations/070_contract_execution_bindings.sql
psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -1 \
  -f igris-overture/database/migrations/071_run_scoped_evidence_link_exclusivity.sql
psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -1 \
  -f igris-overture/database/migrations/072_operator_reconciliation_events.sql
```

Verification:

```bash
psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 <<'SQL'
SELECT to_regclass('public.action_contract_execution_bindings');
SELECT to_regclass('public.contract_bound_action_runs');
SELECT to_regclass('public.contract_bound_action_reconciliation_events');
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'contract_bound_action_evidence_links_batch_exclusive_idx',
    'contract_bound_action_evidence_links_digest_exclusive_idx'
  )
ORDER BY indexname;
SQL
```

Application services must never run migrations on startup.

## Workstream 2: execution-input encryption

Required secret and variable names:

- `IGRIS_EXECUTION_INPUT_REF_KEYS`
- `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION`

Manual steps:

1. Generate a 32-byte key through the approved secret-management process.
2. Store a versioned keyring in the staging secret store.
3. Set the active version as non-secret configuration or a secret according to
   the operator policy.
4. Wire both names to the API Container App using secret references.
5. Prove sensitive execution input is encrypted, resolvable by the active
   version, and still resolvable after adding a second version.
6. Prove a missing or unknown version fails closed.

Never print the keyring, put it in GitHub output, or place it in a generated
deployment manifest.

## Workstream 3: BetterAuth and Resend

Required names:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_BASE_URL`
- `NEXT_PUBLIC_LANDING_URL`
- `IGRIS_REQUIRE_EMAIL_VERIFICATION`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

OAuth names are deferrable unless OAuth is explicitly part of External User #1:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GH_OAUTH_CLIENT_ID`
- `GH_OAUTH_CLIENT_SECRET`

Validation:

1. Deploy only a pinned auth digest through `deploy-auth-azure.yml`.
2. Confirm `/` returns 200 and `/api/auth/get-session` is non-5xx.
3. Create a disposable staging user.
4. Confirm exactly one verification email is accepted by the provider.
5. Confirm the verification link returns to the intended staging origin.
6. Confirm expired and replayed verification links fail safely.
7. Confirm login establishes a server-validated session and tenant identity.
8. Confirm logs redact recipient addresses, tokens, cookies, and secrets.

If email verification is required, missing Resend configuration is a blocker,
not a warning.

## Workstream 4: Azure Overture/API

The current API workflow updates an existing Container App image. Before using
it, the environment-contract branch must prove the existing app has these
runtime names wired:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `IGRIS_EXECUTION_INPUT_REF_KEYS`
- `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION`
- allowed origins and public base URL configuration used by the API

GitHub/Azure deployment names:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_CONTAINERAPPS_ENV`
- `AZURE_API_APP`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- optional smoke-only `IGRIS_AGENT_API_KEY`

Build and deployment commands after separate authorization:

```bash
gh workflow run build-container-images.yml \
  --ref <approved-merged-sha> \
  -f push=true

gh workflow run deploy-api-azure.yml \
  --ref <approved-merged-sha> \
  -f target_environment=staging \
  -f api_image_digest='ghcr.io/igris-inertial/system/igris-api@sha256:<digest>'
```

Validation:

```bash
curl --fail --silent --show-error https://<staging-api-host>/healthz
curl --fail --silent --show-error https://<staging-api-host>/readyz
curl --include https://<staging-api-host>/v1/actions
```

The unauthenticated protected request must be denied without leaking tenant or
configuration data.

## Workstream 5: managed Runtime

The repository does not yet have a verified managed Runtime deployment
workflow. Add only deployment packaging and configuration for the existing
Runtime. Do not redesign it.

Required names:

- `IGRIS_CONFIG`
- `IGRIS_LICENSE_KEY` or approved signed offline-license inputs
- `IGRIS_API_KEY` for the tenant-scoped Runtime key
- `IGRIS_OVERTURE_URL`
- `IGRIS_RUNTIME_ENDPOINT`
- `IGRIS_RUNTIME_SECRET` or `IGRIS_RUNTIME_API_KEY`
- `IGRIS_OVERTURE_PUBLIC_KEY`
- optional `IGRIS_DB_WRITE_GATEWAY_URL`
- optional `IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES`

Live configuration must not set `IGRIS_ALLOW_INSECURE_DEV_MODE=true`.

Validation:

```bash
igris-runtime --config "$IGRIS_CONFIG" validate-config
igris-runtime health --url https://<staging-runtime-host>
```

Then prove registration, one heartbeat interval, runtime selection, dispatch,
authenticated callback, receipt creation, and graceful restart using the same
runtime identity.

## Workstream 6: external target policy

For the first `deploy.staging` adapter:

1. Record the exact hostname and owner.
2. Require public HTTPS with trusted TLS.
3. Put only the exact hostname in Runtime `allowed_http_domains`.
4. Keep shell and filesystem tools disabled unless separately approved.
5. Store target authentication outside Action input and logs.
6. Confirm DNS/IP checks reject loopback, link-local, private, metadata, and
   otherwise denied destinations.
7. Confirm redirects are denied or revalidated by the existing policy.
8. Document target-side idempotency lookup and the business idempotency key.

Smoke both a permitted exact hostname and a denied near-match.

## Workstream 7: operator-assisted API-key issuance

After BetterAuth and the API are healthy:

```bash
curl --fail --silent --show-error \
  -X POST https://<staging-api-host>/v1/api-keys \
  -H "Authorization: Bearer <authenticated-tenant-credential>" \
  -H "Content-Type: application/json" \
  --data '{"name":"External User 1"}'
```

The raw `api_key` is displayed once. Deliver it through an approved secure
channel; do not paste it into tickets, logs, chat history, or the readiness
report. Verify list metadata and tenant-scoped revocation.

The large console is not required for this ceremony.

## Workstream 8: alpha wheel distribution

Do not publish to PyPI in this workstream.

```bash
cd sdk/python
uv sync --dev
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv build
python -m zipfile -l dist/*.whl
shasum -a 256 dist/*.whl
```

Install the exact wheel into a disposable environment and verify:

```bash
uv venv <disposable-venv>
uv pip install --python <disposable-venv>/bin/python dist/<exact-wheel>
<disposable-venv>/bin/python -c 'from igris import Igris; print(Igris.__module__)'
```

Deliver the exact filename, version, and SHA-256 through the approved private
artifact channel.

## Workstream 9: hosted Action → Run → Proof gate

The release record must capture IDs and digests, never raw secrets.

Required cases:

1. Valid `deploy.staging` completes and returns linked Proof.
2. Same business idempotency key and same input returns the same durable
   submission outcome.
3. Same key with different input is rejected.
4. Missing approval cannot dispatch.
5. Disallowed target hostname cannot dispatch.
6. Target failure is represented honestly.
7. Connection loss after dispatch produces uncertain effect state.
8. An irreversible or non-retryable uncertain effect is not automatically
   replayed.
9. Authenticated Reconciliation appends an attributable operator assertion.
10. Proof distinguishes Igris-observed facts from external-world correctness.

The alpha is ready only when these cases pass from the externally reachable
staging environment using the privately distributed wheel.

## Rollback

Application and Runtime:

- deploy immutable digests only;
- record the previous healthy digest and Container App revision;
- roll back by activating or redeploying the prior digest;
- restore the prior Runtime config and exact domain allowlist;
- rerun health, auth denial, registration, heartbeat, and read-only smoke.

Database:

- do not rewrite migration history or automatically run down migrations;
- stop writes if a schema incident occurs;
- roll back the application only when the prior version is compatible with
  migrations 070–072;
- otherwise preserve evidence and forward-fix through a separately approved
  additive migration;
- use the pre-recorded Neon branch/restore point for disaster recovery.

Secrets:

- rotate only through the secret store;
- retain old execution-input key versions while referenced ciphertext exists;
- revoke exposed API or Runtime keys and issue replacements once;
- never put replacement values in incident reports.

## Operator-assisted External User #1

Required:

1. Operator creates or verifies the account and tenant.
2. Operator confirms email verification and login.
3. Operator configures one `deploy.staging` Action and immutable binding.
4. Operator configures one exact HTTPS target and Runtime allowlist entry.
5. Operator issues one named agent API key and delivers it once.
6. Operator supplies the versioned private SDK wheel and SHA-256.
7. User runs one staging deployment.
8. Operator and user inspect Run and Proof together.
9. Operator handles exceptional Reconciliation through the authenticated API
   if the target effect is uncertain.

May be deferred until self-service:

- public PyPI publication;
- self-service signup polish;
- console-based Reconciliation;
- rich dashboards and exports;
- Runtime fleet UI;
- workflow builder;
- marketplace;
- protocol explorer;
- robotics UI;
- OAuth providers; and
- database-write gateway when the first Action is HTTPS-only.

Console account, API-key, Run, and Reconciliation screens become required only
when operator assistance is no longer acceptable.
