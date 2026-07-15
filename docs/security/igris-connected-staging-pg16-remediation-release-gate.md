# Igris Connected Staging PostgreSQL 16 Remediation Release Gate

## Executive summary

**Verdict: NO-GO.**

The exact remediation tip `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598` must not enter the merge train. The review independently confirmed that the clean PostgreSQL 16 path and most shell, cluster-identity, temporary-state, and workflow remediations behave as intended. However, the structural verification remains false-green for security-critical catalog changes.

The confirmed blocker is systemic: at least one `objects.definition` value in `schema_structure_manifest.sql` resolves to PostgreSQL type `name`, limiting it to 63 bytes before serialization and hashing. A same-name immutability enforcement function changed beyond that retained prefix. Its complete definition digest changed, altered enforcement was observable, yet the structural hash stayed at the expected value and staging preflight exited successfully with `issues=none`.

This invalidates the structural hash as proof that security-critical database behavior is preserved. Updating the expected hash or adding a check for one function would not repair the manifest construction defect.

This was an independent review. No implementation fix was made. No implementation branch, shared database, deployment, package, migration, RFC branch, existing worktree, branch history, or stash was modified.

## Exact inputs reviewed

| Subject | Exact value |
| --- | --- |
| Original candidate | `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` |
| Original NO-GO review | `9e47d7cd33ad55ab59b3ecbb51d4c5465eea8592` |
| Remediation branch | `fix/igris-connected-staging-pg16-security-blockers` |
| Exact remediation tip | `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598` |
| Expected pre-role hash | `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4` |
| Expected post-role structural hash | `4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118` |

`git fetch --all --prune` succeeded. The exact remediation commit exists locally, but no `origin/fix/igris-connected-staging-pg16-security-blockers` ref contains it, so remote branch freshness and hosted CI for that exact unpublished ref cannot be claimed.

## Ancestry and scope verification

The remediation tip descends from the original candidate. The ancestry path contains exactly the four reported commits, in order:

1. `51780adef86238ade1b36ac6788ba76de04dc124`
2. `e1f89c7b5c1ba505c53d88e66556e46eeb1c7fbf`
3. `9f81c516b96b4e98ec213a60ad22cd5cf4e98a62`
4. `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598`

The complete candidate-to-remediation diff changes 12 files: two workflows, two operational documents, one remediation report, staging preflight and structural-manifest code/tests, and the local validation/smoke helpers and security test. Migrations 001 through 069, SDK sources, ActionContract v1, Evidence v1, canonical fixtures, and the role-grant implementation remain unchanged. The changes to `database/roles` are limited to staging preflight, manifest construction, and tests; they do not change the role provisioning/grant implementation.

## Original blocker re-review matrix

| ID | Re-review result | Gate status |
| --- | --- | --- |
| MB-01 E2E false green | Injected E2E status 45 propagated as 45; diagnostics remained; cleanup ran; the final success marker was absent. Other injected stages also propagated. | Remediated for the tested paths. |
| MB-02 cleanup failure | Injected cleanup status 77 was fatal, retained PGDATA, omitted the success marker, and kept the postmaster observable. Combined E2E 45 plus cleanup 77 reported both and preserved 45. The helper emits the retained state location but does not emit a complete bounded manual-recovery instruction. | Core false green remediated; recovery-instruction acceptance gap remains. |
| MB-03 predictable temporary state | The predictable shared prefix-state path is absent. Private run directories, symlink/stale-state refusal, traversal and binary validation, special-character paths, and concurrent isolation passed. | Remediated for the tested paths; foreign-UID execution remains untested. |
| MB-04 missing positive cluster identity | The helper creates a socket-only cluster and verifies data directory, socket, port, process, run ID, and marker. External admin DSNs are refused by the destructive helper. An unrelated disposable cluster with matching legacy role/database names remained unchanged. | Remediated for the tested paths. |
| MB-05 structural drift | The advertised column, index, trigger, policy, function, view, and default mutations failed preflight. The required clean hash reproduced. A systemic 63-byte definition truncation nevertheless allowed a security-relevant same-object change to retain the expected hash and pass preflight. | **Not remediated; merge blocker.** |
| MB-06 workflow security | Both modified workflows have `contents: read`, immutable action SHAs, non-persistent checkout credentials, concurrency cancellation, explicit job timeouts, zero-match guards on selected suites, disposable job-local PostgreSQL credentials/resources, and visible cleanup failure handling. No external secrets or PR-controlled executable metadata were found. | Remediated by source audit; hosted execution remains mandatory. |

