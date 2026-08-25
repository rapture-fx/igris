# Heavy proof Tier A / Tier B split — implementation (2026-07-05)

Implements the split recommended in `CONTAINMENT_GATE_DECISION_2026-07-05.md`,
without weakening containment. No runtime/containment code changed.

## What changed
- `scripts/ci_proof_gate.sh`
  - Added `containment_capable()` — honest cgroup-capability probe. Non-Linux ⇒
    capable (supervisor cgroup attach is a no-op there). Linux ⇒ capable only if
    a cgroup can actually be created under `/sys/fs/cgroup` (v2, then v1 `cpu`).
    `IGRIS_FORCE_CONTAINMENT_UNSUPPORTED=1` forces the skip path for testing.
  - Added `run_core_proof_suite_containment_aware()` wrapping the core proof
    suite (`proof_suite.sh` — the agent-inference execution proofs that require
    the containment supervisor):
    - **Capable runner:** runs the suite normally (real containment violations
      still fail red).
    - **Incapable runner (Tier A / GitHub-hosted):** SKIPS with a visible
      `::warning` + step-summary reason. **Never reported as passed.**
    - **`IGRIS_REQUIRE_CONTAINMENT=1` (Tier B):** if containment is unavailable,
      **fails red** (exit 1) instead of skipping — a Tier B runner that cannot
      contain is a real defect.
- `.github/workflows/proof-gate.yml`
  - **Tier A** = existing `cumulative-clean-host-proof` on `ubuntu-latest`. It now
    runs everything except the agent-inference containment proofs, which it skips
    honestly (via the gate change). No other change.
  - **Tier B** = new `containment-tier-b-proof` job on
    `runs-on: [self-hosted, linux, containment-capable]`, gated by
    `inputs.run_tier_b == true`, with `IGRIS_REQUIRE_CONTAINMENT=1`. Dormant until
    an operator provides the runner and opts in.
  - `heavy-proof-gate-status` now requires Tier A always; treats Tier B `success`
    as "containment proven", `skipped` as "containment UNPROVEN in this run"
    (visible warning, **not** a pass), and any other result as a hard failure.
  - Added `run_tier_b` (boolean, default false) workflow_dispatch input.

## Behaviour matrix
| Runner | cgroup? | Core suite | Gate result |
|--------|---------|-----------|-------------|
| GitHub-hosted (Tier A) | no | SKIPPED as UNSUPPORTED (visible) | Tier A green; containment UNPROVEN (warned) |
| Tier B capable, no violation | yes | runs, passes | containment proven |
| Tier B capable, real violation | yes | runs, fails | red |
| Tier B labelled but cgroup broken | no | — | red (`IGRIS_REQUIRE_CONTAINMENT`) |
| dev macOS | n/a (no-op) | runs, passes | green |

## Activating Tier B (operator)
1. Register a **self-hosted Linux runner** that can create cgroups — root, or
   systemd `Delegate=yes` on the runner slice, or a privileged/cgroup-delegated
   container (cgroup v2 mounted read-write). Label it `containment-capable`.
2. Dispatch Proof Gate with `proof_tier=heavy` and **`run_tier_b=true`**.
3. Security (see decision doc §5): trusted branches only, never fork PRs,
   ephemeral single-use runners, scope secrets to trusted workflows.

## Constraints honored
Containment/cgroup enforcement unchanged and not bypassed. Unsupported containment
is reported as SKIPPED/UNSUPPORTED, never passed. No CPU faked. No proof failure
suppressed. No deploy/staging/production-migration/secret/landing changes.
