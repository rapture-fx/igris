# Containment gate decision (2026-07-05)

Investigation of the heavy-proof `containment violation: cpu after 30000ms`
failure and the correct release-gate strategy. **No runtime containment behavior
is changed** — the failure is the security guarantee working as designed in an
environment that cannot enforce it.

Branch: `chore/heavy-proof-containment-gate` (from `main` @ `48591ae07`).

## 1. Root cause

The runtime executes each agent step inside the `igris-safety` supervisor, which
runs the work in a separate worker process pinned to a **CPU-quota cgroup**.

Chain (all in `igris-runtime/crates/igris-safety/src/supervisor.rs`):
- `execute()` (L235) → if no worker, `self.spawn_worker().map_err(|_| ViolationKind::Cpu)?` (L237).
- `spawn_worker()` (L96) spawns the worker, then `self.attach_cgroup(pid)?` (L153).
- `attach_cgroup()` (L166–181, Linux) builds a CPU cgroup via `cgroups-rs`
  (`CgroupBuilder::new("igris_worker").cpu().quota(..).period(..).build(hier)`)
  and `add_task(pid)`. On an unprivileged host these `mkdir`/write ops under
  `/sys/fs/cgroup` return `EACCES`/`EPERM`.

So on GitHub-hosted runners the worker itself runs fine (`wall_time_ms:6–7`,
`cpu_time_ms:0`), but `attach_cgroup` fails → `spawn_worker` fails → `execute`
returns `Err(ViolationKind::Cpu)` → `task_executor.rs:4031` bails with
`containment violation: cpu after 30000ms` (the `30000ms` is the configured
`max_tick_ms` label, **not** a measured time — the job never ran 30s).

**This is fail-closed by design:** if the runtime cannot establish CPU
containment, it refuses to run the workload rather than run it uncontained.
That is correct and must not be weakened.