## Independent failure-injection results

The committed adversarial helper suite was executed independently on this review worktree against PostgreSQL 16.14. It passed the following expected statuses and cleanup assertions:

| Stage | Expected and observed helper exit |
| --- | ---: |
| bootstrap | 41 |
| role provisioning | 42 |
| runtime role | 43 |
| contract and evidence | 44 |
| E2E | 45 |
| coordinator | 46 |
| preflight | 47 |
| smoke | 49 |
| cleanup | 77 |
| SIGINT | 130 |
| SIGTERM | 143 |

The combined primary E2E failure and cleanup failure preserved primary exit 45 while reporting cleanup exit 77. Failed injected runs emitted no final helper success marker. The suite also passed symlink/stale state refusal, prefix/path validation, external-DSN refusal, unrelated-cluster preservation, and concurrent-run isolation.

## Cluster identity and destructive safety

Confirmed behavior:

- The helper rejects externally supplied admin DSNs before destructive work and always creates its own cluster.
- The cluster is initialized under a private run directory with a private socket and no TCP listener.
- The helper verifies the postmaster PID and the database-reported data directory, socket directory, port, and socket-only connection state.
- Disposable smoke requires a matching run-specific marker and generated resource namespace.
- Generated database and role identifiers are validated and safely quoted.
- The unrelated disposable cluster exercised by the regression suite retained its pre-existing matching role and database.
- Successful and ordinary failed helper runs removed their helper-created state and postmaster.

The destructive-safety model no longer relies on hostname or remote-host heuristics. External `staging_smoke.sh` mode is non-destructive preflight only.

## Temporary state and executable validation

`/tmp/igris-pg16-prefix.path` is not used. Prefix selection is explicit. The helper checks prefix and binary ownership/mode, rejects symlink endpoints and traversal, requires regular executable `initdb`, `pg_ctl`, `postgres`, and `psql` files under the canonical prefix, and verifies PostgreSQL major version 16. Run state is created with restrictive permissions and unique names.

The independent suite passed stale and symlink state attacks, missing/symlink binary cases, a writable-directory case, a prefix containing spaces and shell metacharacters, and simultaneous runs. A true foreign-UID fixture was not available; source checks require uid 0 or the invoking uid, but that branch remains unproven by a real foreign-UID execution.

## Structural manifest blocker

### Confirmed facts

- `igris-overture/database/roles/schema_structure_manifest.sql` builds a heterogeneous `objects` CTE with `UNION ALL` arms.
- The first arm supplies `pg_extension.extname` directly as `definition`. That catalog field is type `name`.
- PostgreSQL union type resolution coerced at least one later rendered definition to type `name` before the outer `regexp_replace` and hash input were evaluated.
- Direct catalog inspection returned `pg_typeof(definition)=name` and `length(definition)=63` for a long function definition.
- Casting or normalizing only in the outer serialization expression would be too late: content had already been lost inside the CTE result.
- The reviewed immutability function's complete definition digest changed from `65e456c67b5786a5413d24914fd08265` to `d2a4f037af7210b0496a19aff9483cf3` during the bounded test.
- Its structural manifest hash remained `4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118` before and after.
- Staging preflight exited 0 with `issues=none` and `result=staging_preflight_ok`.
- The changed enforcement behavior was observable: a mutation that the original function rejected persisted after the same-name definition change.

These facts prove a false-green structural verification path. Object existence, stable identity, and an unchanged expected hash did not prove preservation of the object's enforcement behavior.

### Separate trigger enable-mode defect

The same review independently found that trigger enable mode is not part of the structural manifest. Pre-mutation catalog state was origin-only (`O`). Disabled (`D`) was rejected by a separate boolean check, but replica-only (`R`) and always (`A`) were both treated as enabled and retained the expected structural hash. Replica-only did not fire in a normal origin session, and preflight still exited 0 with `issues=none`.

This is distinct from the 63-byte truncation defect. Even a non-truncating `pg_get_triggerdef` does not encode the required `tgenabled='O'` state. Security-critical trigger state must be pinned exactly rather than reduced to “not disabled.”

### Confirmed susceptible manifest fields

Every `definition` arm currently resolves through the shared CTE column and therefore requires a type audit before the manifest can be trusted. The arms cover:

