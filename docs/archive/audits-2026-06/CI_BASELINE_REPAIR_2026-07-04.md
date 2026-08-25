# CI Baseline Repair — 2026-07-04

Repairs the pre-existing main-branch CI failures that were triaged during PR #58
review (see the triage comment on PR #58). PR #58 itself was validated and is
not the cause of any of these.

## Fixed in this branch

### 1. Rust runtime workspace tests — `igris-fleet::tests::test_telemetry_collection`

- **Symptom:** `telemetry.metrics` empty → assertion failure on every runner
  without a live runtime on `localhost:8080`.
- **Cause:** `FleetAgent::collect_telemetry` was the only network-touching
  method in the crate without a `mock_mode` branch — it always scraped
  `http://localhost:8080` for Prometheus metrics and fell back to an empty map.
- **Fix:** added the missing `mock_mode` branch returning deterministic mock
  telemetry, mirroring the crate's existing mock telemetry shape
  (`requests_total` / `latency_p99_ms` / `error_rate`, healthy status).

### 2. Fast deterministic proof gate — `scripts/ci_proof_gate.sh`

- **Symptom:** job failed instantly: `#!/bin/zsh` does not exist on Ubuntu
  runners.
- **Fix:** ported to `#!/usr/bin/env bash` and removed the only zsh-ism
  (`setopt TYPESET_SILENT`); everything else was already bash-compatible.
  Verified end to end: `bash scripts/ci_proof_gate.sh fast` passes locally
  (migrations, schema preflight, focused Go tests).
- **Heavy tier too:** the heavy proof job also runs on every push to `main`
  (`proof-gate.yml`), and every script it invokes — directly and through
  `proof_suite.sh` — had the same `#!/bin/zsh` shebang. All nine were scanned
  for zsh-only constructs (one more `setopt TYPESET_SILENT`, now removed;
  nothing else) and ported to bash with `bash -n` syntax verification:
  `action_task_v1_cumulative_clean_host_recovery_proof_demo.sh`,
  `action_task_v1_clean_host_recovery_proof_demo.sh`,
  `action_task_v1_recovery_proof_demo.sh`, `action_task_v1_proof_demo.sh`,
  `proof_suite.sh`, `task_v1_proof_demo.sh`, `unified_execution_proof_demo.sh`,
  `fallback_execution_proof_demo.sh`, `checkpoint_proof_demo.sh`.

### 3. Governance Postgres migrations — `TestRoboticsPolicyActivationWithPostgresMigrations`

- **Symptom:** expected 201, got 403.
- **Cause:** the shared request-signing helper
  (`signedRoboticsPolicyRouteRequest`) sends signer header
  `policy-admin@example.test`, but this test inserted its signing keys with
  `signer_identity = 'tenant-real-pg@example.test'`. The handler correctly
  rejects the mismatch (`policy_signer_identity_mismatch`). Handler behavior is
  right; the test fixture was inconsistent with the helper.
- **Fix:** test-only — key rows now use the helper's signer identity, and the
  audit-row assertion checks the same identity.

## Unmasked by the fixes above (found on the first PR #59 CI run)

Fixing the first failure in each job let CI progress further than `main` ever
had, exposing two more pre-existing failures. Both are repaired in this branch.

### 5. Governance Postgres migrations — `TestTenantEmailAlignmentMigration_AddsAndBackfillsColumn`

- **Symptom:** `sql: Scan error on column ... "tenant_email": converting NULL
  to string is unsupported`. Never seen on `main` because the job died at the
  robotics step (item 3) before this step ran.
- **Cause:** migration `050_tenant_email_alignment.sql` guarded its backfill
  with `information_schema.columns WHERE table_schema = 'public'`. The test
  applies the migration inside an isolated per-test schema; on a clean CI
  database there is no `public.tenants`, so the guard was false and the
  backfill silently skipped. It passed on dev databases only because they
  happen to have a `public.tenants`.
- **Fix:** the guard now resolves `tenants` through the current search_path
  (`pg_attribute` + `to_regclass('tenants')`), i.e. it inspects the same table
  the migration's own `ALTER TABLE` just modified. In production, where
  `tenants` is in `public`, this is equivalent — no behavior change, still
  idempotent. Reproduced the NULL with the old guard and verified the fix on a
  clean scratch database.

### 6. Rust runtime workspace tests — `igris-server` containment integration

- **Symptom:** both `containment_integration` tests fail on GitHub runners:
  `worker execution should succeed: Cpu` and the timeout test not returning
  `Err(ViolationKind::Time)`. Never seen on `main` because cargo's fail-fast
  stopped at the fleet failure (item 1) before this test binary ran.
- **Cause:** not load flakiness — deterministic. On Linux the supervisor fails
  closed: `spawn_worker` errors (surfaced as `ViolationKind::Cpu`) when the
  worker cannot be attached to a containment cgroup. GitHub-hosted runners do
  not allow the unprivileged job user to create cgroups under
  `/sys/fs/cgroup`, so both tests failed at spawn, before any containment
  logic ran.
- **Fix:** test-only. The tests now probe cgroup creatability once (via the
  crate's existing `igris_safety::cgroup::CGroup` API) and skip with a printed
  reason when the environment cannot create cgroups. They still run fully on
  non-Linux dev hosts (cgroup attach is a documented no-op there) and on any
  Linux with cgroup permissions (privileged/self-hosted runners). Supervisor
  fail-closed behavior is untouched.

### 7. Governance Postgres migrations — coordinator replay tests (unmasked by item 5's fix)

Once the API-key auth step passed, the job reached the next step for the first
time: `TestRoboticsReceiptReplayWithPostgresMigrations` and
`TestAIToolReplayPostgres043` failed. Two independent fixture bugs, both
test-only:

- **Wrong signing helper for receipts:** both tests signed execution receipts
  with `signedRuntimeArtifactJSON`, which signs the whole-JSON canonical form
  used for *envelopes*. Receipts are verified against the runtime's
  fixed-field canonical form (`internal.canonicalReceiptBytes`, mirroring
  `receipt.rs`), so verification failed with `runtime_signature_invalid`. The
  passing mock-driver unit twin already used the correct `signedReceiptJSON`
  helper; the Postgres tests now do too.
- **Stale migration list:** `TestAIToolReplayPostgres043` applied migrations
  only up to 043, but the artifact-persistence path reads `task_records`
  through the full `GetTask` column list, which now includes columns from 034
  (canceled_at), 035 (failure_details), 049 (proof verification summary),
  054/055 (action execution targets), 062 (registered agent), plus the
  execution_context table from 047. The migration list now includes them.

### 8. Tenant isolation Postgres tests (unmasked by item 7's fix)

The job's final step had two more latent failures:

- **`TestExecutionLineageTenantIsolationPostgres`** inserted `task_records`
  rows without `idempotency_key`, which migration 031 has always declared
  `NOT NULL` — the fixture could never have passed against real Postgres.
  Fixed by giving each inserted task a unique idempotency key.
- **`TestExecutionContextTenantBoundMigrationPostgres`** failed because
  migration `060_execution_context_tenant_bound.sql` has the same bug class
  as item 5: both of its existence guards were hardcoded to
  `information_schema.tables WHERE table_schema = 'public'`, so in a
  schema-isolated database the tenant backfill and constraint application
  were silently skipped. Both guards now use `to_regclass('execution_context')`,
  which resolves through the search_path. In production, where the table is
  in `public` (060 was applied to prod 2026-06-23), this is equivalent — the
  migration remains forward-only and safe to re-run.

After these fixes the entire four-step `backend-postgres.yml` job sequence was
run locally against a freshly created empty database and every step passed.

## External — requires a manual Cloudflare dashboard change

### 4. `Cloudflare Pages: igris-console`

- **Symptom:** the check fails instantly on every push to `main`.
- **Finding:** the check is posted by the `cloudflare-workers-and-pages`
  GitHub App, not by anything in this repo. No repo file references an
  `igris-console` Pages project (the only Pages configs are
  `web/apps/web-landing/wrangler.toml` and `web/apps/web-docs-hub/wrangler.toml`,
  and their sibling checks pass). The product's console is the Rails app at
  `web/apps/rails-console`, shipped as the `igris-console` container image to
  Azure Container Apps — it is not, and should not be, a Cloudflare Pages site.
- **Manual fix (Cloudflare dashboard):** Workers & Pages → select the
  `igris-console` Pages project → Settings → either **delete the project** or
  disconnect its Git integration (Builds & deployments → disconnect the
  `Igris-inertial/system` repository). Once disconnected, the app stops posting
  the failing check on new commits.
- Do **not** add a wrangler.toml or build config for it in the repo — that
  would recreate the May 2026 shared-Pages-root conflict this repo already
  guards against (`pages-config-guard` CI job).

## Observed but intentionally out of scope

- **`igris-btree` doc-tests fail to compile** (24 failures under
  `cargo test --workspace`). CI's "Rust runtime workspace tests" job runs
  `cargo test --workspace --lib --bins --tests` — doc-tests are never executed
  in CI, so this does not affect the baseline. Pre-existing; worth a separate
  cleanup.
- ~~`igris-server::containment_integration` assumed to be a load-induced local
  flake~~ — superseded: the CI failure was deterministic (cgroup permissions),
  see item 6 above.
