# Schema-1 candidate resolution-boundary final review

Date: 2026-07-16

Review type: independent dependency-resolution reproducibility gate

Reviewed commit: `d3ac0512347c28a9e5886c2246f724b78e173270`

Reviewed range: `f7e73ae7140d6af7d80de70f19ca5bdd80fb104b..d3ac0512347c28a9e5886c2246f724b78e173270`

Verdict: **GO**

## Executive summary

The fixed uv resolver boundary is committed as one absolute project-wide
RFC3339 UTC timestamp. Two independent resolutions from clean Git exports,
using Python 3.11.6, uv 0.9.8, and isolated HOME, configuration, and cache
state, reproduced the committed lockfile byte-for-byte.

The exact frozen sync succeeded without a pre-existing virtual environment.
All 321 manifest artifacts verified, the Python candidate passed 120/120, the
existing Go path processed all 120 vectors while preserving the explicit
DIV-001 and DIV-002 records, and the complete local CI-equivalent sequence
passed. No hidden required repository state or protocol, vector, fixture,
production, migration, deployment, or package-version change was found.

**Clock 2C is closed. Clock 2D is authorized and should resume immediately.**

## Exact reviewed range

- Base: `f7e73ae7140d6af7d80de70f19ca5bdd80fb104b`
- Reviewed tip: `d3ac0512347c28a9e5886c2246f724b78e173270`
- Tip parent: `90700d853ded10dc0e9b844063ef38f3b831db59`
- Tip Git tree: `6d8f0c8f4eb269856ba713e8f6a487410d26e712`
- Range commits: exactly 2
  - `90700d853ded10dc0e9b844063ef38f3b831db59` — `fix(python): freeze uv dependency resolution cutoff`
  - `d3ac0512347c28a9e5886c2246f724b78e173270` — `test(python): enforce deterministic lock boundary`

The range changes exactly five files:

- `.github/workflows/schema1-conformance-candidate.yml`
- `conformance/schema1/python/check_python_lock_reproducibility.py`
- `conformance/schema1/python/test_python_lock_reproducibility.py`
- `sdk/python/pyproject.toml`
- `sdk/python/uv.lock`

The full diff contains only the fixed resolver cutoff, the lockfile's matching
cutoff metadata, fail-closed guard code and tests, and CI invocation of the
guard.

## Final verdict

**GO**

The committed project configuration independently reproduces the committed
lockfile. The frozen installation and all candidate gates pass. No concrete
remaining packaging or dependency reproducibility defect was found.

No further generic packaging, dependency, or protocol review cycle is
required before Clock 2D.

## Review branch and commit

- Review branch: `review/igris-schema1-resolution-boundary-final`
- Review worktree: `/Users/wira/Desktop/system-worktrees/igris-schema1-resolution-boundary-final`
- Evidence commit under review: `d3ac0512347c28a9e5886c2246f724b78e173270`
- Starting state: clean, with no project `.venv`
- Current `origin/main`: `1ef093a96dc8ae55c317266aa9b0dc94e5b08579`
- Git: `2.49.0`
- Python: `3.11.6`
- uv: `0.9.8 (85c5d3228 2025-11-07)`
- Go: `go1.26.4 darwin/amd64`

The review artifact's containing commit is reported in the external handoff;
the document intentionally avoids a self-referential commit hash.

## Resolver cutoff assessment

The committed project contains exactly one general resolver boundary:

```toml
[tool.uv]
exclude-newer = "2026-07-16T15:07:12Z"
```

Assessment:

- the value is an absolute RFC3339 UTC timestamp;
- no relative or moving window is used;
- the setting is in the `sdk/python` project consumed by
  `uv sync --project sdk/python`;
- the setting applies to all registry dependencies rather than only Ruff;
- the lock records the same value in `[options]`;
- regeneration kept project configuration enabled while isolating user-level
  HOME and configuration state; and
- no user-level uv configuration or environment override was required.

