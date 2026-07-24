# Igris PRD Ratification and Hosted Alpha Readiness Report

Date: 2026-07-24

Audited baseline: `origin/main` at `018d1c17df32f18b1c990d0d1a9e88c0e7a368e3`

Product-truth branch: `docs/hosted-alpha-product-truth`

Source status: the PRD, agent guardrails, cloud-development setup, reconciled
public surfaces, and audit documents are collected on one review branch.

## Executive summary

The engineering baseline from PR #83 is present, and the repository now has a
canonical PRD, PRD-bound agent instructions, a cloud-development bootstrap, and
public copy centered on Action → Run → Proof.

Hosted Alpha is **NOT_READY** for External User #1. The repository contains the
necessary API, authentication, API-key, reconciliation, and external-target
building blocks, but there is no verified end-to-end managed deployment. The
current evidence does not prove a deployed Runtime, applied Neon migrations
070–072, working BetterAuth email verification, configured execution-input
encryption keys, or an allowed-domain configuration for the first Action target.
The public landing page also still serves its earlier copy until these changes
are merged and deployed.

No production deployment, database migration, DNS change, package publication,
or secret mutation was performed during this audit.

## Final verdict

**NOT_READY**

Repository readiness and hosted readiness are separate:

- Repository product truth: committed and ready to review on this branch.
- Documentation and landing source: included on the review branch.
- SDK source install: available; public package install is not.
- Managed control plane: implementation exists, live operation is unproven.
- Managed Runtime: no current deployment path or live instance was proven.
- External User #1: blocked on the exact items below.

## PRD commit

`47c9cbf53` (`docs(product): ratify hosted alpha PRD`) adds
`docs/product/PRD.md` as the canonical product truth. It defines:

- Igris as the safe execution boundary for consequential actions initiated by
  coding agents and automated systems.
- Action → Run → Proof as the public model.
- Reconciliation as exceptional and explicitly non-cryptographic.
- REST as the canonical managed interface and Python as a thin convenience
  layer.
- Overture, Runtime, WAL, checkpoints, bindings, and receipts as internal
  machinery.
- The initial deploy, migrate, and publish wedge.
- Allowed work, frozen work, non-goals, and product-change approval rules.

## Instruction files updated

Commit `639a2c122` (`docs(agents): enforce PRD product guardrails`) updates
`AGENTS.md` and `CLAUDE.md` to:

- defer to `docs/product/PRD.md`;
- stop and request product approval for contradictory work;
- prohibit new Clock branches;
- prohibit untied infrastructure expansion;
- enforce Action, Run, Proof, and exceptional Reconciliation vocabulary; and
- keep Overture and Runtime out of ordinary user-facing onboarding.

## Git/main truth

- Fetched `origin`.
- `origin/main` is exactly
  `018d1c17df32f18b1c990d0d1a9e88c0e7a368e3`, the expected post-PR #83 commit.
- Work was isolated on `docs/hosted-alpha-product-truth`.
- The original dirty checkout was not modified, stashed, reset, or cleaned.
- No branch or stash was deleted.

## Worktree cleanup result

Two clean, unlocked, fully reachable worktrees were removed:

- `system-worktrees/external-action-targets`
- `system-worktrees/product-compression`

All dirty, unique, unpushed, locked, or ambiguous work was retained. Measured
free disk increased by approximately 2.5 GiB. The inventory, classifications,
retention reasons, and commands are in
`docs/audits/worktree-cleanup-report.md`.

## Cloud development readiness

The branch adds:

- `.devcontainer/devcontainer.json`
- `.devcontainer/post-create.sh`
- `docs/development/cloud-development.md`

The container installs the repository's required Python, Go, Rust, Node, pnpm,
and PostgreSQL client toolchains without embedding secrets. The guide documents
SDK tests, focused Go and Rust tests, the fast proof gate, required local tools,
and secret names. Host-specific laptop paths are not part of the bootstrap.

This is source-ready but must still pass a clean Codespaces/devcontainer launch
after merge.

## Public surface audit

The detailed classification is in
`docs/audits/product-surface-reconciliation.md`.

Before alpha, the README, landing page, docs home, quickstart, SDK onboarding,
and install instructions must all lead with the managed Action → Run → Proof
experience. Protocol-first, Runtime-first, fleet, robotics, Clock, governance,
and broad platform messaging must not lead first-user onboarding.

Protocol and architecture material may remain as advanced material when it is
accurate and clearly separated from the first-use path.

## Landing page changes

The landing source now:

