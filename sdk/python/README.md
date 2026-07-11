# Igris

**Igris is a drop-in action layer for consequential AI-agent actions.**

Add one decorator to a consequential function. Keep your agent (Claude Code,
Codex, Cursor, scripts, anything), keep your code, keep your workflow. Before
the function runs, Igris records a signed decision event; after it runs, a
signed outcome event. The journal is hash-chained and verifiable offline.

No account. No backend. No registration step. No network calls by default
(an explicit opt-in Connected mode can synchronize action declarations —
never inputs or evidence — see below).

```python
import igris

@igris.guard(
    action="customer.refund",
    risk="critical",
    approval="required",
)
def refund_customer(customer_id: str, amount: int):
    return payment_provider.refund(customer_id=customer_id, amount=amount)
```

The code declaration **is** the action registration. There is nothing else to
configure, register, or deploy.

## Installation

Internal release note: public PyPI publication is blocked until the legacy
`igris-inertial` distribution migration is resolved. See `RELEASE.md`.

```bash
pip install igris
# or
uv add igris
```

Requires Python 3.10+. The only runtime dependency is `cryptography`.

## What happens on a guarded call

1. Arguments are bound to parameter names and **redacted** (`api_key`,
   `password`, `token`, `secret`, and friends — plus any names you list in
   `redact=[...]` — become `<REDACTED>` before anything is shown, hashed,
   or persisted).
2. Approval is evaluated. The default is an interactive terminal prompt that
   shows the action name, risk, and the redacted input summary, and defaults
   to **deny** — only an explicit `y`/`yes` approves.
3. A **signed decision event** is durably appended to the local journal
   *before* execution. If the decision is denied — or if signing, redaction,
   canonicalization, or the journal write fails — the function **does not
   run** (`ActionDenied`, or the specific pre-execution error).
4. The function runs exactly once. Its return value is passed through
   untouched; its exception is re-raised unchanged.
5. A **signed outcome event** (`succeeded` / `failed`) is appended.

### First run: local signing identity

On first use Igris creates an Ed25519 signing identity under `~/.igris`
(directory mode `0700`, private key mode `0600`). Events are signed with this
key; `igris key-info` prints the public parts:

```
key_id:      ed25519:5b3f9c2a17d4e8f0
fingerprint: sha256:5b3f9c2a17d4e8f0...
public_key:  /home/you/.igris/verify_key.pem
```

The private key is never printed, never leaves the machine, and never appears
in events.

## Verifying the journal

```bash
igris verify                 # default journal in ~/.igris (or $IGRIS_HOME)
igris verify path/to/journal.jsonl --public-key path/to/verify_key.pem
```

`igris verify` exits `0` only when every event parses, carries a known schema
version, has a correct hash, a valid Ed25519 signature, and links to the
preceding event's hash. Modified, reordered, or middle-deleted events fail
verification with a non-zero exit code.

## Configuration

| Variable | Effect |
| --- | --- |
| `IGRIS_HOME` | Overrides `~/.igris` (keys and default journal location). |
| `IGRIS_API_URL` | Optional. Igris endpoint for **Connected mode** (see below). No effect alone — both Connected variables must be set. |
| `IGRIS_API_KEY` | Optional. Tenant-scoped API key for Connected mode. |

`@igris.guard` parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `action` | derived from module + qualified name | Stable logical action name. |
| `risk` | `"medium"` | `low`, `medium`, `high`, or `critical`. Informational; shown at approval and recorded in evidence. |
| `approval` | `"required"` | `required` (interactive/local approval) or `never` (no prompt; a signed decision event is still recorded). |
| `journal` | `$IGRIS_HOME/journal.jsonl` | Journal path override, or a custom `JournalStore`. |
| `redact` | `None` | Extra parameter names to redact (case-insensitive). |
| `metadata` | `None` | Small JSON-safe dict recorded on decision events (same redaction rules). |
| `approval_provider` | terminal prompt | Advanced: injectable `ApprovalProvider` (used by tests; the seam future Connected capabilities use). |
| `identity` | local key | Advanced: injectable `SigningIdentity`. |
| `sync_client` | `None` | Advanced/testing: injectable `ContractSyncClient` for Connected contract synchronization. |

## Connected mode: contract synchronization (explicit opt-in)

By default this package makes **no network call of any kind** — no telemetry,
no update checks, no sync. Connected mode exists only when you explicitly
configure BOTH variables:

```bash
export IGRIS_API_URL="https://your-igris-endpoint"
export IGRIS_API_KEY="igris_..."        # tenant-scoped API key
```

With Connected mode enabled, the same `@igris.guard` declaration — unchanged —
automatically synchronizes its **ActionContract** to the Igris backend before
the *first* guarded execution of each contract version in the process (before
local approval and before your function runs). Your code declaration stays the
registration: no console step, no manual re-registration.

What Connected mode does in this release, precisely:

* **What is sent:** the ActionContract v1 only — action name, module,
  qualified name, risk, approval mode, execution mode, parameter *descriptors*
  (names/kinds/annotations, never values), code fingerprint, and contract
  hash — plus the SDK name and version. **Function arguments, decision and
  outcome events, journals, and signing keys are never sent.** No evidence is
  uploaded.
* **When:** synchronization happens before execution. On success, the call
  continues through the normal Embedded flow: local approval, local execution,
  local signed evidence — all unchanged.
