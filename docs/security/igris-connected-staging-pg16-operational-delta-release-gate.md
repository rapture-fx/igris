# Release Gate — Connected Staging PostgreSQL 16 Operational Delta

## Executive summary

**Verdict: NO-GO.**

The exact candidate `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` is compatible with a disposable, source-built PostgreSQL 16.14 server in the clean success path, and the expected pre-role v069 catalog hash remains unchanged. It must not proceed to merge in its current form because the operational delta contains multiple independently reproduced false-green and local-safety failures:

1. The local PG16 helper converts a failing E2E stage into success.
2. The helper silently reports success when PostgreSQL shutdown fails.
3. The predictable `/tmp/igris-pg16-prefix.path` fallback can redirect execution to an unverified binary prefix.
4. Admin-DSN mode has no positive disposable-cluster identity and can delete pre-existing default roles in an unrelated local PG16 cluster.
5. Post-role staging preflight accepts arbitrary structural drift as healthy.
6. The modified backend workflow does not meet the repository's stated least-privilege workflow standard and adds a regex-selected runtime test without zero-match protection.

This is an independent, read-only implementation review. No candidate file, implementation branch, shared database, cloud resource, or production system was modified.

## Reviewed base and exact candidate tip

| Subject | Verified value |
| --- | --- |
| Current `origin/main` | `1ef093a96dc8ae55c317266aa9b0dc94e5b08579` |
| Previously reviewed staging base | `7a9c06f15853f51e60bd23a828a9422cee4b70f5` |
| Existing staging review | `c281a7c656aa9fdd891efe93e48da719952a5e38` — CONDITIONAL GO for the pre-PG16 foundation |
| Exact candidate | `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` |
| PG16 delta commits | `d9b3851905b2fdba6e924b5f4cded72de0a543fc`, then `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` |
| Base ancestry | Verified: `7a9c06f...` is an ancestor of `6799acb...` |
| Expected pre-role v069 hash | `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4` |

## Changed-file and changed-line inventory

The complete `7a9c06f...6799acb...` diff contains six files and no SDK source, Evidence protocol, ActionContract protocol, migration SQL, role-model implementation, or console changes.

| File | Delta | Reviewed executable/change ranges |
| --- | ---: | --- |
| `.github/workflows/backend-postgres.yml` | +32 / -1 | Path filters at candidate lines 11–14 and 27–30; bootstrap timeout at 73; runtime-role step at 80–83; preflight shell at 85–103 |
| `.github/workflows/private-alpha-ci.yml` | +63 / -6 | Path filters at 29–33 and 51–55; PG job metadata/env at 180–205; bootstrap, role, runtime, and preflight stages at 230–275; expanded selected suite at 277–295 |
| `Makefile` | +5 / -1 | `.PHONY` addition at 1; target at 135–138 |
| `scripts/connected/pg16_local_validate.sh` | +112 / -0 | Entire executable, lines 1–112, reviewed line by line |
| `docs/operations/connected-staging-smoke.md` | +4 / -1 | PG16 prerequisite/evidence wording at 17–22 |
| `docs/operations/connected-staging.md` | +28 / -2 | PG16 evidence/helper section at 123–148; blocker wording at 154–155 |

`git diff --check` passed. The 69 historical Connected migration SQL files remain byte-identical.

## False-green analysis

### FG-1 — E2E failure is explicitly neutralized — merge blocker

`scripts/connected/pg16_local_validate.sh:99-102` executes the cross-slice E2E command as the left side of `|| log`. Bash `errexit` is disabled for a command in that conditional position. A deliberately injected E2E exit 45 produced:

```text
e2e_note=skipped_or_failed_non_fatal_for_local_db_proof
result=connected_pg16_local_validate_ok
helper exit=0
```

The clean E2E happened to pass during this review, but the helper cannot be used as release evidence while it converts an E2E failure into success.

### FG-2 — cleanup failure is invisible — merge blocker

`scripts/connected/pg16_local_validate.sh:34-40` suppresses `pg_ctl stop` failure with `|| true`, removes `PGDATA` regardless, and exits with the pre-cleanup status. With an injected `pg_ctl stop` exit 77, cleanup was called and the data directory was removed, but the helper exited 0 and printed `result=connected_pg16_local_validate_ok`.

This can report success while leaving a server running and removing the pathname for its live data directory. Cleanup failure must be observable and must change a nominal success to failure.

