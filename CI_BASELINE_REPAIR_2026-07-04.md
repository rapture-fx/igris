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
- **`igris-server::containment_integration::supervisor_executes_runtime_worker_job`**
  timed out once during a full parallel workspace run on a heavily loaded
  machine, and passes consistently in isolation. Load-induced flake, green on
  the CI runner; no change made.
