# Igris Inertial

Igris lets coding agents safely execute consequential actions through a durable
**Action → Run → Proof** boundary.

Keep your coding agent, application, and delivery tools. Configure an Action
once, submit Runs with stable business idempotency keys, and inspect honest
Proof afterward. The hosted-alpha wedge is:

- `deploy.staging`
- `deploy.production`
- `migrate.database`
- `publish.package`

Igris is not an agent framework or workflow builder. REST is the canonical
managed interface; the Python SDK is a thin convenience layer.

## First integration path

The managed SDK flow is:

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

Action configuration is a one-time operator/setup concern. Ordinary agent calls
use the Action name and a meaningful idempotency key; they do not need to know
about internal execution components.

See the
[Durable Action Quickstart](./sdk/python/docs/durable-action-quickstart.md) for
the source-backed `Igris.from_env()` → `configure_action()` → `run()` →
`wait()` → `proof()` flow.

## Safe failure and honest Proof

Idempotency prevents duplicate submissions inside Igris. It does not make an
external system exactly-once. If Igris cannot determine whether an external
effect occurred, it blocks blind replay and surfaces exceptional
Reconciliation.

Proof records what Igris authorized, dispatched, observed, and verified.
Signatures and hash-linked records can establish integrity and provenance of
Igris-observed events; they do not cryptographically prove that an
external-world effect was correct.

Action Protocol is the open trust and interoperability layer underneath Igris.
It is advanced material, not the first onboarding step. Internal components
such as Overture, Runtime, WAL, checkpoints, bindings, and receipts are
documented for contributors and operators, not required for ordinary use.

## Product truth

[docs/product/PRD.md](./docs/product/PRD.md) is the canonical product
definition, allowed engineering policy, and frozen-scope policy.

## Start Here

- Product truth: [docs/product/PRD.md](./docs/product/PRD.md)
- Managed SDK quickstart: [sdk/python/docs/durable-action-quickstart.md](./sdk/python/docs/durable-action-quickstart.md)
- Cloud development: [docs/development/cloud-development.md](./docs/development/cloud-development.md)
- Docs app: [web/apps/web-docs-hub](./web/apps/web-docs-hub)
- Docs overview: [web/apps/web-docs-hub/content/docs/index.mdx](./web/apps/web-docs-hub/content/docs/index.mdx)
- First tenant action: [web/apps/web-docs-hub/content/docs/first-tenant-action.mdx](./web/apps/web-docs-hub/content/docs/first-tenant-action.mdx)
- Quick start: [web/apps/web-docs-hub/content/docs/quickstart.mdx](./web/apps/web-docs-hub/content/docs/quickstart.mdx)
- First verified run: [web/apps/web-docs-hub/content/docs/first-verified-run.mdx](./web/apps/web-docs-hub/content/docs/first-verified-run.mdx)
- Request -> Execute -> Verify: [web/apps/web-docs-hub/content/docs/request-execute-verify.mdx](./web/apps/web-docs-hub/content/docs/request-execute-verify.mdx)
- Verification: [web/apps/web-docs-hub/content/docs/verification.mdx](./web/apps/web-docs-hub/content/docs/verification.mdx)

## Run The Approval Loop Locally

To prove the controlled action path end to end on your own machine (local
Postgres, Overture, Runtime, starter Action Pack, MCP-triggered
`demo.needs_approval`, human approve/reject, proof inspection):

```bash
make igris-local-up          # provision local Postgres, run migrations, doctor
make approval-loop-smoke     # the full durable approval loop, with assertions
```

`make approval-loop-smoke-console` also boots the Rails console in real data
mode and verifies the operator approval panel renders for a waiting run.
The first run builds the Rust runtime, which takes a while; later runs reuse
the binary. See [scripts/approval_loop_smoke.sh](./scripts/approval_loop_smoke.sh)
for exactly what is asserted.

## Internal Dogfood: Controlled Staging Migration

The first workflow we run through Igris for our own engineering work: applying
a SQL migration to a **staging/local** database only after a recorded plan and
an explicit human approval, with a signed receipt and a database-side audit
trail. Contract and acceptance record:
[DOGFOOD_STAGING_MIGRATION_2026-07-03.md](./docs/archive/dogfood-2026-07/DOGFOOD_STAGING_MIGRATION_2026-07-03.md).

```bash
make igris-local-up               # once: local Postgres + migrations
make dogfood-migration-smoke      # scripted end-to-end proof (~30s warm)
make dogfood-migration-smoke-console   # same, plus console approval panel
```

Operator flow for a real (local/staging) migration:

```bash
# 1. start the staging-only gateway — the ONLY process that holds the DSN;
#    it refuses non-loopback databases and path-escaping filenames
node scripts/dogfood_staging_migration_gateway.js serve 18095 "$DATABASE_URL"

# 2. record the plan (filename must live in igris-overture/database/migrations)
curl -s -X POST localhost:18095/plan -d '{"filename":"064_execution_evals.sql"}'

# 3. request the apply through Igris (MCP call_action or /v1/actions/:name/run),
#    passing metadata.request_summary (e.g. "apply 064_execution_evals.sql
#    sha256 3471cf5d") so the approver sees what the run intends
#    -> the run pauses in approval_required
# 4. review in the console (/runs/<id>) and the gateway (GET /plans), approve
# 5. the gateway permits at most one apply; inspect the database, run,
#    signed receipt, and dogfood_migration_audit row before declaring success
```