uv documents that `exclude-newer` limits candidates by individual artifact
upload time and supports project-level `[tool.uv]` configuration:
[uv `exclude-newer` setting](https://docs.astral.sh/uv/reference/settings/#exclude-newer).

## Cutoff eligibility validation

The old and corrected lockfiles contain identical 32 package records. The only
lockfile delta is the recorded resolver cutoff.

- Locked artifact records examined: 492
- Latest intended artifact: tzdata 2026.3 at
  `2026-07-10T08:50:37.887Z`
- All intended locked artifacts precede the cutoff: yes
- Intended Ruff version: `0.15.21`
- Ruff 0.15.21 files eligible before cutoff: 18/18
- Ruff 0.15.22 files eligible before cutoff: 0/18
- Unexpected dependency changes: none

Independent PyPI metadata showed Ruff 0.15.21 uploads from
`2026-07-09T20:00:53.998138Z` through `2026-07-09T20:01:34.005336Z`, and Ruff
0.15.22 uploads from `2026-07-16T15:13:19.452734Z` through
`2026-07-16T15:14:13.244069Z`.

- [Ruff 0.15.21 PyPI metadata](https://pypi.org/pypi/ruff/0.15.21/json)
- [Ruff 0.15.22 PyPI metadata](https://pypi.org/pypi/ruff/0.15.22/json)

## Committed lockfile SHA-256

`93c53abdc89e73431735b700dc312fe223bad70852891869866dc8c797d84fc8`

For comparison, the pre-cutoff lock was
`69ca65aa0c9d334f00d7211118bb6130a8cd16d4ace0202b10b041da6441584b`.

## Independent regeneration A SHA-256

`93c53abdc89e73431735b700dc312fe223bad70852891869866dc8c797d84fc8`

## Independent regeneration B SHA-256

`93c53abdc89e73431735b700dc312fe223bad70852891869866dc8c797d84fc8`

## Byte-identical result

**PASS**

Both regenerations used separate clean Git exports. The seed `uv.lock` was
removed before resolution. Each run used Python 3.11.6, uv 0.9.8, an isolated
HOME and configuration directory, no cache, and no uv environment override.

Committed lock = regeneration A = regeneration B, byte-for-byte. Each result
recorded the fixed cutoff and Ruff 0.15.21.

## Reproducibility guard

The guard:

- fails if `[tool.uv].exclude-newer` is missing;
- accepts only the fixed `YYYY-MM-DDTHH:MM:SSZ` UTC form;
- rejects relative, date-only, malformed, and invalid-calendar values;
- requires the lock's recorded cutoff to equal project configuration; and
- validates project inputs rather than comparing only a hard-coded lock hash.

Targeted guard result: **9 passed**.

CI invokes the guard before `uv lock --check` and frozen synchronization.

## Fresh frozen-sync result

Exact command:

```bash
uv sync --project sdk/python --group dev --frozen
```

Result: **PASS** from the fresh review worktree with no pre-existing `.venv`.
The command created a new environment from the committed lock and installed
Ruff 0.15.21. No ignored dependency file was injected.

## Manifest 321/321 result

- Manifest SHA-256:
  `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`
- Manifest entries: 321
- Vectors: 120
- Missing: 0
- Untracked: 0
- Hash mismatches: 0
- Result: **321/321 PASS**

## Python 120/120 result

- Full schema-1 conformance suite: 53 passed
- Lock reproducibility guard: 9 passed
- Manifest-driven runner: 120 selected, 120 passed, 0 failures
- Family counts: canonical 47, contract 21, evidence 22, chain 18, trust 12
- Verification-result schema validation: pass within the conformance suite
- Ruff check: pass
- Ruff format check: 48 files already formatted
- Deterministic test-seed containment: pass
- Two vector regenerations: identical to each other and the committed suite
- Result: **PASS**

## Go 120-vector result

- Existing maintained-path candidate runner: pass
- Candidate vectors processed: 120
- Contract-v1 conformance: pass
- Go canonicalization: pass
- Historical Python Evidence fixture: pass
- Evidence tamper and transition suite: pass, including all 12 subtests

## DIV-001 status

**Visible and unresolved.** It remains a `blocking-production-defect` covering
the four U+2028/U+2029 vectors. It was not skipped or reported as remediated.

## DIV-002 status

**Visible and unresolved.** It remains a
`blocking-production-capability-gap` covering the seven numeric-lexeme
vectors. It was not skipped or reported as remediated.

## Full CI-equivalent result

The complete local equivalent of
`.github/workflows/schema1-conformance-candidate.yml` passed in
workflow-equivalent order:

1. manifest SHA-256 and Git completeness;
2. tracked Python project and lock inputs;
3. fixed-cutoff guard and `uv lock --check`;
4. exact frozen synchronization;
5. offline Python conformance tests;
6. offline Python 120-vector runner;
7. test-seed containment;
8. two deterministic vector regenerations and comparison to Git;
9. Go module download;
10. offline Go 120-vector candidate runner;
11. Go contract-v1 and canonicalization tests;
12. focused Evidence fixture and tamper/transition tests;
13. Ruff check and formatting verification;
14. workflow YAML parsing; and
15. `git diff --check`.

Result: **PASS locally**. GitHub-hosted CI was not observed and is not claimed.

## Hidden-state audit

- Every workflow input inspected is Git tracked.
- `sdk/python/pyproject.toml`, `.python-version`, and `uv.lock` are tracked and
  not ignored.
- All 321 manifest artifacts are tracked and hash-pinned.
- Separate lock regenerations passed with isolated HOME/config/cache state.
- The fresh sync created its own `.venv`; no pre-existing environment was used.
- Ignored `.venv`, Ruff cache, and `__pycache__` directories were outputs only.
- Candidate Python paths read tracked suite, schema, historical fixture, and
  test-only key inputs.
- The Go adapter reads the tracked suite and uses `database/sql` only for the
  `sql.ErrNoRows` sentinel; it opens no database connection.
- No production private key or secret is required.
- No Connected backend, database, or network service is required for candidate
  execution.
- Normal package-index access is required only to populate a new dependency
  environment from the frozen lock or regenerate it.

No hidden required project state was found.

## Frozen protocol/vector invariants

The following Git object identities are unchanged across the reviewed range:

- Candidate suite: `ff02004b310c7b831a60fec61b287b1f3922837c`
- Manifest: `a9036bd43859a16f08d44a62e7fc37d3913c3e71`
- Verification-result schema: `401ce5c23a6e704d9e6e586b540fdd27c90d7c95`
- Historical fixture tree: `8f47a81a8fcc48e5c96080bcb3b0f50a9df38bbe`

All recorded historical fixture SHA-256 values were independently rechecked
and matched. No vector, canonical byte, expected result, hash, signature,
manifest, schema, or historical fixture changed.

## Production-tree invariants

The following Git object identities are unchanged:

- Python production source: `61e7e70c4aa240dc11b0689af9823ff3a99dbe83`
- Go canonicalization: `4bf4e0e32532e2dabd3cee88b9d0d3f5862f00dc`
- Go Evidence verification: `98537dd43e176447097dc3e352482078e368ff04`
- Connected Evidence routes: `6858ecb00e65404dc675866517e6c0ed82ada668`
- Connected migrations: `dde8ca2c225a60f855ed756460dafe75c49da4b5`
- Root migrations: `e0faf813f8cd4924791ed9da9bd86751039eca7e`
- Deployment scripts: `a741fb4fa216d97a9dd83b71dd88ef80f2e93fa8`

Python package version remains `0.1.0a2`. No production source, migration, or
deployment file changed.

## Clock 2C closure status

**CLOSED.** Candidate artifacts, committed dependency state, and the resolver
time boundary are reproducible from Git state. No further generic packaging or
dependency review is required.

## Clock 2D authorization status

**AUTHORIZED. Clock 2D should resume immediately** from the corrected candidate
lineage at `d3ac0512347c28a9e5886c2246f724b78e173270` or a dedicated descendant.

Clock 2D is authorized to audit maintained production schema-1 verification,
remediate DIV-001 and DIV-002, run the unchanged 120-vector candidate against
production paths, and remove divergence exemptions only after genuine
production conformance.

## Remaining blocked work

The following remain blocked until Clock 2D and its required gates pass:

- standalone independent Go verifier;
- schema-1 suite release;
- Evidence v2 and ActionContract v2;
- TypeScript producer SDK;
- Rust/WASM;
- deployment; and
- publication.
