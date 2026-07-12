# PR: Igris Private Alpha v0.1.0-alpha.1 — Embedded SDK + first Connected slices

**Head branch:** `release/igris-private-alpha-v0.1.0-alpha.1-final`
**Base:** `main`
**Release type:** private alpha (invited evaluators only). **This is not a
public or production release.** No package is published, no environment is
deployed, and no migration is applied by this PR.

This document is the repository-owned PR body for the alpha.1 integration PR.
The authoritative content record is
`docs/releases/private-alpha-merge-manifest.md`.

## What Igris is (product boundary)

Igris is a local-first, SDK-first action layer for AI agents. A developer adds
`@igris.guard` to a consequential function; before the function runs Igris
records a signed decision event, and after it runs a signed outcome event, in
a hash-chained, offline-verifiable local journal.

- **Embedded** (default): works with no account and no backend, and performs
  **zero Igris network activity**. Local approval, local execution, signed
  local evidence, offline verification.
- **Connected** (explicit opt-in, both `IGRIS_API_URL` and `IGRIS_API_KEY`
  required): synchronizes ActionContract declarations before first execution
  and uploads signed evidence **only** via the explicit `igris evidence sync`
  command. Execution remains local in both modes.
- **Managed** execution, the console, remote/team approval, and central
  policy are **not part of alpha.1**.

## What this PR contains

### Embedded capabilities

- `@igris.guard` for synchronous functions (async/generators are rejected at
  decoration time with a typed error).
- Local approval, fail-closed before execution: if signing, redaction,
  canonicalization, approval, or the decision-event write fails, the guarded
  function does not run.
- Signed Ed25519 decision and outcome events in a hash-chained JSONL journal;
  `igris verify` performs full offline verification.
- Redaction before anything is hashed, shown, or persisted.
- `ExecutionCompletedEvidenceError` (`execution_occurred=True`,
  `retry_safe=False`) when execution completed but outcome evidence could not
  be persisted — the SDK never re-runs the function.

### Connected capabilities (explicit opt-in only)

- Automatic ActionContract v1 synchronization to `POST /v1/contracts/sync`
  before the first guarded execution of each contract version; contract
  descriptors only — **never argument values, journals, or keys**. Sync
  failure prevents execution (no silent unconnected fallback).
- Explicit `igris evidence sync` → `POST /v1/evidence/batches`: local
  verification first, then upload of signed events plus the PUBLIC key;
  server re-verifies every hash, signature, and chain link and stores
  evidence tenant-scoped with `execution_provenance=embedded` (structural —
  ingestion cannot mint Managed provenance).
- Redirect refusal on every credential-bearing request (all 3xx → typed
  error, Authorization never forwarded) — PA-001, resolved.
- Transactionally atomic contract idempotency; tenant isolation; Connected
  records database-immutable when migration 069 is applied.
- Contract synchronization records a declaration; it grants **no execution
  permission**. There is no remote policy evaluation, no remote approval, no
  automatic evidence upload.

### Release/CI content added on top of the approved RC (`a60e399e3`)

- `f94513a02` — reproducible artifact verification
  (`scripts/ci/sdk_artifact_check.sh`: double build, byte-identical check,
  content inspection, clean-env install smokes, artifact manifest).
- `e68d9bcf0` — secure private-alpha PR pipeline
  (`.github/workflows/private-alpha-ci.yml`, SHA-pinned actions, least
  privilege; local mirror `make private-alpha-ci` /
  `scripts/ci/private_alpha_ci.sh`; migration auto-apply guard
  `scripts/ci/check_manual_migrations.sh`).
- `40825a900` — truthful private-alpha installation guidance in
  `sdk/python/README.md` (resolves the remaining PA-002 condition).
- PA-002 closed in `docs/alpha/private-alpha-defects.md`; final artifact
  manifest refresh; this PR package.

## Test evidence (local validation at the final tip)

- **Python matrix (real interpreters, version-asserted per run):** full SDK
  suite — 179 passed on CPython 3.10.19, 3.11.6, 3.12.12, and 3.13.3; Ruff
  lint and format clean on each; `make sdk-python-release-check` passes.
- **Go:** `go build ./...` clean; focused `go vet` clean on release-critical
  packages (`igris-overture/api`, `coordinator`, `internal/canonicaljson`,
  `conformance/contractv1`, `cmd/igris-overture`); canonical-JSON +
  ActionContract v1 conformance suites pass; full `igris-overture/api` and
  `coordinator` suites pass.