- leads with coding agents safely executing consequential actions;
- presents Action → Run → Proof;
- shows a Python SDK flow;
- uses deploy, migrate, and publish as the wedge;
- explains uncertain external effects and no blind replay;
- describes Proof as durable execution evidence, not cryptographic proof of the
  external world;
- mentions the open Action Protocol only as the trust layer underneath; and
- removes Runtime, fleet, robotics, and multi-SDK framing from primary
  navigation and calls to action.

The deployed public site still needs to be rebuilt and published from the
merged commit.

## Docs changes

The docs home and quickstart now separate one-time setup from ordinary use and
show:

`Igris.from_env()` → `configure_action()` → `run()` → `wait()` → `proof()`

New focused pages cover:

- `deploy.staging`
- idempotency and uncertain effects
- exceptional Reconciliation
- the Action Protocol as an advanced trust/interoperability layer

Contract, target, binding, Overture, and Runtime details remain available but
are moved out of the primary onboarding sequence.

## SDK install path

**Public install status: NOT_READY**

- `igris-sdk` returned no public PyPI project during the audit.
- The existing PyPI project named `igris` is unrelated and must not be
  recommended.
- The verified source import contract remains `from igris import Igris`.
- README and docs now avoid claiming that `pip install igris-sdk` works.

Alpha options, in order:

1. Publish an explicitly owned prerelease such as `igris-sdk==0.1.0a3` after
   separate approval and clean-wheel validation.
2. Until then, distribute a versioned private wheel with its SHA-256 and install
   it by exact artifact path.

Do not publish until package ownership, credentials, version, metadata, and
release approval are confirmed.

## Hosted Azure status

**NOT_READY**

Repository workflows exist for building container images and deploying the API,
console, and BetterAuth to Azure. The image build for the audited main commit
completed successfully. However:

- no runs were found for the current API, console, or BetterAuth deployment
  workflows;
- the API health endpoints timed out from the external audit vantage point;
- the authentication hostname did not resolve;
- the current public landing site serves stale positioning;
- GitHub has `Preview` and `Production` environments, while the current deploy
  workflows expect `staging` or `production`; and
- API and console workflows update images but depend on pre-existing runtime
  configuration that was not proven.

Current Azure resource existence is not enough to claim readiness. A pinned
image deployment followed by authenticated end-to-end smoke testing is required.

## Runtime deployment status

**NOT_READY**

The container-image workflow builds API, console, and auth images, but it does
not build or deploy a managed Runtime image. A Runtime release workflow produces
binaries, not a verified Azure Runtime service. No live Runtime registration,
heartbeat, dispatch, or receipt path was proven.

This is a deployment/configuration blocker, not approval to redesign Runtime.

## Neon migration status

**UNKNOWN / NOT_READY**

The repository contains the additive, ordered migrations:

- `070_contract_execution_bindings.sql`
- `071_run_scoped_evidence_link_exclusivity.sql`
- `072_operator_reconciliation_events.sql`

Their presence does not prove they are applied to Neon. No live database query
or production mutation was performed. Application runtimes must not apply these
migrations automatically.

Operator procedure, only after explicit approval and a backup:

```bash
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 \
  -c "SELECT to_regclass('public.action_contract_execution_bindings'), to_regclass('public.contract_bound_action_evidence_links'), to_regclass('public.contract_bound_action_reconciliation_events')"

psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 \
  -f igris-overture/database/migrations/070_contract_execution_bindings.sql
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 \
  -f igris-overture/database/migrations/071_run_scoped_evidence_link_exclusivity.sql
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 \
  -f igris-overture/database/migrations/072_operator_reconciliation_events.sql
```

Before application, confirm the actual schema-history contract, migration
checksums, role ownership, direct/non-pooled connection, maintenance window, and
backup restore point. Apply one migration at a time and verify after each.

## BetterAuth status

**NOT_READY**

Source inspection confirms email/password support, optional required email
verification, PostgreSQL persistence, and the required server secret. A deploy
workflow exists. Live signup, login, session validation, callback routing, and
tenant provisioning were not proven, and the auth hostname did not resolve.

## Resend status

**NOT_READY**

The auth service supports Resend-backed verification email. If
`RESEND_API_KEY` is absent, email sending becomes a redacted no-op. That is
acceptable only when verification is not required; otherwise new users can be
unable to complete signup.

Before alpha, prove the sender domain, `RESEND_FROM_EMAIL`, delivery, verification
callback, expiry, replay behavior, and failure observability without logging
tokens or addresses.

## API-key path

**SOURCE_READY / LIVE_UNPROVEN**

The backend exposes authenticated, tenant-scoped create/list/delete API-key
routes. Raw key material is returned only at creation and a hash is persisted.
The Rails console has an API-key settings flow that does not persist the raw
value.

