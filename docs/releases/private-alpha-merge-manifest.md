# Private-Alpha Merge Manifest — `release/igris-private-alpha-v0.1.0-alpha.1-final`

**Date:** 2026-07-12 (finalized same day; supersedes the `a60e399e3`-era
artifact record below)
**Prepared by:** Release integration (principal release engineer)
**Purpose:** Auditable record of exactly what the private-alpha release
contains, how it was assembled, and what was validated. This manifest adds no
product behavior.

## 1. Release base and tip

| Field | Value |
| --- | --- |
| Final release branch | `release/igris-private-alpha-v0.1.0-alpha.1-final` |
| Approved release candidate | `a60e399e35c032cb174b2b2e7a5719464e8bc31a` — tip of `release/igris-private-alpha-v0.1.0-alpha.1` (validated RC; ancestor of this branch) |
| CI branch base (exact) | `40825a90028fc25752cd40934c0c14b9ab07af93` — tip of `feature/igris-private-alpha-ci`, verified to descend directly from the RC; adds `f94513a02` (reproducible artifact verification), `e68d9bcf0` (secure private-alpha PR pipeline), `40825a900` (truthful installation guidance, PA-002) |
| Release base (RC's own base) | `c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` — tip of `feature/igris-private-alpha-integration` (Agent G integration freeze) |
| Upstream base (merge-base with local `main`) | `abf27d2da8d7ee15f3a07e5fbd8571430ab4fe0d` (merge-base with `origin/main`: `c10cf9087c076f9fdc6185c585f865f1d4fe3007`) |
| Finalization commits on this branch | `7e928346f05b9990787cc42aa868f48678d74255` (close PA-002), the commit refreshing this manifest, and the commit adding `docs/releases/private-alpha-pr-description.md` — all documentation-only |
| Final release tip | The last commit on `release/igris-private-alpha-v0.1.0-alpha.1-final` (adds the PR description package); its exact SHA is recorded in the release report and must head the alpha.1 integration PR. No commit after `40825a900` touches `sdk/python`, product code, or migrations. |

No history was squashed, rebased, or rewritten. All imported commits below are
ancestors of the release tip with their original SHAs.

## 2. Imported work by agent

### Agent C — Connected slices (contract synchronization + evidence ingestion)

| SHA | Subject |
| --- | --- |
| `7e91d1b56` | feat(contracts): immutable ActionContract version persistence + production canonicalizer |
| `823c81ece` | feat(api): POST /v1/contracts/sync — Connected contract synchronization |
| `3a20ea910` | feat(sdk): explicit Connected mode — automatic ActionContract sync before first execution |
| `2998a12bf` | test(e2e) + docs: prove and document the first Connected slice (tip of `feature/igris-connected-contract-sync`) |
| `31bf6f17d` | feat(db+store): Embedded SDK evidence schema and append-only store |
| `61e972bcf` | feat(api): POST /v1/evidence/batches — Connected Embedded evidence ingestion |
| `5a595912f` | feat(sdk): igris evidence sync — explicit Connected evidence upload |
| `b30767da1` | test(e2e) + docs: prove and document the Connected evidence-ingestion slice (tip of `feature/igris-connected-evidence-ingestion`) |

Attribution source: `docs/security/igris-connected-contract-sync-release-gate.md`
("Agent C's first Connected slice…") and
`docs/security/igris-connected-evidence-ingestion-threat-model.md`
("Agent C implements evidence ingestion").

### Agent G — Private-alpha integration (owner of the release base)

| SHA | Subject |
| --- | --- |
| `7424580bb` | fix(sdk): refuse contract sync redirects (closes PA-001) |
| `f6ac922d4` | fix(api): make contract sync idempotency atomic |
| `f5bb28488` | feat(db): enforce Connected record immutability (migration 069) |
| `cad9168d4` | test(e2e): prove private alpha cross-slice flow |
| `2a7c1203f` | test(sdk): prove contract redirects never follow |
| `c71bd8e60` | docs(release): record private alpha readiness (integration tip / release base) |

### Agent H — Private-alpha developer-experience kit

| SHA | Subject |
| --- | --- |
| `522944997` | feat(examples): add private-alpha refund evaluation |
| `6e2eb776a` | docs(alpha): add onboarding trust and failure guides |
| `970d2e1f7` | test(alpha): add clean-environment acceptance harness |

Patch-equivalent to `feature/igris-private-alpha-developer-experience`
(`d748e692f`, `809e91bdb`, `c55ba3968`).

### Agent F — Security gates and reviews

| SHA | Subject |
| --- | --- |
| `3d4ab18d8` | docs(security): audit connected contract synchronization |
| `d3a88c1d6` | docs(security): correct evidence-ingestion ownership wording |
| `2587f5aae` | docs(security): define connected evidence ingestion release gate |
| `5d8a615bc` | docs(security): audit connected evidence ingestion |
| `9d3a7d6ac` | docs(security): final delta review for private-alpha integration — cherry-pick (`-x`) of `e6a8aa6cae5210eb7d38079cfa073f8652f2ad8a` from `feature/igris-connected-evidence-security-gate`; adds only `docs/security/igris-private-alpha-integration-final-delta-review.md` |

Patch-equivalent to `feature/igris-connected-sync-security-gate` (`e1d5c0e98`,
`478f67f35`) and `feature/igris-connected-evidence-security-gate` (`d45c457ff`,
`f69590c8a`, `e6a8aa6ca`).

### Other imported work in the release base (pre-slice foundation)

| SHA | Subject | Origin branch |
| --- | --- | --- |
| `147103bf3` | Characterize Igris core integration readiness | `feature/igris-core-integration-readiness` |
| `0507c1d53` | test(contract-v1): conformance fixtures generated from the real Embedded SDK | `feature/igris-progressive-contract-reconciliation` |
| `23b52c46d` | docs(architecture): progressive contract v1 ADR, Connected API v1 spec, data impact | `feature/igris-progressive-contract-reconciliation` |
| `48664afcb` | docs(architecture): first Connected slice plan — contract synchronization only | `feature/igris-progressive-contract-reconciliation` |
| `59af52ac0` | docs(architecture): separate execution provenance from evidence lifecycle | `feature/igris-progressive-contract-reconciliation` |
| `c2da00d9b` | fix(sdk): make post-execution evidence failures non-retryable | `feature/embedded-sdk-release-hardening` |
| `3845e937d` | ci(sdk): add embedded Python release checks | `feature/embedded-sdk-release-hardening` |
| `f04a9f27c` | docs(sdk): document embedded release blockers | `feature/embedded-sdk-release-hardening` |

### Release-branch-only commits (this consolidation)

| SHA | Subject |
| --- | --- |
| `9d3a7d6ac` | docs(security): final delta review for private-alpha integration (cherry-pick, listed under Agent F) |
| `eae0c06b6` | docs(alpha): resolve PA-001 and record PA-002 remaining condition |
| (manifest commit) | docs(releases): record private-alpha merge manifest |

## 3. Ancestry and patch-equivalence audit

Verified with `git merge-base --is-ancestor` and `git cherry` against the
release tip:

- **Ancestors (contained with original SHAs):**
  `feature/embedded-igris-sdk-foundation` (`c10cf9087`),
  `feature/igris-connected-contract-sync` (`2998a12bf`),
  `feature/igris-connected-evidence-ingestion` (`b30767da1`),
  `feature/igris-progressive-contract-reconciliation` (`59af52ac0`),
  `feature/igris-private-alpha-integration` (`c71bd8e60`).
- **Patch-equivalent (every branch commit shows `-` in `git cherry`):**
  `feature/embedded-sdk-release-hardening` (3/3),
  `feature/igris-core-integration-readiness` (1/1),
  `feature/igris-connected-sync-security-gate` (2/2),
  `feature/igris-connected-evidence-security-gate` (3/3),
  `feature/igris-private-alpha-developer-experience` (3/3).
- **No branch patch is unrepresented in the release history.**

## 4. Migrations — manual runbook only

| Migration | Purpose | Status |
| --- | --- | --- |
| `igris-overture/database/migrations/067_action_contract_versions.sql` | Append-only ActionContract version persistence | **Created, NOT applied to any shared system.** Manual runbook only. |
| `igris-overture/database/migrations/068_sdk_evidence_ingestion.sql` | Tenant-scoped SDK signing keys + append-only evidence batches/events | **Created, NOT applied to any shared system.** Manual runbook only. |
| `igris-overture/database/migrations/069_connected_immutable_records.sql` | BEFORE UPDATE/DELETE immutability triggers on Connected tables | **Created, NOT applied to any shared system.** Manual runbook only. |

During release validation these migrations were applied **only inside
disposable local PostgreSQL databases/schemas created for the test run and
dropped afterward** (per Agent F condition 2: never auto-applied by merge).

## 5. Release artifacts (built from the final alpha.1 tip)

Built with `uv build` (hatchling backend) from `sdk/python`. **These hashes
supersede the `a60e399e3`-era values** (wheel
`f2475542bf3f1e2f4446c41c91cadf23a05caf427987f10a594f284a5fbac747`, sdist
`b250a712403569e6dcf5c003d6023df1333b610eea76534dafecb75a81effb6f`): commit
`40825a900` rewrote `sdk/python/README.md`, whose content is embedded in the
wheel `METADATA` and the sdist, so the artifact bytes changed. No commit after
`40825a900` touches `sdk/python`, so artifacts built at `7e928346f` are those
of the final exact tip (re-verified by rebuilding at the final tip after the
last documentation commit).

| Artifact | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `igris-0.1.0-py3-none-any.whl` | 47,799 | `47b73b5a131ddc47a570cc7782f0d4e6a4e96823106dd026c3f251ed50519d05` |
| `igris-0.1.0.tar.gz` (sdist) | 39,448 | `3fbbe7013607079729c5ae8aedc851662cf5fb9b6413d05bb9e3777e9a99d3c3` |

Determinism evidence: `scripts/ci/sdk_artifact_check.sh` built wheel + sdist
twice into isolated directories with byte-identical SHA-256, and a third
independent build via `make sdk-python-release-check` (sdist → wheel path)
produced the same hashes. Contents were inspected (`py.typed` + `LICENSE`
packaged; no tests, signing keys, or journals), and the wheel and sdist were
each installed into separate clean virtual environments with import, guard
execution, `key-info`, `verify`, `evidence sync --help`,
`evidence status --help`, and `pip check` smokes. **No artifact was
published. No Git tag was created.**

### Validation commands and CI surface (final tip)

- Local pipeline: `make private-alpha-ci` → `scripts/ci/private_alpha_ci.sh
  all` (stages: migrations, python 3.10–3.13 matrix with per-run interpreter
  assertion, go, disposable postgres, artifacts, harness) — all stages passed
  locally at `7e928346f`.
- Additional local runs: `make sdk-python-release-check`; repository-wide
  `go vet ./...` (report-only, see §7); migration-guard negative test
  (temporary offending script → guard fails as designed);
  `scripts/ci/run_alpha_harness.sh` (exactly 5 journal events: 2 allowed
  decisions, 1 denied decision, 1 succeeded outcome, 1 failed outcome,
  offline-verified).
- CI workflow file: `.github/workflows/private-alpha-ci.yml` (jobs:
  `migration-guard`, `python-matrix`, `go-suites`, `go-postgres`,
  `sdk-artifacts`, `alpha-harness`; documented in
  `docs/ci/private-alpha-ci.md`). Validated locally (YAML parse, job
  inventory, all actions SHA-pinned). **GitHub-hosted CI has not executed
  against this branch** — the branch was not pushed at preparation time.

## 6. Accepted private-alpha residuals

Per the final Agent F delta review (CONDITIONAL GO, condition 1):

1. Non-redacted ordinary function-argument values can appear in signed journals
   and thus in explicit evidence uploads (`redact=[...]` required for full
   suppression).
2. Process-local rate limits; no shared tenant budgets.
3. Coarse full-tenant API keys.
4. No key rotation/revocation.
5. Evidence idempotency is not yet concurrent-atomic (the contract path is).
6. Compromised-host Embedded honesty bound; `verified` ≠ side-effect proof.
7. One evidence stream per `(tenant, key_id)`.
8. ~~PA-002 remains partially open~~ — **RESOLVED** on this branch: commit
   `40825a900` rewrote the README installation section around the supplied
   wheel / local build / Git-source paths and labels `pip install igris` /
   `uv add igris` as post-publication only; disposition closed at
   `7e928346f` (see `docs/alpha/private-alpha-defects.md`).

## 7. Production-enablement blockers (not private-alpha blockers)

1. Distributed rate limiting.
2. Storage quotas / retention.
3. Key rotation and revocation product path.
4. Historical migration bootstrap repair for greenfield full-chain deploys
   (clean full-history migrate fails at `001`/`010`; disposable Connected
   paths 054+067+068+069 work). Owned by Agent J.
5. Atomic evidence idempotency (parity with contract path).
6. Repository-wide `go vet` hygiene (pre-existing defects, not introduced by
   this release; report-only in this validation). Observed at this tip:
   `igris-overture/security/fleet_crypto.go:321` unreachable code and
   `igris-overture/providers/key_rotation_test.go:262` import placement — both
   files unchanged since before the release base. All packages changed by the
   release delta (`igris-overture/api`, `igris-overture/coordinator`,
   `igris-overture/internal/canonicaljson`, `conformance/contractv1`,
   `cmd/igris-overture`) pass `go vet` clean.

## 8. Separate legacy SDK repository dependency

The legacy `igris-python-sdk` repository (branch
`feature/igris-inertial-namespace-vnext`, commit
`0b91b2525a78b1de26250d767600a4e9da5ffeaa`) governs the PyPI namespace
migration that blocks public publication. It is a **separate repository**: its
history was not imported into, and is not modified by, this release branch.
Public publication of `igris` remains blocked until that migration is resolved.

## 9. Deployment / publication / shared-system statement

- **No deployment** was performed (no Azure, no VPS, no staging).
- **No package was published** (no PyPI, no internal index).
- **No migration was applied to any shared database.** All migration activity
  occurred in disposable local PostgreSQL databases created for the validation
  run and dropped afterward.
- **No public Git tag was created.** A local candidate tag
  (`v0.1.0-alpha.1-rc`) is proposed in the release report but was not created.
- **No push to any remote** was performed from this release branch.