- **Disposable PostgreSQL:** contract lifecycle/idempotency/concurrency/
  rollback/redirect suites, evidence lifecycle/tamper/concurrency/provenance
  suites, migration-069 immutability suite, Python-SDK end-to-end proofs, and
  the private-alpha cross-slice E2E — all green against a disposable database
  created and dropped by the run.
- **Artifacts:** wheel + sdist built twice in isolated directories,
  byte-identical SHA-256 across builds; contents inspected (py.typed +
  LICENSE packaged; no tests, keys, or journals); wheel and sdist installed
  into separate clean venvs with import/guard/key-info/verify/evidence-CLI/
  `pip check` smokes.
- **Alpha harness:** `scripts/private-alpha/validate_embedded.sh` — exactly 5
  signed journal events (2 allowed decisions, 1 denied decision, 1 succeeded
  outcome, 1 failed outcome), offline-verified.
- **Migration guard:** passes at this tip, and the negative test (an
  operational script referencing migration 067) fails the guard as designed.
- GitHub-hosted CI has **not** run against this branch (not pushed at
  preparation time); the workflow is validated locally (YAML parse, jobs,
  SHA-pinning) and mirrored by `make private-alpha-ci`.

Exact hashes, sizes, and commands: `docs/releases/private-alpha-merge-manifest.md`.

## Accepted alpha residuals (known, documented, not blockers)

1. Non-redacted ordinary argument values can appear in signed journals and
   thus in explicitly uploaded evidence (`redact=[...]` for full suppression).
2. Process-local rate limits; no shared tenant budgets.
3. Coarse full-tenant API keys.
4. No key rotation/revocation path yet.
5. Evidence idempotency is not concurrent-atomic (contract path is).
6. Compromised-host honesty bound; `verified` ≠ side-effect proof.
7. One evidence stream per `(tenant, key_id)`.

Security posture: final integration review = **CONDITIONAL GO** with no
merge blockers (`docs/security/igris-private-alpha-integration-final-delta-review.md`).
PA-001 and PA-002 are both RESOLVED (`docs/alpha/private-alpha-defects.md`).

## Explicitly excluded from alpha.1

Evidence privacy preflight and `wrap_tool`/`wrap_tools` (alpha.2 follow-ups,
separate branches); greenfield database bootstrap and production DB roles
(separate Connected staging PR); console changes; remote approval; central
policy; Managed execution; automatic evidence upload; durable outbox; key
rotation; billing; deployment or publication of any kind.

## Deployment and migration exclusions

- Migrations `067`, `068`, `069` are **manual-runbook-only**. This PR does
  not apply them anywhere; CI enforces that no workflow, startup path, or
  operational script references them.
- No PyPI or internal-index publication (public `igris` publication remains
  blocked on the legacy `igris-inertial` namespace migration — separate
  repository).
- No Azure/VPS/staging deployment. No Git tag.

## Reviewer guidance

- Start with `docs/releases/private-alpha-merge-manifest.md` (content
  inventory, ancestry audit, artifact hashes) and
  `docs/releases/private-alpha-readiness.md` (readiness decision).
- Security reviews live under `docs/security/` — the final delta review is
  the merge-gating document.
- The SDK surface is `sdk/python/` (README is the participant-facing
  document; RELEASE.md the internal one).
- Product docs for evaluators: `docs/alpha/` (quickstarts, what-leaves-your-
  machine, troubleshooting, scorecard, defects).
- Verify locally with `make private-alpha-ci` (requires uv, Go, and local
  PostgreSQL; creates and drops its own disposable database).
- No feature code changed after the approved RC — the six commits on top of
  `a60e399e3` (three CI commits, PA-002 closure, manifest refresh, this PR
  package) touch CI scripts/workflow and documentation only; treat any diff
  outside those areas as a review flag.

## Rollback considerations

- Merging this PR changes no running system: nothing is deployed, published,
  or migrated. Rollback of the merge is `git revert` of the merge commit (or
  deleting the branch pre-merge); no data or environment cleanup is needed.
- Alpha participants hold locally built or supplied wheels; no artifact
  registry entry exists to withdraw.
- If migrations were later applied manually and must be reversed, 067/068/069
  are additive (new tables/triggers); the runbook reversal is dropping the
  069 triggers and the 067/068 tables — but no shared system has them applied
  today.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
