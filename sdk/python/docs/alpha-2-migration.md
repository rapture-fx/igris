# Migrating from v0.1.0-alpha.1 to v0.1.0-alpha.2

Alpha.2 adds two capabilities to the Embedded SDK and makes one existing
command stricter. There is **no evidence protocol, canonical-bytes, signature,
chain, batch-identity, or backend API change**: journals written by alpha.1
verify and sync byte-identically under alpha.2.

The alpha.2 package version is **`0.1.0a2`** (PEP 440 prerelease;
`igris --version` reports `igris 0.1.0a2`). Alpha.1 shipped as `0.1.0a1`,
so the two prereleases order naturally (`0.1.0a1 < 0.1.0a2`).

## What changed

| Area | alpha.1 | alpha.2 |
| --- | --- | --- |
| `igris evidence sync` | uploads any locally verified journal | refuses journals with retained or unknown argument content unless `--allow-unredacted` is passed |
| `igris evidence inspect` | did not exist | local privacy classification; never touches the network |
| Existing callables | must be edited to add `@igris.guard` | `igris.wrap_tool` / `igris.wrap_tools` guard them unmodified |
| `async def` tools | rejected everywhere | supported by `wrap_tool` only (the decorator still rejects them) |

## Stricter evidence sync (action may be required)

Before any configuration is read, any DNS lookup happens, or any HTTP request
is created, `igris evidence sync` now classifies every decision event in the
journal:

- `fully_redacted` — every recorded argument value is the redaction marker
- `no_arguments` — the invocation recorded no arguments
- `partially_redacted` — at least one ordinary argument value remains in
  signed evidence
- `unknown` — the summary is malformed, truncated, or uses an unsupported
  type placeholder

Journals containing any `partially_redacted` or `unknown` decision **refuse
to sync by default**. The refusal is fail-closed: nothing is uploaded, the
journal and signing keys are never modified, and retained values are never
printed.

If your alpha.1 journals synced before, they still verify — but they may now
require either of the following to sync:

1. Redact the business parameters at the declaration site
   (`redact=["customer_id", ...]`) so future evidence is `fully_redacted`.
   Name matching is exact (case-insensitive), not substring: `access_token`
   is covered by the default list, `auth_token` is not — list it explicitly.
2. Acknowledge explicitly for a single upload:

   ```bash
   igris evidence sync --allow-unredacted
   ```

   The flag applies to **that invocation only**. It is not persisted, and
   there is deliberately no environment-variable or configuration equivalent.

### Exit code 3

`igris evidence sync` and `igris evidence inspect` exit with code **3**
(`EXIT_PRIVACY_ACK_REQUIRED`) when the journal would need
`--allow-unredacted` to upload. Existing meanings are unchanged: `0` success,
`1` invalid journal or rejected upload, `2` usage/configuration error. Update
any automation that treated every non-zero exit as journal corruption.

### Inspect before you upload

```bash
igris evidence inspect                    # default journal under $IGRIS_HOME
igris evidence inspect path/to/journal.jsonl --verbose
```

Inspection verifies the journal offline with the same primitives as
`igris verify`, then reports classification counts and — for partially
redacted actions — the parameter *names* that may retain content. Values are
never printed. Inspection performs zero network requests and never rewrites
the journal or keys. See [`evidence-privacy.md`](evidence-privacy.md) for
classification rules and limitations; redaction does **not** provide
anonymity (names, hashes, timestamps, and metadata still disclose
information).

## Wrapping existing callables (new, no action required)

```python
import igris

wrapped = igris.wrap_tool(
    existing_function,
    action="support.ticket.archive",
    risk="medium",
    redact=["ticket_ref"],
)

tools = igris.wrap_tools(
    {"archive": archive_ticket, "search": search_tickets},
    configuration={
        "archive": {"action": "support.ticket.archive"},
        "search": {"action": "support.ticket.search"},
    },
)
```

`wrap_tool` returns a new callable that produces the same signed evidence as
an equivalent `@igris.guard` declaration; the original callable is never
mutated. Supported: plain functions, `async def` functions, bound methods,
`functools.partial` objects, and callable objects. Rejected with
`ToolWrapError`: non-callables, already-guarded callables, and (async)
generator functions. `wrap_tools` accepts a sequence (keyed by `__name__`)
or a mapping (keyed by the mapping keys), returns a new collection, never
mutates the input, and rejects duplicate action names.

Wrapping is **framework-neutral only**: the SDK ships no adapters for any
agent framework and performs no automatic tool discovery.

### Async asymmetry

`wrap_tool` supports `async def` functions and preserves their semantics
(denial prevents execution; exceptions record a `failed` outcome and
re-raise; cancellation propagates without fabricating an outcome).
`@igris.guard` still rejects `async def` exactly as in alpha.1 — decorating
one raises `UnsupportedFunctionError`. Use `wrap_tool` for async tools.

### Contract versions when switching declaration style

The contract hash includes function identity (module, qualified name, code
fingerprint), not just the semantic fields. Moving an action between
`@igris.guard` and `wrap_tool` — or between two differently named functions —
therefore produces a different `contract_hash` even when the action name,
risk, approval mode, and parameters are identical. In Connected mode this
registers as a **new contract version** on first sync; it does not mutate or
invalidate previously synced contracts or evidence.

## New public API in alpha.2

Functions: `igris.wrap_tool`, `igris.wrap_tools`, `igris.inspect_journal`.
Types: `igris.EvidencePrivacyReport`, `igris.PrivacyClassification`.
Typed errors: `igris.ToolWrapError` (a `ContractError`),
`igris.EvidencePrivacyInspectionError` (an `IgrisError`),
`igris.EvidencePrivacyPreflightError` (an `EvidenceSyncError`).

Everything that existed in alpha.1 is unchanged; no symbol was removed or
renamed.

## Rollback

Downgrading to alpha.1 is safe for evidence: journals are byte-compatible in
both directions. You lose `evidence inspect`, the privacy preflight (alpha.1
uploads partially redacted journals without asking), and `wrap_tool` /
`wrap_tools` (code importing them fails with `AttributeError`/`ImportError`).
