# Connected staging PG16 security remediation matrix

This document maps the independent NO-GO findings in review commit
`9e47d7cd33ad55ab59b3ecbb51d4c5465eea8592` to the focused remediation branch.
The first remediation was rejected by follow-up review
`2b1baadfc7d3795c50a7c9373812e05c79999f94` because the structural manifest
truncated full definitions and omitted exact trigger mode. This matrix records
the root-cause follow-up without self-approving it.

| Finding | Category | Affected files | Required change | Regression proof | Status |
| --- | --- | --- | --- | --- | --- |
| MB-01 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Make E2E and every helper stage fatal; suppress the final success marker after failure | Inject bootstrap, roles, runtime, contract, E2E exit 45, coordinator, preflight, and smoke failures; assert exact nonzero status, cleanup, and no success marker | Implemented; PG16.14 adversarial suite passed |
| MB-02 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Make stop failure fatal, verify the exact postmaster is gone, and retain unsafe-to-delete PGDATA | Inject `pg_ctl` cleanup failure; assert exit 77, retained private state, visible live PID, bounded recovery location, and successful explicit test cleanup; exercise combined failure, INT, and TERM | Implemented; PG16.14 adversarial suite passed |
| MB-03 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Remove shared predictable prefix state; require and validate an explicit binary prefix and private run state | Reject symlink/stale state, symlink and traversal prefixes, missing or symlinked binaries, and writable prefix directories; accept a safely quoted prefix containing spaces and shell metacharacters | Implemented; PG16.14 adversarial suite passed |
| MB-04 | merge blocker | `scripts/connected/pg16_local_validate.sh`, `scripts/connected/staging_smoke.sh`, PostgreSQL workflow steps | Bind destructive operations to a helper-created cluster marker and randomized resource namespace; make external mode non-destructive | Reject missing/mismatched identity and all external DSNs; prove an unrelated local cluster containing legacy role/database names is unchanged; prove concurrent isolation | Implemented; PG16.14 adversarial suite passed |
| MB-05 / NF-01 | merge blocker | `igris-overture/database/roles/*` | Replace the truncating heterogeneous manifest with explicit `text` structured rows and length-framed canonical hashing | Prove full definitions beyond byte 63, null/empty and field-boundary separation, stable ordering, and same-identity mutations across every covered family | Root-cause correction implemented; independent re-review required |
| NF-02 | merge blocker | structural manifest and staging/role preflight | Pin exact trigger enable mode and require `O` for migration-069 immutability triggers | Exercise `D`, `R`, and `A`; require structural mismatch plus an explicit origin-mode issue; restore `O` and pass | Implemented; independent re-review required |
| MB-06 | merge blocker | `.github/workflows/backend-postgres.yml` | Add least privilege, immutable action pins, credential non-persistence, concurrency cancellation, timeout, fatal cleanup, and regex zero-match guards | Parse workflow YAML, run actionlint when available, and inspect every selected-test pipeline | Implemented; YAML and source assertions passed; actionlint unavailable locally |
| RR-01 | required remediation | local helper environment setup | Scrub inherited database, libpq, role override, and relevant Igris variables; set only generated stage values | Adversarial helper runs with explicit isolated state | Implemented; PG16.14 adversarial suite passed |
| RR-02 | required remediation | smoke and workflow DSN handling | Remove reusable raw DSN rewriting; construct the helper URL structurally and use fixed job-local workflow targets | External DSN refusal cases cover localhost, IPv6, alternate loopback, aliases, Unix-socket encoding, and malformed input | Implemented; PG16.14 adversarial suite passed |
| RR-03 | required remediation | smoke and workflow resource handling | Validate SQL identifiers, use PostgreSQL identifier quoting, and generate run-scoped names | Identity mismatch, unrelated cluster, and concurrent-run tests | Implemented; PG16.14 adversarial suite passed |
| RR-04 | required remediation | `scripts/connected/tests/pg16_local_validate_security_test.sh`, `roles_test.go` | Commit the complete failure, cleanup, identity, prefix, concurrency, signal, and drift suite | Run the security test script with verified PostgreSQL 16 plus the role package tests | Implemented; both suites passed |
| RR-05 | documentation issue | Connected staging operations documents | Correct the prefix variable and state the external-mode and runtime-login limitations accurately | Documentation review and `git diff --check` | Implemented; documentation checks passed |

The pre-role v069 catalog hash remains
`034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`.
The rejected post-role hash
`4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118`
must not be used as integrity evidence. Canonical manifest v2 produces
`d166fffa05546550ebb8fb3d613ea96ef977c4376461c9cb5a10d0359a9946a0`
on the reviewed PostgreSQL 16.14 schema and role model.
Historical migrations, role grants, Evidence v1, ActionContract v1, canonical
fixtures, application startup behavior, and legacy-provider support are outside
this remediation and must remain unchanged.
