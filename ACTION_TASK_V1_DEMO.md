# Action Task V1 — Demo Walkthrough

**Audience:** a technical buyer or engineer seeing Igris Inertial for the first time.
**Time:** ~5 minutes.
**What it shows:** an AI task that takes *real actions against real systems* — and leaves a
verifiable evidence trail for every one of them.

This walkthrough uses only the existing Action Task V1 flow and the existing web console. It
adds nothing. If `scripts/action_task_v1_proof_demo.sh` passes, this walkthrough works.

---

## 1. The story in one paragraph

A customer submits a small, auditable task: **read a controlled local file**, **call a
controlled HTTP endpoint**, **write one row into a clearly-named test table**. Igris compiles
that to a runtime execution graph of three sandboxed local tools, issues a signed
capability/permission envelope, and dispatches it. The runtime executes each step, commits a
write-ahead-log (WAL) entry per step, and emits a signed, hash-chained receipt. Overture
persists the run. Then we ask Overture to verify the receipt cryptographically and check that
the receipt chain is intact — and it answers `verified=true`, `chain_valid=true`. The console
shows the whole thing in plain language: three actions, each with a result and a digest, plus
"Receipt verified" and "Chain intact".

The point: **the agent touched three external systems, every action has evidence, the receipt
verifies, and the chain is intact.**

---

## 2. Prerequisites

- `node`, `cargo`, `go`, `curl`, `lsof`, `psql` on `PATH`.
- A reachable PostgreSQL with the project's migrations applied (durable-task + execution-context,
  through migration `049_task_proof_verification_summary.sql`). Point the script at it via
  `DATABASE_URL` (or `POSTGRES_URL`) — e.g. set it in a local `.env` at the repo root. **Do not
  paste your connection string into this file or into the demo.**
- Local ports `8080`, `8081`, `18090`, `18091` free (the script checks and refuses otherwise).

The script builds the runtime and Overture binaries on first run (subsequent runs reuse them),
starts a mock model provider and a tiny localhost "action target" server, registers a runtime,
submits the task, and tears everything down on exit.

---

## 3. Run the demo

From the repository root:

```sh
zsh scripts/action_task_v1_proof_demo.sh
```

It runs to completion in well under a minute after the binaries are built. Exit code `0` means
the full evidence chain checked out.

If you also want to keep the local services up to click around the console live, run the same
script (it starts Overture on `http://127.0.0.1:8081`) — note it cleans up on exit, so do your
console walkthrough against the persisted task while a run is in flight, or re-run and inspect
the artifact directory it prints at the end.

---

## 4. Reading the terminal output

The script prints `[1/11] … [11/11] …` step banners, then a `Action Task V1 proof succeeded.`
block. The markers to point at:

| What you said | Where to look |
|---|---|
| "It completed through the runtime" | `Task status:               completed` |
| "Three real actions ran" | `Committed action steps:    3` and the `read_file → step 0`, `http_call → step 1`, `db_write → step 2` lines |
| "Each action has a safe result summary" | the `action_evidence:` block — `[0] read_file → … (result {"bytes_read":…,"content_digest":…})`, `[1] http_call → POST … (result {"status_code":200,"response_digest":…})`, `[2] db_write → table action_task_events (result {"row_id":…,"table":…})` |
| "It actually wrote a database row" | `db row id (psql-verified): <uuid>` — read straight back out of Postgres |
| "The receipt verifies cryptographically" | `Receipt verify:            verified=true hash_valid=true signature_matches=true runtime_key_found=true chain_valid=true` |
| "And that verdict is persisted on the task" | `persisted proof summary:   verified=true … chain_link_valid=true verified_at=…` |
| "Here are the API entry points" | the `links.task` / `links.steps` / `links.run` / `links.verify` / `links.receipt_verify` lines |

At the very end the script restates the identifiers you'll use in the console:

```
task_id:        <uuid>
runtime_id:     <uuid>
execution_id:   <ULID>
db row id:      <uuid>
receipt verify HTTP status:    200
task verify HTTP status:       200
artifacts:      <temp dir with all request/response JSON>
```