* **On failure:** while Connected mode is explicitly enabled, a
  synchronization failure **prevents execution**. You get a typed
  pre-execution error (`ConnectedConfigurationError`, `ContractSyncError`, or
  `ContractSyncConflictError`), each with `execution_occurred=False` and a
  `retry_safe` hint. There is no silent fallback to unconnected execution.
  Partial configuration (one variable without the other) fails the same way.
* **What it does NOT do:** synchronization records a declaration; it grants no
  permission to execute anything, and this release includes **no** remote
  policy evaluation, no remote or team approval, no evidence upload, and no
  Managed execution. Your function still executes locally, in your process.
* HTTPS is required (`http://` is accepted only for `localhost` development
  endpoints). Requests use a bounded timeout and a stable, content-derived
  `Idempotency-Key`, so retries of the same contract sync are replayed by the
  backend rather than re-registered. Credentials never appear in errors,
  logs, or journals.

## Scope of this release (Embedded)

* **Synchronous functions only.** Decorating an `async def` (or a generator)
  raises `UnsupportedFunctionError` at decoration time — it will not silently
  misbehave.
* **No network access by default.** No telemetry, no update checks, no hidden
  phone-home. Network activity exists only under explicit Connected
  configuration, and then only to synchronize ActionContracts as described
  above.
* Unsupported argument types (arbitrary objects, `self`, clients) are recorded
  as a deterministic type marker such as
  `<igris:unsupported:myapp.PaymentClient>` — never `repr()` output, never
  value data. `NaN`/infinity are rejected before execution.

## Failure behavior (read this)

Igris **fails closed before execution**: if the signing key is unusable, the
input cannot be canonicalized, the approval provider fails, approval is
required without a TTY, or the decision event cannot be signed or appended —
the guarded function does not run.

There is one failure mode that is deliberately different. If the function has
**already executed** and the *outcome* event cannot be written, Igris raises
`ExecutionCompletedEvidenceError` (a subclass of `EvidencePersistenceError`).
This error means: *execution happened (the side effect may exist), but outcome
evidence could not be persisted.* Igris never retries the function.

Machine-readable fields:

| Field | Meaning |
| --- | --- |
| `execution_occurred` | Always `True` for `ExecutionCompletedEvidenceError`. |
| `execution_state` | `"completed"` if the function returned, `"failed"` if it raised. |
| `evidence_state` | Always `"incomplete"`. |
| `retry_safe` | Always `False`; automatic retry may duplicate a side effect. |
| `action_id` | Stable action invocation identifier when available. |
| `decision_event_id` | The persisted decision event id when available. |
| `function_outcome` | Existing structured outcome string: `"succeeded"` or `"failed"`. |
| `result` | Original result only when the function returned successfully. Not included in the error string. |

Example handling:

```python
try:
    result = refund_customer("cus_1234", 500)
except igris.ExecutionCompletedEvidenceError as exc:
    assert exc.execution_occurred is True
    assert exc.evidence_state == "incomplete"
    assert exc.retry_safe is False
    # Do not call refund_customer again automatically.
    # Send to operator review or reconcile the external payment state.
    result = exc.result
```

If the guarded function itself failed and outcome evidence also could not be
persisted, `execution_state == "failed"` and the original function exception is
available as `__cause__`.

Agent/tooling warning: when `execution_occurred=True` and `retry_safe=False`,
an agent or job runner **must not invoke the action again automatically**. The
safe next action is operator review or external-state reconciliation.

A decision event with no following outcome event means the process was
interrupted or died during execution (e.g. `KeyboardInterrupt`).

## Threat model and limitations

What the evidence gives you:

* **Authenticity relative to the local signing key** — events were produced
  by a holder of the private key in `IGRIS_HOME`.
* **Internal tamper evidence** — the hash chain detects modification,
  reordering, and deletion from the middle of the journal.

What it does **not** give you:

* Igris does not prove the underlying external side effect occurred correctly
  — it observes and journals local execution; it does not control it.
* No protection against a fully compromised host: whoever holds the private
  key can write a plausible journal.
* No trusted time — timestamps come from the local clock.
* No legal identity of the approver — "approved" means someone answered `y`
  at that terminal (or a configured provider allowed it).
* **Journal tail truncation is not detectable** from the journal alone;
  detecting it needs an external witness or checkpoint.
* Igris does not make an action idempotent, and does not provide containment,
  exactly-once execution, runtime isolation, or safe recovery. Those
  guarantees require executing through the managed Igris runtime (a separate,
  explicit assurance level — not part of Embedded mode).

## The bigger picture

There is one Igris product and one action contract, with progressively
stronger assurance levels: **Embedded** (this package — local guard, local
approval, signed local evidence), **Connected** (explicit opt-in
synchronization with the Igris backend — today: automatic ActionContract
registration; later: shared policies, team approvals, central evidence), and
**Managed** (execution through the Igris runtime with containment,
anti-replay, checkpoints, and supported recovery). This package implements
Embedded fully and the first Connected capability (contract synchronization);
nothing here phones home or requires the others. See
`docs/architecture/embedded-igris-sdk.md` in the repository for the mapping.

## Development

```bash
uv sync --dev
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv build
```

Tests never touch your real `~/.igris` and never use the network.