### FG-3 — post-role structural drift is accepted — merge blocker

After a clean v069 bootstrap and role apply on PG16, the review added an unreviewed nullable column to `public.tenants`. `igris-db-staging-preflight` returned exit 0 with:

```text
catalog_hash_note=acl_sensitive_hash_differs_after_role_provision expected_bootstrap_v069=034f5f75...
issues=none
result=staging_preflight_ok
```

The ACL-sensitive-hash exception does not distinguish expected ACL changes from unrelated structural changes. The earlier review described this as a private-alpha residual; the deliberate drift proof shows it is a concrete false-green path in the staging gate and must be remediated before this exact candidate merges.

## Failure-injection matrix

Failure propagation was tested without editing candidate files. External commands were replaced only in an isolated review fixture, and a separate real PG16 run validated the clean path.

| Stage / condition | Injected status | Helper status | Cleanup result | Classification |
| --- | ---: | ---: | --- | --- |
| Simulated clean control | 0 | 0 | n/a | expected |
| Bootstrap package | 41 | 41 | source-cluster failure test stopped and removed PGDATA | pass |
| Role package | 42 | 42 | failure propagated | pass |
| Runtime-role test | 43 | 43 | failure propagated | pass |
| Contract/evidence/immutability suite | 44 | 44 | failure propagated | pass |
| Cross-slice E2E | 45 | **0** | subsequent stages ran; success marker printed | **merge blocker** |
| Coordinator suite | 46 | 46 | failure propagated | pass |
| Staging preflight inside smoke | 47 | 47 | smoke cleanup ran | pass |
| Staging smoke startup | 49 | 49 | failure propagated | pass |
| `pg_ctl stop` during successful cleanup | 77 | **0** | PGDATA removed; success marker printed | **merge blocker** |
| SIGINT during active stage | SIGINT | terminated by SIGINT | stop called; PGDATA removed | pass for tested path |
| SIGTERM during active stage | SIGTERM | terminated by SIGTERM | stop called; PGDATA removed | pass for tested path |
| Real PG16.14 clean run | 0 | 0 | server, socket, port, and PGDATA absent afterward | pass, but not sufficient to override blockers |

## PostgreSQL process and cleanup analysis

Positive findings for helper-created clusters:

- `mktemp -d` produced a private `0700` data/socket directory.
- The exact start options bind PostgreSQL's default `localhost` listener to `127.0.0.1` and `::1`; the Unix socket is inside the private PGDATA directory.
- A reproduced instance showed no non-loopback listener.
- `pg_ctl -D "$PGDATA"` scopes normal stop operations to the helper-created data directory.
- Normal success, ordinary command failure, SIGINT, and SIGTERM removed the tested server and PGDATA.

Blocking deficiencies:

- Port selection binds port 0, records the result, closes the socket, and only later starts PostgreSQL. This is a time-of-check/time-of-use race. A collision should normally make startup fail, but no post-start identity tuple proves the listening postmaster is the one created by this run.
- `CLEANUP_PG` is set only after `pg_ctl ... start` returns success. A partial start followed by a nonzero `pg_ctl` result is not covered by cleanup.
- `PG_PID` is declared but never populated or verified.
- Stop failure is suppressed and PGDATA is removed without proving the server stopped.
- Only `EXIT` is trapped. It happened to run for the tested INT/TERM paths, but explicit signal handling and post-stop verification are required for durable release evidence.

## Temporary-file analysis

`scripts/connected/pg16_local_validate.sh:23-26` reads the predictable global path `/tmp/igris-pg16-prefix.path` whenever an explicit prefix is absent.

The current machine's file is a regular `0644` file owned by uid 501 and points to `/tmp/igris-pg16-build`; the current referenced binaries are regular executable files owned by the same user. That current snapshot does not make the design safe:

- `/private/tmp` is world-writable and sticky.
- If the predictable file is absent, another local user can create and own it before the reviewer runs the helper.
- `-f` follows symlinks; there is no `lstat`, owner, mode, link-count, or containing-directory validation.
- Stale cross-run and cross-user state is reused without consent.
- The file contents directly select binaries executed with the invoking user's authority.

Arbitrary binary redirection through this fallback is a merge blocker. The fallback must be removed or replaced with explicit operator selection or private run-scoped state created with restrictive permissions and verified ownership.

