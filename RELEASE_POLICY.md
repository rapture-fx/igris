# Release Policy

Igris Inertial release-candidate promotion requires the heavy proof gate before
the candidate is tagged or promoted.

Normal pull requests should use the fast proof gate for deterministic feedback:

- GitHub check: `fast deterministic proof gate`
- Command: `scripts/ci_proof_gate.sh fast`
- Scope: apply required durable-task migrations, preflight proof schema, and run
  focused backend Go tests.

Release candidates must additionally pass the heavy cumulative proof gate:

- Stable release check: `heavy proof gate status`
- Heavy proof job: `heavy cumulative clean-host proof`
- Command: `scripts/ci_proof_gate.sh heavy`

The heavy gate includes:

- `scripts/action_task_v1_cumulative_clean_host_recovery_proof_demo.sh`
- `scripts/action_task_v1_clean_host_recovery_proof_demo.sh`
- `scripts/action_task_v1_recovery_proof_demo.sh`
- `scripts/action_task_v1_proof_demo.sh`
- `scripts/proof_suite.sh`

The heavy gate proves cumulative clean-host recovery, ordinary clean-host
recovery, same-host recovery, Action Task V1 side-effect safety, and the core
Run / Recover / Verify suite. It must fail release promotion if checkpoint
reconstruction regresses, prior side effects replay, receipt verification fails,
or chain verification fails.

## GitHub Protection Guidance

For normal main-branch pull requests, require the fast deterministic proof gate
alongside the normal build/test checks used by the repository.

For release branches, release-candidate pull requests, or manual release
promotion, require the stable aggregate check `heavy proof gate status`. Prefer
requiring the aggregate check rather than the path-scoped heavy job directly, so
release policy depends on one explicit status that only passes after the heavy
proof job succeeds.

When promoting a release candidate outside a pull request, run the `Proof Gate`
workflow manually with `proof_tier=heavy` and require `heavy proof gate status`
to pass before tagging or publishing release artifacts.