- extensions;
- relations;
- columns and defaults;
- constraints;
- indexes and predicates/expressions;
- triggers;
- policies;
- functions;
- views;
- types;
- sequences.

This list is an inventory of fields exposed to the shared type-resolution path, not a claim that every family was independently demonstrated exploitable. The confirmed defect creates credible systemic risk wherever meaningful content occurs after byte 63.

### Confirmed and inferred coverage gaps

Confirmed additional false greens from already completed bounded tests included an existing function's security mode/configuration change, a table rule, and migration-ledger constraints excluded by the manifest. These observations reinforce the systemic classification.

Inferred affected scope requiring remediation inventory includes long trigger definitions and bindings, constraint properties, index predicates/expressions and validity state, view definitions/options, policy expressions, column default or generation expressions, function bodies/configuration, and other rendered definitions whose security-relevant suffix can occur beyond byte 63. Rules are currently omitted rather than merely truncated. Relation options and migration-ledger structure also require an explicit inclusion decision.

The inference is based on the common CTE typing path and source review. It must not be read as proof that every object family has an exploitable current instance.

### Security-relevant attributes requiring explicit representation

Rendered definitions alone are insufficient for all required invariants. At minimum, remediation must assess and explicitly pin:

- trigger enable mode, target relation, timing, events, row-versus-statement scope, function binding, arguments/condition, and constraint-trigger deferrability/initial state;
- function language/kind, body or binary identity, volatility, parallel/strict/leakproof properties, security-definer mode, per-function configuration such as `search_path`, return shape, and expected owner/ACL boundary;
- RLS enabled and FORCE state;
- constraint validation and deferrability;
- index validity/readiness and full expressions/predicates;
- view security/check options;
- policy command, roles, permissive mode, predicates, and checks;
- rule definitions and behavior;
- column default/generation/identity expression and sequence ownership where present;
- migration-ledger columns, constraints, and indexes.

## Minimum required remediation

1. Represent every catalog definition as non-truncating `text` before union type resolution, ordering, normalization, serialization, aggregation, or hashing. Verify the intermediate CTE column type and lengths, not only the final hash.
2. Audit every manifest arm for implicit coercion to `name`, fixed-width character types, typmods, or any other truncating representation.
3. Represent security-relevant function and trigger attributes explicitly where rendered definitions are incomplete, including an exact origin-only trigger mode requirement.
4. Add regressions in which two definitions are identical through byte 63 and differ afterward; the structural result must differ and preflight must fail closed.
5. Add defensive regressions for changes to existing functions, triggers, constraints, indexes, views, policies, rules, and expressions. Tests must mutate existing identities, not rely only on adding a new object.
6. Preserve the already effective remediations for the earlier six blocker areas.
7. Do not “fix” this by updating the expected hash, casting only after the truncating CTE has materialized, or adding one special-case assertion for the demonstrated function.
8. Run another independent security re-review of the complete manifest and all six original blocker areas after remediation.

The smallest safe implementation direction is to eliminate truncation at the source of every union arm, assert the intermediate types, add explicit catalog columns for enforcement states, then regenerate the expected hash only after a human-reviewed manifest diff and complete mutation matrix.

## Workflow security analysis

The workflow source audit passed the requested baseline:

- workflow-level `permissions: contents: read`;
- all third-party actions pinned to 40-character commit SHAs;
- `persist-credentials: false` on checkout;
- concurrency cancellation;
- explicit timeout on every job;
- zero-match protection for selected tests;
- disposable job-local PostgreSQL service credentials and resources;
- no repository, organization, environment, cloud, or production secret use;
- no unsafe execution of PR-controlled metadata;
- failures propagate to job failure and cleanup failures remain visible.

Workflow YAML parsed successfully. ShellCheck and actionlint were unavailable locally, so no version or result can be claimed. Hosted CI was not run and remains mandatory before any future merge.

## PostgreSQL 16 clean-run results

PostgreSQL reported version `16.14`. After warming the local SDK environment following an initial PyPI timeout, one full unskipped helper run passed:

- bootstrap through v069;
- role package and the advertised structural-drift cases;
- runtime-role Connected paths;
- contract, evidence, immutability, tenant/cross-slice E2Es using the Python SDK;
- coordinator PostgreSQL tests;
- staging preflight;
- disposable smoke;
- successful cleanup with no helper-created state or postmaster remaining.