## Binary-prefix analysis

Shell quoting of `"$PG16_PREFIX/bin/..."` prevents metacharacters in a path from becoming shell syntax. It does not establish binary trust.

Only `initdb` is checked with `-x`, which permits symlinks and does not require a regular file. `pg_ctl` and the preferred `psql` are not validated. If prefix `psql` fails, line 72 falls back to an implicitly trusted `psql` from `PATH`. `postgres`, `pg_isready`, and the installation/version relationship are not positively validated.

Before execution, every required binary must be a verified regular executable below one canonical, explicitly selected prefix, with symlink and ownership policy stated. An expected PG16 version must be verified using those exact binaries. No PATH fallback is acceptable in this security helper.

## DSN and environment analysis

The helper exports its chosen admin DSN into `IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN` and `IGRIS_OVERTURE_POSTGRES_TEST_DSN`, which correctly steers the selected bootstrap, role, API, and coordinator tests. `staging_smoke.sh` uses Python `urllib.parse` to replace the database path, preserving percent-encoded credentials and query parameters without printing the DSN.

Remaining issues:

- `refuse_shared_dsn` is an unanchored deny list, not a structured local-target proof.
- Query parameters are retained, including `host`, so a query host can override the visible authority or select an unrelated Unix socket.
- The workflow preflight uses raw Bash string substitution to replace `/postgres?`; its current input is a fixed job-local URL, but the pattern is fragile and should not become a reusable DSN transformation.
- The helper does not scrub `DATABASE_URL`, `DATABASE_URL_DIRECT`, `DATABASE_URL_RUNTIME`, `DATABASE_URL_MIGRATION`, `POSTGRES_URL`, `POSTGRES_TEST_DSN`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, or unrelated `IGRIS_*` values.
- Inherited `IGRIS_DB_ROLE_*` overrides can make provisioning disagree with the smoke script's hard-coded role names and cleanup targets.
- Admin credentials are used only by tests that create disposable databases/roles in the reviewed path; runtime behavior is exercised through `SET ROLE`, not a dedicated runtime login.

No complete credential-bearing DSN was printed in the observed success output.

## Disposable-target enforcement

The helper does not positively prove that admin-DSN mode points to a cluster it created. Version 16 plus permission to create/drop a probe database proves capability, not disposability or ownership.

With isolated fake clients, the deny list accepted all of these inputs and reached the success marker:

- an arbitrary remote hostname (`db.example.com`);
- an encoded Neon hostname;
- a localhost-looking authority with a remote `host=` query override;
- a localhost-looking authority with an unrelated Unix-socket `host=` query value;
- a non-loopback DNS alias not containing a deny-list keyword.

No network connection was made for those parsing tests.

For destructive proof, this review created a separate disposable local PG16 cluster, pre-created a sentinel default `igris_app_runtime` role, and passed that cluster through admin-DSN mode. The helper returned 0 and the pre-existing role changed from present (`1`) to absent (`0`). This proves the helper can delete unrelated cluster-global roles while claiming success.

Admin-DSN mode must not perform destructive operations without a run-specific positive identity established by the helper. The safest remediation is to make the release helper create its own cluster and use unique run-scoped database and role names. Any retained external-DSN mode requires an explicit destructive opt-in plus verified loopback/private socket, postmaster/data-directory identity, and a run token/resource manifest that scopes cleanup.

## Role and SQL identifier analysis

Positive findings:

- `roles.Names.Validate` restricts role overrides to the intended identifier grammar, enforces distinct names, and the implementation uses PostgreSQL identifier quoting.
- Go disposable tests generate random hexadecimal suffixes and use `pq.QuoteIdentifier` for databases and roles.
- Shell/workflow database names are composed from fixed lowercase/underscore prefixes plus `$RANDOM`, `$$`, or hex, so the current generated values cannot inject SQL.
- Synthetic SQL literals in the smoke are fixed review-controlled values.

Deficiency:

- `staging_smoke.sh` provisions and then drops four fixed cluster-global role names. This is unsafe outside a positively identified single-run cluster and conflicts with environment role overrides. Smoke roles and databases must be unique to the run, validated, safely quoted, and recorded in the run resource manifest used by cleanup.

## Smoke and E2E integrity