Evidence it is environmental and pre-existing (not caused by any PR):
- Heavy dispatch `28739668615` (PR #72 branch) — fails here.
- **`main` nightly `28738844165` (event=schedule) fails identically** — same
  message, `cpu_time_ms:0`, same `task_v1` step 1.

## 2. Can GitHub-hosted runners run this proof honestly?

**No — not the execution-containment portion.** GitHub-hosted runners execute
the job as the unprivileged `runner` user directly on the VM (cgroup v2, no
delegated writable subtree without `sudo`). Creating the worker cgroup is denied.
There is no honest way to *pass* the containment execution proof there — the only
honest outcomes are **enforced-and-verified** (on a capable host) or
**unsupported/skipped-with-reason** (here). Reporting green on a host that cannot
enforce containment would be a lie about the guarantee.

Everything in the heavy gate that does **not** require the runtime to execute a
worker under a cgroup (build, migrations, fast deterministic proofs, API/DB
assertions, receipt/signature checks, the Action Task V1 recovery proofs that
already pass) *can* run honestly on GitHub-hosted runners.

## 3. The codebase already has the right pattern (reuse it)

`igris-runtime/crates/igris-server/tests/containment_integration.rs` solved this
exact problem for the unit/integration layer:
- `cgroup_containment_unavailable()` (L15) probes with `CGroup::new(&Bounds::new(80, 5_000))`;
  `Err` ⇒ unavailable, returns the reason.
- `skip_unless_cgroup_capable!()` (L25) prints `SKIPPED: this environment cannot
  create containment cgroups …: {reason}` and returns — **skip, never pass.**
- Comment (L8–14): the tests still run wherever cgroups are creatable (privileged
  Linux) and are a documented no-op on non-Linux dev hosts.

So the containment guarantee **is** proven — on any containment-capable host.
The only gap is that the **end-to-end heavy proof gate (`scripts/ci_proof_gate.sh`)
has no such probe** (`grep`: no cgroup/containment awareness) and treats the
runtime's correct fail-closed as a hard red.

## 4. Recommended release-gate design

Mirror the test pattern at the gate level. Two parts:

**(a) Split the heavy gate into two tiers.**
- **Tier A — GitHub-hosted OK (no containment enforcement):** build, migrations,
  fast deterministic proofs, and every assertion that does not require the runtime
  to run a worker under a cgroup, plus `cargo test` for
  `containment_integration.rs` (which self-skips honestly). This is the everyday
  PR/nightly gate.
- **Tier B — containment-capable runner required:** the end-to-end execution and
  checkpoint/recovery proofs that need the runtime to actually execute contained
  workers (the ones currently dying at `task_v1` step 1). Run on a host where
  cgroup creation succeeds (self-hosted Linux with delegation, or a privileged
  Linux container). This is where the containment guarantee is proven end-to-end.

**(b) Make Tier A honest about what it did NOT prove.**
Add a one-time probe at the top of the heavy gate (shell equivalent of
`cgroup_containment_unavailable()` — e.g. attempt to create a throwaway cgroup, or
add a tiny `igris-runtime --containment-probe` subcommand that calls
`CGroup::new`). If unavailable:
- Emit a **visible `UNSUPPORTED: containment enforcement unavailable on this
  runner`** line, and
- **skip the execution-containment proofs and report them as
  `UNSUPPORTED`/`SKIPPED`, never as passed** (exit success only for the
  proofs that genuinely ran; the containment proofs are recorded as not-exercised
  here, not green).

Guard rails (per constraints):
- The probe must key strictly on "cgroup creation denied," so a **real** violation
  on a capable host still fails red. It must never convert an actual
  `Err(ViolationKind::Cpu)` from a real overrun into a skip.
- No `cpu_time_ms` faking, no disabling the supervisor, no
  `IGRIS_ALLOW_INSECURE…`-style bypass to force the proof green.

Do **not** just set an env var that disables containment to make the proof pass —
that is "treating unsupported containment as passed," which is prohibited.

## 5. Self-hosted / capable-runner requirements (Tier B)

If Tier B uses a self-hosted or privileged runner, it must provide:
- **Linux with cgroup v2** (unified hierarchy at `/sys/fs/cgroup`; `cgroups-rs
  hierarchies::auto()` must resolve a **writable** hierarchy).
- **Cgroup create permission**, via one of: run as root; **systemd user
  delegation** (`Delegate=yes` on the runner's slice → a writable delegated
  subtree); or a **privileged Linux container** (`--privileged` or explicit
  cgroup delegation) with cgroupfs mounted read-write.
- If containerized, the runner image needs cgroup tooling and the mount; document
  the exact `docker run`/runner config used.
- **Security risks (must be addressed):** self-hosted runners that execute
  untrusted code are a classic RCE/secret-exfiltration vector. Restrict Tier B to
  **trusted branches only**, **never fork PRs**, use **ephemeral single-use**
  runners (fresh VM/container per job), scope secrets to trusted workflows only,
  and network-isolate. Prefer a privileged **ephemeral container on an otherwise
  GitHub-hosted VM** over a long-lived self-hosted box if feasible.

## 6. Decisions / answers

- **Root cause:** `attach_cgroup` fails on unprivileged GitHub-hosted runners →
  supervisor fail-closes → `Err(Cpu)` → proof red. Correct behavior, wrong place
  to run it.
- **Can GitHub-hosted run it honestly?** No for the execution-containment proofs;
  yes for everything else. Honest result there is UNSUPPORTED, not PASSED.
- **Recommended gate:** split into Tier A (GitHub-hosted, honest UNSUPPORTED skip
  of containment execution proofs) + Tier B (containment-capable runner proves the
  guarantee end-to-end).
- **Should heavy proof be split?** Yes.
- **Can PR #72 merge before this is fixed?** Yes. PR #72's proof-correctness fixes
  are independent of this environment issue; the containment failure is
  pre-existing on `main`, sits upstream of PR #72's proofs (`task_v1` step 1), and
  is a gate/environment concern, not a regression. (Per instruction, the merge
  decision on #72 is the user's — this only states it is not blocked *by* the
  containment issue.)
- **Code changes made in this task:** none to runtime containment (no product
  bug). The gate probe/split in §4 is a *proposal* — not implemented here, since
  choosing self-hosted vs privileged-container vs Tier-A-only is a release-owner
  decision.

## 7. Constraints honored
No deploy, staging, production migration, or secrets. No landing files. Containment
and cgroup enforcement unchanged and not bypassed. Unsupported containment is
never to be reported as passed. No CPU usage faked. No proof failure suppressed.
