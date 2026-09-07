# Runtime Boundary Enforcement Matrix

Date: 2026-05-23

## Summary

Runtime boundaries are useful evidence and policy inputs today, but they should not be described as full isolation guarantees unless the selected runtime enforces the specific control.

## Matrix

| Boundary | Current Source | Enforcement Level | Notes |
| --- | --- | --- | --- |
| Action policy allow/deny | Coordinator | enforced_by_coordinator | Denied and approval-required actions are blocked before dispatch. |
| Required capabilities | Coordinator + signed envelope | enforced_by_coordinator and enforced_by_runtime where runtime honors envelope | Coordinator signs permission envelope; runtime must reject mismatches. |
| Runtime selection | Coordinator | enforced_by_coordinator | Healthy tenant runtime is selected server-side. |
| Checkpoint portability | Coordinator | enforced_by_coordinator | Same-runtime-only and non-replayable recovery are blocked. |
| Checkpoint task ownership | Coordinator | enforced_by_coordinator | Checkpoint task IDs and WAL task IDs are validated. |
| Checkpoint runtime identity | Coordinator | enforced_by_coordinator | Checkpoint callback is rejected when submitted runtime identity differs from assigned task runtime. |
| Allowed tools | Coordinator record + runtime graph | enforced_by_runtime / declared_only | Coordinator records expected tools; actual per-tool sandbox enforcement depends on runtime implementation. |
| Denied tools | Coordinator record | declared_only | No general denied-tool enforcement was found in the coordinator beyond policy classification. |
| Network scope | Coordinator record | declared_only unless runtime enforces | Stored as `none` or `policy_scoped`; no coordinator-level network isolation exists. |
| Filesystem scope | Coordinator record | declared_only unless runtime enforces | Stored as `none` or `policy_scoped`; runtime/tool sandbox must enforce paths. |
| API scope | Coordinator record | declared_only | No broad API egress enforcement was found in coordinator. |
| Resource limits | Coordinator record + deadline | partially_enforced | Deadline budget is passed to runtime; CPU/memory isolation is runtime/platform dependent. |
| Runtime capabilities | Runtime registry/claims | declared_only / validated_by_policy where used | Runtime claims are not sufficient proof of enforcement. |
| Boundary violations | Runtime/lineage/governance records | persisted_evidence | Violations are visible, but detection source must be inspected per runtime. |

## Console Wording Rule

Use "Boundary recorded", "Expected boundary", or "Runtime-declared capability" unless the control is enforced by the coordinator. Use "Enforced by runtime" only when the runtime implementation performs the check and failed attempts are persisted.

## Follow-Up

Add explicit `enforcement_level` fields to boundary API responses so the console can label each boundary as `coordinator_enforced`, `runtime_enforced`, `declared_only`, `experimental`, or `unsupported`.