- `scripts/connected/staging_smoke.sh` is invoked at helper line 110, and ordinary smoke failures propagate.
- Synthetic evidence contains fixed hashes/identifiers and an event body limited to `{"event_type":"decision","redacted":true}`. No secret or real tenant data is used.
- The clean source-built PG16.14 run passed bootstrap, roles, runtime-role paths, contract/evidence/immutability, cross-slice E2E, coordinator, preflight, and smoke.
- The clean result does not cure the E2E false-green path.
- Runtime and read-only checks use an administrator connection followed by `SET ROLE`. They do not prove a dedicated runtime LOGIN credential or authentication path. This remains an accepted private-alpha limitation only if documentation states it explicitly and makes no real-login claim.
- Older admin-DSN harness limitations remain as documented by the earlier staging review.
- All observed HTTP E2Es used local test servers; the database test used only review-created local clusters.

## Workflow security

### `.github/workflows/private-alpha-ci.yml`

Verified positives:

- `permissions: contents: read` is explicit.
- Checkout uses `persist-credentials: false`.
- All actions are pinned to 40-character immutable SHAs.
- Concurrency cancellation and explicit job timeouts remain enabled.
- The PG16 job uses only job-local fixed credentials and a service container; no repository, organization, environment, cloud, or production secret is referenced.
- No pull-request-controlled metadata is interpolated into executable shell.
- New `go test | tee` stages enable `pipefail` and add zero-match checks.
- The 45-minute timeout is explicit; no evidence showed a leaked process in the clean run.

Required changes:

- The preflight DSN rewrite at lines 268–272 is raw string substitution. Keep the current fixed job-local URL or use structured parsing; do not generalize this pattern.
- Cleanup errors are suppressed. Although the service container is job-scoped, cleanup status should be visible and run-specific names should be used for roles.

### `.github/workflows/backend-postgres.yml`

The candidate modifies this workflow but it does not satisfy the required workflow security baseline:

- no explicit `permissions: contents: read`;
- checkout uses mutable `actions/checkout@v4` and persists credentials by default;
- setup-go uses mutable `actions/setup-go@v5`;
- no concurrency policy;
- no explicit job timeout;
- the newly added regex-selected runtime-role test has no zero-match protection;
- cleanup failures are discarded, and fixed cluster-global role names are used.

The commands themselves are fixed, use a job-local `postgres:16` service, and contain no PR metadata or external secrets. The workflow-hardening omissions remain required remediation before merge.

## Proof and documentation accuracy

- PostgreSQL 16.14 was independently executed from `/tmp/igris-pg16-build`; `postgres --version` reported 16.14.
- `uuid-ossp.control` exists in that installation's extension directory, and the v066 baseline successfully created/used the extension during the full run.
- A fresh pre-role PG16 bootstrap independently produced exactly `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`.
- The candidate correctly says hosted GitHub Actions PG16 execution is wired but not yet proven green.
- The candidate does not claim cloud deployment or production readiness.
- The local success table is compatible with the independent clean rerun, but helper success output is not trustworthy release evidence until FG-1 and FG-2 are fixed.
- The comment at helper lines 3–4 says `IGRIS_PG16_BIN`; the implementation uses `IGRIS_PG16_PREFIX`.
- Documentation must not describe admin-DSN mode as disposable based only on a deny list and create/drop capability.
- Documentation must describe the post-role catalog-hash bypass accurately until a structure-only invariant is enforced.

## Findings by category

### Merge blockers

| ID | Finding |
| --- | --- |
| MB-01 | E2E failure is neutralized by `|| log`, allowing exit 0 and the final success marker. |
| MB-02 | PostgreSQL stop failure is suppressed; helper can exit 0 and delete PGDATA without proving shutdown. |
| MB-03 | Predictable cross-user `/tmp` prefix state can redirect execution to unverified binaries. |
| MB-04 | Admin-DSN mode lacks positive cluster identity and can delete pre-existing cluster-global roles. |
| MB-05 | Post-role preflight accepts unrelated structural drift with `issues=none`. |
| MB-06 | Modified `backend-postgres.yml` lacks required least privilege, immutable action pins, credential non-persistence, timeouts/concurrency, and zero-match protection. |

### Required remediation