The first full attempt failed closed during dependency retrieval, emitted no helper success marker, and cleaned its helper-created state. The successful retry emitted both smoke and helper success markers.

The pre-role catalog hash independently reproduced as `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`. The post-role structural hash reproduced as `4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118`. Reproduction of the latter does not clear the gate because the confirmed truncation allows materially different full definitions to produce the same result.

## Completed checks

The following checks completed successfully before the final blocker decision:

- remote fetch/prune, exact-tip, ancestry, ordered-commit, and full-scope inspection;
- `bash -n` on all three changed shell scripts;
- workflow YAML parsing and immutable-action/job-timeout inspection;
- `git diff --check` on the remediation delta;
- `go test ./igris-overture/database/roles -count=1`;
- focused structural-drift role test with all seven advertised subcases;
- `go build ./...`;
- focused `go vet` over bootstrap, roles, API, coordinator, and staging-preflight packages;
- the complete adversarial PG16 helper regression suite;
- one full successful unskipped PostgreSQL 16.14 helper run;
- independent pre-role and post-role hash reproduction.

ShellCheck and actionlint were unavailable. Hosted GitHub Actions was not run. Local success cannot replace hosted CI.

## Known private-alpha limitations

- Runtime smoke uses `SET ROLE` through an administrator-authenticated connection. It validates authorization behavior after role switch, not real runtime LOGIN authentication or credential separation. This may remain a clearly documented private-alpha limitation, but dedicated runtime LOGIN validation is required before production.
- Ownership checks exist, including uid validation and writable-directory refusal. A true foreign-UID execution was not performed. This is a residual verification gap and production-hardening item, not evidence that the source check is ineffective.
- The exact remediation ref is not published on `origin`; hosted CI for the exact tip is therefore unproven. Hosted CI remains mandatory before merge after any future remediation and independent re-review.

## New findings

| ID | Finding | Classification |
| --- | --- | --- |
| NF-01 | Manifest `definition` can resolve to fixed-width `name`, truncating content at 63 bytes before hashing and allowing a changed enforcement definition to retain the expected hash. | **Merge blocker** |
| NF-02 | Trigger enable state is omitted; replica-only and always states are accepted as enabled instead of requiring the expected origin-only state. Replica-only weakens normal-session enforcement. | **Merge blocker** |
| NF-03 | The helper reports retained cleanup state but does not emit a complete bounded manual-recovery instruction. | Required remediation/documentation gap |
| NF-04 | A true foreign-UID binary/prefix fixture was not executed. | Production-hardening verification gap |

## Remaining conditions

The candidate must not merge. A future candidate requires all of the following before another release-gate decision:

1. Non-truncating manifest construction and explicit enforcement-state representation.
2. Regressions for identical-first-63-byte definitions and existing-object mutations across the inventoried families.
3. Exact origin-only immutability-trigger validation.
4. Preservation and rerun of all original blocker regressions and the full unskipped PG16 helper.
5. Complete bounded recovery guidance on retained cleanup state.
6. ShellCheck and actionlint where available.
7. Hosted CI green on the exact published candidate.
8. A new independent security review; the present NO-GO cannot be self-cleared by the remediation author.

## Verdict

**NO-GO for `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598`.**

MB-05 remains reproducible through a systemic manifest-integrity defect, and NF-02 independently permits a security-critical trigger mode that does not enforce immutability in normal origin sessions. These outcomes meet the explicit NO-GO rule: structural drift can escape detection and security-critical database behavior can change while the staging gate reports success.

## Review commit

This file is committed as the only file in one documentation-only commit on `review/igris-connected-staging-pg16-remediation-final-gate`. The exact commit is reported in the final handoff because a commit cannot contain its own stable hash.

## Implementation-branch integrity confirmation

The review started from the exact remediation commit in a fresh isolated worktree. No implementation file was changed. The original candidate branch and remediation branch were not rebased, merged, cherry-picked, reset, stashed, cleaned, force-updated, or committed to. No existing user worktree or dirty checkout was altered. The only branch created was the requested independent review branch.

## Publication, deployment, and shared-database status

Nothing was pushed or merged. No infrastructure was deployed. No package was built for publication or published. No shared, staging-shared, cloud, or production database was accessed or modified. All database operations used disposable local PostgreSQL 16.14 clusters created under private temporary directories and removed after validation.
