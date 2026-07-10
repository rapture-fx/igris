# Embedded Igris SDK — Architecture and Forward Compatibility

Status: Embedded assurance level **implemented** (`sdk/python`, package
`igris`, 2026-07). Connected and Managed are **design targets only** — nothing
in this document below the Embedded section is implemented.

## Why this exists

Igris has a substantial execution foundation: registered actions, policy
decisions, durable approvals, task dispatch, runtime identity, authenticated
callbacks, idempotency protections, checkpointing, safe-forward recovery,
containment, receipts, evidence, operator review, and proof gates. The
developer experience in front of that foundation was platform-first: a user
had to understand actions, runtimes, policies, and operators before getting
any value.

That onboarding model does not fit how developers work in the agent era. They
already have an agent environment (Claude Code, Codex, Cursor, scripts, CI).
Igris must meet them there: **install, wrap one function, keep working**.

## One product, three assurance levels

| Level | What it does | Status |
| --- | --- | --- |
| **Embedded** | Local guard around a function: local approval, signed decision/outcome evidence, hash-chained journal, offline verification. No server. | **Implemented** (this SDK) |
| **Connected** | Explicit opt-in connection to shared policies, team approvals, and central evidence aggregation via the existing Igris backend (Overture). | Not implemented |
| **Managed** | Selected actions execute *through* the existing Igris runtime: controlled dispatch, runtime identity, containment, anti-replay, checkpoints, supported recovery. | Not implemented |

The honest capability boundary, stated once and repeated everywhere it
matters:

* Embedded **guards and observes** local execution.
* Connected **coordinates** shared policy, approval, and evidence.
* Managed **controls** execution.

Only Managed can truthfully provide runtime containment, exactly-once
semantics, runtime isolation, anti-replay, checkpoints, and supported
recovery. Embedded mode never claims these, in code, docs, or errors.

## What Embedded implements

* `@igris.guard` — the code declaration is the action registration. Manual
  registration is gone from the primary developer workflow.
* `ActionContract` — deterministic contract (schema-versioned, stable
  `contract_hash`) derived from the decorated function: module, qualified
  name, risk, approval mode, `execution_mode="embedded"`, parameter
  descriptors from `inspect.signature`, optional `code_fingerprint` (SHA-256
  of dedented source). No timestamps, absolute paths, or memory addresses.
* Redaction-first evidence: sensitive parameter names (case-insensitive,
  extensible) become `<REDACTED>` before any prompt, hash, journal write, or
  error summary. Input hashes are computed over the redacted canonical form.
* Ed25519 local identity in `IGRIS_HOME` (default `~/.igris`), `0700`/`0600`
  permissions, `key_id` from the public-key fingerprint.
* Hash-chained JSONL journal with signed `decision` and `outcome` events;
  fail-closed pre-execution semantics; distinct `EvidencePersistenceError`
  post-execution.
* `igris verify` / `igris key-info` CLI (argparse, stdlib only).

### Canonicalization and signing convention

The SDK deliberately mirrors the existing runtime receipt convention
(`igris-runtime/crates/igris-server/src/receipt.rs` and the legacy client
helper `igris-python-sdk/igris/receipt.py`):

* canonical JSON = sorted keys + compact separators, UTF-8;
* `event_hash` = SHA-256 hex of the canonical payload excluding
  `event_hash`/`signature`;
* signature = Ed25519 over the raw 32-byte SHA-256 digest, base64;
* JSONL, hash-chained via the previous entry's hash.

Differences, on purpose:

* events use `previous_event_hash: null` for genesis (receipts use `""`);
* events set `ensure_ascii=False` (non-ASCII as UTF-8, matching what the
  Rust/Go serializers actually emit; the legacy Python verify helper's
  `ensure_ascii=True` default only agreed with them on ASCII payloads);
* events carry `schema_version`, `event_id`, `key_id`, and `contract_hash`.

A Connected-mode ingest endpoint should treat SDK events as a *new,
versioned* evidence type rather than coercing them into `ExecutionReceipt`.

## Mapping to existing Igris concepts (Connected mode, future)

Likely clean reuse points:

* **Action registry.** `ActionContract` is designed to be synchronized
  upward: `action_name` maps to the registered action identity;
  `contract_hash` gives the registry a change-detection signal ("the code
  behind `customer.refund` changed"). Registration becomes an *upload of
  observed contracts*, not a manual step.
* **Approval lifecycle.** `ApprovalProvider` is the seam. The existing
  durable approval flow (approve/reject `/v1/actions/runs/:id`, scrubbed
  `request_summary` for approver context) matches `ApprovalRequest` almost
  field-for-field: both deliberately expose only redacted, bounded summaries.
  A Connected provider would block on the existing approval endpoints.
* **Evidence system.** Decision/outcome events are hash-chained signed JSONL,
  which is exactly the shape of runtime receipts; central aggregation can
  verify SDK journals offline (same math) and anchor journal checkpoints,
  which also fixes the local tail-truncation blind spot.
* **Key identity.** `key_id` (public-key fingerprint) parallels runtime
  identity (`IGRIS_RUNTIME_PUBLIC_KEY` verification in Overture). A Connected
  mode would register the SDK public key with the tenant the same way
  runtimes register theirs.

Honest mismatches (do not pretend these map cleanly):

* **Tenancy.** Local events have no tenant. Attribution happens at connect
  time (BetterAuth/API-key), and pre-connection local history is
  self-attested by an unregistered key — the backend must label it as such.
* **Execution receipts vs outcome events.** Runtime receipts measure
  resource usage (cpu/mem/fs) under containment; SDK outcome events observe
  only status/result-type. They are different claims with different strength
  and must remain distinct record types.
* **Policy decisions.** Backend policy evaluation (capability policies,
  policy presets, proposals) is far richer than the local
  allowed/denied-with-reason `ApprovalDecision`. Local decisions should map
  to a "local approval" policy source, not masquerade as backend policy
  evaluations.
* **Idempotency/anti-replay.** The backend's idempotency protections have no
  local counterpart; Embedded explicitly does not deduplicate calls. Managed
  dispatch is the only truthful path to that guarantee.
* **Async.** The backend's action tasks are async by nature; the SDK is
  sync-only in v0. Async support is an SDK-side project, not a mapping issue.

## Managed mode (future) — what would change

A `@igris.guard(execution="managed")` action would not run locally at all:
the guard would submit the bound (redacted-for-evidence, encrypted-for-input)
call through the existing task dispatch path (input-ref encryption, runtime
id pinning, capability policies, checkpoints, safe-forward recovery). The
contract, evidence, and approval seams above are the interfaces that make
this possible without changing decorated user code. Deliberately deferred:
`execution=`, retry/recovery/containment policy parameters, runtime
selection.

## Existing components intentionally unchanged

The SDK imports nothing from — and changes nothing in — the Go backend
(`igris-overture`), the Rust runtime (`igris-runtime`), `rust-core` FFI, the
console, existing SDKs (including the legacy `igris-python-sdk` HTTP client,
which is untracked in this repo and remains as-is), action registration
routes, migrations, billing, or CI proof gates. `sdk/python` is additive and
independently publishable.

## Non-goals of Embedded mode (permanent, not just v0)

No hidden phone-home, no telemetry, no update checks, no background sync.
Connecting is always an explicit, separate step (`igris connect`, future).