| ID | Finding |
| --- | --- |
| RR-01 | Scrub or explicitly overwrite database, libpq, role-override, and relevant Igris environment variables. |
| RR-02 | Use structured DSN parsing/validation; reject authority/query/socket conflicts and remove raw reusable string rewriting. |
| RR-03 | Use unique run-scoped database and role identifiers with validated grammar and safe identifier quoting. |
| RR-04 | Add committed regression tests for every helper stage, cleanup failure, signals, local-target proof, prefix validation, and structural drift. |
| RR-05 | Correct `IGRIS_PG16_BIN` documentation and make the runtime-login limitation explicit. |

### Accepted private-alpha limitations

| ID | Limitation |
| --- | --- |
| AL-01 | Runtime behavior is tested via `SET ROLE` on an admin-authenticated connection, not a dedicated runtime LOGIN. |
| AL-02 | Older API/coordinator harnesses use admin connections and disposable schemas/databases. |
| AL-03 | The product remains actions-first Connected only; legacy inference-provider bootstrap is unsupported. |

### Documentation issues

- Wrong helper variable name in the new script header.
- Admin-DSN disposability wording overstates the implemented enforcement.
- Post-role catalog-hash wording must disclose that structural drift currently passes.

### Production hardening

- Dedicated runtime LOGIN/certificate-path testing.
- ACL-normalized structural manifest retained as a durable invariant after role provisioning.
- Explicit postmaster PID/start-time/data-directory identity and reserved-port startup protocol.
- Hardened service-container image provenance and complete cleanup evidence in hosted logs.

## Required remediation

The candidate may return for independent verification only after all of the following are implemented without weakening role grants, migration-069 triggers, migration history, or the pinned pre-role hash:

1. Make every helper stage fatal, including E2E, and add a table-driven failure-injection regression harness that proves nonzero exit for every stage.
2. Remove the predictable `/tmp/igris-pg16-prefix.path` fallback. Require an explicit prefix or private run-scoped state, canonicalize it, and validate every required binary as an approved regular executable without PATH fallback.
3. Prefer helper-created PG16 clusters only. If admin-DSN mode remains, require explicit destructive consent and positive run-specific cluster identity; a hostname deny list and create/drop probe are insufficient.
4. Generate unique run-scoped role names and database names. Cleanup must operate only from a verified resource manifest tied to the created cluster.
5. Make cleanup failure visible and fatal on an otherwise successful run. Verify stop completion before removing PGDATA; handle partial start, EXIT, INT, TERM, and cleanup re-entry safely.
6. Enforce a post-role structure-only/ACL-normalized manifest so expected ACL changes cannot mask arbitrary structural drift. Do not change the existing expected v069 hash to bless drift.
7. Scrub inherited database/libpq/role variables and pass only explicit stage-specific DSNs/credentials.
8. Harden `backend-postgres.yml` to the private-alpha workflow baseline: `contents: read`, immutable action SHAs, `persist-credentials: false`, concurrency, explicit timeout, and zero-match guards.
9. Replace fragile DSN rewriting with structured URL handling or a fixed job-local target, and add coverage for percent encoding, IPv6 loopback, Unix sockets, query overrides, malformed URLs, and keyword DSNs.
10. Correct documentation and retain honest distinctions between clean local PG16 proof, hosted CI proof, `SET ROLE`, and real runtime login.

Remediation must receive a follow-up review; this document does not approve unimplemented fixes.

## Verdict

**NO-GO** for remediation-free replay or merge of `6799acb9f92d64c1953c6b607f19a4cc7ec9664b`.

The candidate may proceed only to a remediation branch. It must not be represented as staging-ready, merged, or used against any shared/local developer cluster until MB-01 through MB-06 and RR-01 through RR-05 are resolved and independently revalidated.

## Review commit

This document is the only file permitted in the single focused commit on `review/igris-connected-staging-pg16-final-gate`. The exact commit SHA is reported in the review handoff after commit creation.

## Confirmation that implementation branches and systems remained untouched

- `feature/igris-connected-staging-foundation-pg16` remained at `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` and was not checked out for writing.
- Candidate execution used a detached read-only worktree at the exact commit.
- No candidate implementation file was edited.
- No implementation branch was rebased, reset, merged, stashed, cleaned, cherry-picked, pushed, or force-updated.
- Tests used only helper-created or reviewer-created disposable localhost PostgreSQL 16 clusters.
- No shared, staging, cloud, or production database was contacted.
- No package was published, no infrastructure was deployed, and no shared migration was applied.