- **task ID** — `task_id` (also the path segment in `links.task`, `/v1/tasks/<task_id>`).
- **execution ID** — `execution_id` (also `links.run`, `/v1/execution/runs/<execution_id>`).
- **runtime ID** — `runtime_id` (the runtime instance that executed the steps).
- **verification result** — both HTTP statuses are `200`; `verified=true` / `chain_valid=true`
  appear in the `Receipt verify:` and `persisted proof summary:` lines.

Everything sensitive stays out of this output by design: you see byte counts, status codes, and
SHA-256 digests — never the file contents, the HTTP request/response bodies, the headers, or the
DB record payload.

---

## 5. Open the console (Task Inspector walkthrough)

Open the web console and go to **Execution → Tasks**, then open the task whose ID the script
printed — the Task Inspector lives at `/execution/tasks/<task_id>`.

Work top to bottom:

### Human-readable (lead with these)

1. **Status tiles** — `Status: completed`, `Steps Committed: 3`, `Runtime`, `Receipt`.
2. **Action Evidence** — the heart of the demo. A three-row table in execution order:
   - **Read file** — the controlled path it read; Result shows `bytes read: 68 · content digest: 3e48…`.
   - **Call API** — `POST http://127.0.0.1:18091/process`; Result shows `HTTP status: 200 · response digest: 347d…`.
   - **Write database row** — `table action_task_events`; Result shows `row ID: <uuid> · table: action_task_events`.
   Each row also has the committed status, the executing runtime ID, the step's result digest,
   and when it was recorded. If something genuinely wasn't recorded it says **"Not recorded"** —
   never a fabricated success.
3. **Proof summary** (the strip directly under the Action Evidence table):
   - **Receipt: Verified** (green) — or "Recorded · verification not run yet" with an inline
     **Verify receipt** button if you're demoing a fresh task that hasn't been verified yet.
   - **Chain: Intact** (green) — or "Run verification to check chain" before a verify has run.
   - **Runtime ID** and **Execution ID** spelled out so they match the terminal output.

### Technical evidence (below — say "and for the engineers in the room…")

4. **Signed Artifacts** — the execution envelope and the hash-chained receipt, their hashes and
   Ed25519 signatures, the proof status, and a manual **Verify receipt** button that re-runs the
   cryptographic + chain-link check on demand (and re-persists the verdict).
5. **WAL Steps** — the raw write-ahead-log: one committed entry per step, with input/output
   digests, the signing runtime, and timestamps. This is the durability substrate.
6. **Durable Graph State** — the graph blackboard, slots, and node JSON the runtime checkpointed.
   This is the lowest-level "what the runtime actually held" view.
7. **Checkpoint and Recovery** — checkpoint digest, last committed step, and (for recovered
   tasks) the original vs. recovery runtime; for this single-shot demo task it's a clean,
   uneventful section.

The framing to land: **sections 1–3 are for a human** ("did it do the right things, and can I
trust it?"), **sections 4–7 are the receipts** ("here's the cryptographic and durable evidence
backing every claim above").

---

## 6. What this demo is and isn't

- **Is:** durable execution of real actions against controlled local systems, with per-step WAL
  entries, a signed hash-chained receipt, cryptographic verification, and a persisted verdict —
  all visible in the product.
- **Isn't:** a connector catalogue. Action Task V1 supports exactly three actions
  (`read_file`, `http_call`, `db_write`) against tightly whitelisted local targets. It's a proof
  of the execution-and-evidence model, not a general integration surface.
- **Provider:** the demo uses the local mock model provider; it does not exercise an external
  LLM provider.

---

## 7. Related proofs

- `scripts/action_task_v1_proof_demo.sh` — the standalone end-to-end Action Task V1 proof (this demo).
- `scripts/proof_suite.sh` — the core Run / Recover / Verify proof suite.
- `CHECKPOINT_RECOVERY_PROOF.md` — long-horizon checkpoint + cross-runtime recovery.
- `EXECUTION_EVIDENCE_MATRIX.md` — where each evidence claim is surfaced across API and console.