For External User #1, an operator-assisted account and API-key ceremony can
avoid making console availability a hard blocker. The ceremony must still use
the authenticated server route and hand the one-time raw key to the user through
an approved secure channel.

## Required environment and secret names

Values must remain in the platform secret store, never in Git or reports.

Control plane and auth:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `IGRIS_REQUIRE_EMAIL_VERIFICATION`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- allowed application/callback origin configuration

Execution:

- `IGRIS_EXECUTION_INPUT_REF_KEYS`
- `IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION`
- `IGRIS_DB_WRITE_GATEWAY_URL`
- Runtime control-plane URL and Runtime authentication material
- Runtime `allowed_http_domains`
- target-specific authentication secrets

Deployment:

- Azure federated identity/client, tenant, subscription, and resource-group
  identifiers
- GHCR username/token
- Azure Container App names

## Execution-input reference keys

**NOT_READY**

The API fails closed for protected execution inputs when
`IGRIS_EXECUTION_INPUT_REF_KEYS` is missing. The current production environment
inventory did not prove these keys or the active version are configured, and
the API deployment workflow does not install them.

Generate and store a versioned key ring through the approved secret-management
process, set the active version, deploy it as a secret reference, and test
encrypt/decrypt and rotation behavior before onboarding.

## Database write gateway

**NOT_READY / MAY BE NON-BLOCKING FOR THE FIRST HTTP-ONLY ACTION**

Runtime supports `IGRIS_DB_WRITE_GATEWAY_URL`, but no hosted value or reachable
gateway was proven. If the first user needs only HTTPS Action targets, document
the gateway as disabled and exclude database-write capabilities from the alpha.
If database actions are in scope, the gateway becomes a blocker and needs its
own authenticated deployment and smoke test.

## Runtime allowed domains and public HTTPS targets

**NOT_READY**

The Runtime configuration contains example domains, not the first user's target.
The allowlist is fail-closed and must contain only the exact approved Action
target hostname. External targets must use public HTTPS with trusted TLS and
must pass the existing DNS/IP and redirect SSRF controls.

Required process:

1. Obtain the exact target hostname and owner approval.
2. Verify public DNS and trusted TLS from the hosted Runtime network.
3. Add only that hostname to `allowed_http_domains`.
4. Store target authentication separately from Action input.
5. Run registration, bind, dispatch, timeout, uncertain-effect, and redirect
   denial tests.
6. Record the deployed config version and rollback target.

## Secrets storage model

Azure Container App secrets and secret references are the intended hosted
model. The auth workflow demonstrates that pattern. API and console deployment
currently assume existing configuration and need a reviewed environment
contract proving every required secret reference is present.

No workflow should echo values. Debug output must show names and presence only.

## Observability and alpha debugging

**PARTIAL / LIVE_UNPROVEN**

Services log to standard output and the architecture expects Azure Log
Analytics. Before alpha, prove:

- a correlation path from Action ID to Run ID to Runtime execution ID;
- redaction of authorization headers, API keys, input-reference keys, email
  verification tokens, and target credentials;
- health/readiness alerting;
- failed dispatch and uncertain-effect visibility;
- reconciliation audit events;
- log retention and operator access; and
- an incident contact and time-boxed debug procedure.

## Rollback plan

Deployments must use immutable image digests. Roll back an application by
redeploying the last known-good digest and re-running health and smoke tests.

For migrations 070–072:

- do not rewrite migration history;
- do not run automatic down migrations during an incident;
- prefer application rollback only when the previous version is schema
  compatible; and
- otherwise stop writes, preserve evidence, and forward-fix through an approved
  additive migration.

Keep the prior Runtime binary/config and prior domain allowlist available for
immediate restoration.

## Console scope

The console is **not required** for a single operator-assisted alpha user.

Alpha-required:

- account/session management, if self-service signup is enabled;
- API-key create/list/revoke;
- Runs and status;
- approval/rejection where the configured Action requires it; and
- Reconciliation for exceptional uncertain effects, if not handled by an
  operator through the API.

Later:

- richer filters, dashboards, audit exports, and convenience administration.

Out of scope:

- Runtime fleet UI;
- workflow builder;
- protocol explorer;
- marketplace;
- robotics UI; and
- a large observability dashboard.

The current console has account, API-key, and Run paths but no proven
Reconciliation UI. Defer that UI if the first user accepts operator-assisted
Reconciliation through the authenticated API.

## Remaining blockers

1. Merge the PRD, agent guardrails, cloud-dev setup, and reconciled public copy.
2. Create and protect the intended hosted-alpha GitHub environment, resolving
   the `Preview`/`staging` mismatch.
