# Connected staging PG16 security remediation matrix

This document maps the independent NO-GO findings in review commit
`9e47d7cd33ad55ab59b3ecbb51d4c5465eea8592` to the focused remediation branch.
It does not self-approve the changes; the exact remediation tip requires a new
independent review.

| Finding | Category | Affected files | Required change | Regression proof | Status |
| --- | --- | --- | --- | --- | --- |
| MB-01 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Make E2E and every helper stage fatal; suppress the final success marker after failure | Inject bootstrap, roles, runtime, contract, E2E exit 45, coordinator, preflight, and smoke failures; assert exact nonzero status, cleanup, and no success marker | Implemented; PG16.14 adversarial suite passed |
| MB-02 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Make stop failure fatal, verify the exact postmaster is gone, and retain unsafe-to-delete PGDATA | Inject `pg_ctl` cleanup failure; assert exit 77, retained private state, visible live PID, bounded recovery location, and successful explicit test cleanup; exercise combined failure, INT, and TERM | Implemented; PG16.14 adversarial suite passed |
| MB-03 | merge blocker | `scripts/connected/pg16_local_validate.sh` | Remove shared predictable prefix state; require and validate an explicit binary prefix and private run state | Reject symlink/stale state, symlink and traversal prefixes, missing or symlinked binaries, and writable prefix directories; accept a safely quoted prefix containing spaces and shell metacharacters | Implemented; PG16.14 adversarial suite passed |
| MB-04 | merge blocker | `scripts/connected/pg16_local_validate.sh`, `scripts/connected/staging_smoke.sh`, PostgreSQL workflow steps | Bind destructive operations to a helper-created cluster marker and randomized resource namespace; make external mode non-destructive | Reject missing/mismatched identity and all external DSNs; prove an unrelated local cluster containing legacy role/database names is unchanged; prove concurrent isolation | Implemented; PG16.14 adversarial suite passed |
| MB-05 | merge blocker | `igris-overture/database/roles/*` | Separate ACL-invariant structural verification from ownership/grant verification | Inject an extra column, index, trigger, policy, function, view, and altered default; each must fail; provisioned roles/grants must pass | Implemented; PG16.14 clean and drift suites passed |
| MB-06 | merge blocker | `.github/workflows/backend-postgres.yml` | Add least privilege, immutable action pins, credential non-persistence, concurrency cancellation, timeout, fatal cleanup, and regex zero-match guards | Parse workflow YAML, run actionlint when available, and inspect every selected-test pipeline | Implemented; YAML and source assertions passed; actionlint unavailable locally |
| RR-01 | required remediation | local helper environment setup | Scrub inherited database, libpq, role override, and relevant Igris variables; set only generated stage values | Adversarial helper runs with explicit isolated state | Implemented; PG16.14 adversarial suite passed |
| RR-02 | required remediation | smoke and workflow DSN handling | Remove reusable raw DSN rewriting; construct the helper URL structurally and use fixed job-local workflow targets | External DSN refusal cases cover localhost, IPv6, alternate loopback, aliases, Unix-socket encoding, and malformed input | Implemented; PG16.14 adversarial suite passed |
| RR-03 | required remediation | smoke and workflow resource handling | Validate SQL identifiers, use PostgreSQL identifier quoting, and generate run-scoped names | Identity mismatch, unrelated cluster, and concurrent-run tests | Implemented; PG16.14 adversarial suite passed |
| RR-04 | required remediation | `scripts/connected/tests/pg16_local_validate_security_test.sh`, `roles_test.go` | Commit the complete failure, cleanup, identity, prefix, concurrency, signal, and drift suite | Run the security test script with verified PostgreSQL 16 plus the role package tests | Implemented; both suites passed |
| RR-05 | documentation issue | Connected staging operations documents | Correct the prefix variable and state the external-mode and runtime-login limitations accurately | Documentation review and `git diff --check` | Implemented; documentation checks passed |

The pre-role v069 catalog hash remains
`034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`.
Historical migrations, role grants, Evidence v1, ActionContract v1, canonical
fixtures, application startup behavior, and legacy-provider support are outside
this remediation and must remain unchanged.