The gateway enforces staging-only (loopback DSN), plan-checksum match at apply
time, and at-most-once apply — independently of Igris policy. Overture, the
runtime, and the console never see database credentials.

## Internal Dogfood: Igris-Routed Development

The second dogfood loop routes risky development actions through Igris itself:
`repo.run_tests` (auto-approved fixed command), `repo.push_branch` and
`repo.open_pr` (human-approved, dry-run by default; real PR creation is
intentionally disabled).

- Operator guide (start here):
  [DOGFOOD_ROUTED_DEV_OPERATOR_GUIDE.md](./docs/archive/dogfood-2026-07/DOGFOOD_ROUTED_DEV_OPERATOR_GUIDE.md)
- Normative contract:
  [DOGFOOD_IGRIS_ROUTED_DEVELOPMENT.md](./docs/archive/dogfood-2026-07/DOGFOOD_IGRIS_ROUTED_DEVELOPMENT.md)

```bash
make igris-local-up               # once: local Postgres + migrations
# run from a NON-main branch — the gateway refuses main/master
make dogfood-routed-dev-smoke
IGRIS_SMOKE_CONSOLE_PORT=3101 make dogfood-routed-dev-smoke-console
```

## Staging readiness

Staging is the current milestone. Before any staging or production
deployment, the credential rotation in
[SECURITY_ROTATION_2026-07-04.md](./docs/archive/point-in-time/SECURITY_ROTATION_2026-07-04.md) must be
completed and attested.

## SDK installation

`igris-sdk` is not currently published on PyPI. Do not run `pip install igris`:
that name belongs to an unrelated project.

For repository and operator-assisted alpha use:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install ./sdk/python
```

The distribution name is `igris-sdk`; the import is `from igris import Igris`.
See [sdk/python/RELEASE.md](./sdk/python/RELEASE.md) for the publication gate.

## Advanced Local Validation

To validate the core product promise on a developer machine, run the local proof
loop:

```bash
make run-recover-prove-local-provision
```

The command provisions or reuses local Postgres, applies the Overture migrations,
runs setup checks, and executes the live Run / Recover / Prove demo without
`--skip-live`. It can use an existing `DATABASE_URL`/`POSTGRES_URL`, Homebrew
Postgres on macOS, or Docker Compose when Docker is already installed. Docker is
optional, not a gate for the local proof loop.

A successful run shows that Igris can run a deterministic local agent action,
recover by blocking an irreversible failed action from automatic replay, and
prove the run through signed runtime evidence and verification endpoints
returning HTTP `200`.

Expected successful output includes:

- `live action path: real`
- `signed callback mode: live-server-backed`
- `failure/recovery mode: live-server-backed`
- `receipt verify HTTP status: 200`
- `task verify HTTP status: 200`

This is a local developer proof, not a production guarantee. It does not claim
host hardening, broad fleet failover, or real-provider production readiness.
Use [Run, Recover, Prove Locally](./docs/RUN_RECOVER_PROVE_LOCAL.md) for the
full runbook, Homebrew/manual Postgres setup, optional Docker lifecycle
commands, and troubleshooting.

External tester path:

1. Open [External Tester Checklist](./docs/EXTERNAL_TESTER_CHECKLIST.md).
2. Run `make run-recover-prove-local-provision`.
3. Share the checklist feedback answers and only redacted output.

Use [Replay Safety Demo](./docs/REPLAY_SAFETY_DEMO.md) for the recovery
scenario and [Receipt and Proof Spec v0.1](./docs/specs/IGRIS_RECEIPT_PROOF_SPEC_V0_1.md)
for the proof model.

## Repository Layout

- `igris-overture/`: control-plane and API implementation
- `igris-runtime/`: runtime implementation for local execution surfaces
- `web/apps/web-docs-hub/`: public documentation site
- `web/apps/web-landing/`: marketing and product website
- `web/apps/rails-console/`: **active console** — Rails app for actions, runs, runtimes, settings (served at `app.igrisinertial.com` / `console.igrisinertial.com`). See `web/apps/rails-console/README.md`.
- `rust-core/`: lower-level runtime and routing support code where applicable

## Architecture Context

Internal component names still exist in the codebase, but they are implementation details:

- the control plane coordinates hosted and hybrid execution workflows
- the runtime executes work in local environments
- the docs, landing site, and console explain and operate the same unified execution system

For the current architecture explanation, start with [Architecture](./web/apps/web-docs-hub/content/docs/architecture.mdx) instead of older multi-product descriptions.

## Validation

The docs app already includes validation and build checks:

```bash
pnpm --filter @igris/web-docs-hub lint
pnpm --filter @igris/web-docs-hub exec tsc --noEmit
pnpm --filter @igris/web-docs-hub build
```

## License

See the repository license and product-specific terms where applicable.

eval "$(rbenv init -)"
ruby --version   # should now show 3.2.2
bin/rails server