3. Define and validate the complete Azure environment/secret contract.
4. Deploy pinned API, auth, console-if-needed, and existing Runtime artifacts.
5. Prove migrations 070–072 on Neon through an approved operator procedure.
6. Configure execution-input reference keys and their active version.
7. Prove BetterAuth signup/login/session and Resend verification.
8. Configure the exact Runtime domain allowlist and target credentials.
9. Pass an end-to-end deploy-staging Action → Run → Proof smoke test, including
   failure, timeout, uncertain-effect, and Reconciliation behavior.
10. Provide an installable, versioned SDK wheel or approve a public prerelease.
11. Establish logs, redaction checks, alerting, and immutable-image rollback.

## Repository validation

Passed:

- `git diff --check`
- devcontainer JSON and docs navigation JSON parsing
- `.devcontainer/post-create.sh` shell syntax
- Python SDK: 292 tests
- Python SDK Ruff lint and format checks
- branch-source import: `from igris import Igris`
- docs artifact generation and docs validation
- focused landing ESLint on every changed TypeScript/TSX file: zero errors
- focused Go API-key, Action-target, and Reconciliation tests

Not proven:

- clean wheel rebuild: local `uv` panicked in macOS system-configuration code
  before resolving the build environment;
- Rust focused test: the sandbox lacked cached `aes-gcm` and could not resolve
  crates.io; and
- full landing typecheck: existing unrelated Pricing, API, and component type
  failures remain outside this product-copy change.

These limitations do not change the hosted verdict: a clean cloud run must
repeat the build and test matrix before merge or deployment.

## Manual deployment steps

After the environment contract, secrets, migration verification, and explicit
deployment approval:

```bash
gh workflow run build-container-images.yml \
  --ref <merged-sha> \
  -f push=true

gh workflow run deploy-auth-azure.yml \
  --ref <merged-sha> \
  -f target_environment=staging \
  -f auth_image_digest='ghcr.io/igris-inertial/igris-auth@sha256:<digest>'

gh workflow run deploy-api-azure.yml \
  --ref <merged-sha> \
  -f target_environment=staging \
  -f api_image_digest='ghcr.io/igris-inertial/igris-api@sha256:<digest>'

gh workflow run deploy-console-azure.yml \
  --ref <merged-sha> \
  -f target_environment=staging \
  -f console_image_digest='ghcr.io/igris-inertial/igris-console@sha256:<digest>'
```

There is no verified managed Runtime deployment workflow. Add only the minimum
deployment packaging/configuration needed to run the existing Runtime; do not
redesign it.

After each deployment, record the workflow URL, image digest, Container App
revision, config version, health result, and rollback digest.

## Exact next PRs

1. `docs/hosted-alpha-product-truth`
   - PRD, agent guardrails, cloud development, landing/docs/SDK truth, and
     readiness reports.
2. `ops/hosted-alpha-environment-contract`
   - Resolve environment naming; validate required Azure secret references;
     add redacted configuration preflight and smoke/rollback runbook.
3. `ops/hosted-alpha-neon-070-072`
   - Add operator attestation and exact migration verification; applying the
     migrations remains a separately approved production operation.
4. `fix/hosted-alpha-auth-email`
   - Close only proven BetterAuth/Resend deployment or failure-handling gaps and
     add live smoke coverage.
5. `ops/hosted-alpha-runtime-target`
   - Package/deploy the existing Runtime, set the one-target allowlist, and
     prove registration/heartbeat/dispatch/receipt without architecture changes.
6. `release/igris-sdk-0.1.0a3`
   - Verify ownership, build and inspect the wheel, clean-install it, and publish
     only after explicit release approval.
7. `fix/hosted-alpha-reconciliation-console` (conditional)
   - Add the smallest Reconciliation view only if operator-assisted API handling
     is unacceptable to External User #1.

PRs 2–6 should remain separately reviewable. Database application and public
package publication are approval-gated operations, not automatic PR effects.

## External User #1 readiness

**NOT_READY**

Docs and landing source can be finished before deployment, and the console can
be deferred for an operator-assisted first user. External User #1 becomes ready
only when:

- a clean SDK install succeeds from a versioned artifact;
- authentication and API-key issuance work;
- the managed API and existing Runtime are healthy;
- Neon is verified through migration 072;
- the exact HTTPS target and allowed domain are configured;
- a real `deploy.staging` Action completes through Run to honest Proof;
- uncertain effects do not blindly replay;
- Reconciliation is operational; and
- observability and rollback are rehearsed.
