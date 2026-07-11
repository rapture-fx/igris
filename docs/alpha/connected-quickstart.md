# Connected Quickstart (Optional)

Complete the [Embedded quickstart](embedded-quickstart.md) first. Connected is
optional and needs credentials for a disposable private-alpha tenant. Do not
use production credentials or infrastructure. If none were supplied, stop:
the Embedded evaluation is complete.

Connected adds two separate network operations:

1. `@igris.guard` automatically synchronizes the ActionContract before local
   approval and execution.
2. Evidence leaves the machine only when you explicitly run
   `igris evidence sync`.

It does not change the decorator and does not move execution to Igris.

## 1. Configure explicit participation

```bash
source .venv-igris-alpha/bin/activate
export IGRIS_API_URL="https://your-private-alpha-endpoint.example"
export IGRIS_API_KEY="replace_with_a_disposable_test_key"
export IGRIS_HOME="$(mktemp -d)/igris"
```

Both variables are required. HTTPS is required except for `http://localhost`,
`http://127.0.0.1`, and `http://[::1]` development endpoints. Never put a real
key in this guide, a shell script, source control, or captured evaluator notes.

## 2. Run the unchanged example

```bash
python examples/private-alpha/refund_demo.py
igris verify "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"
```

Before the first guarded call for this contract version, Igris sends the
ActionContract and SDK name/version. If synchronization fails, the guard raises
`ConnectedConfigurationError`, `ContractSyncError`, or
`ContractSyncConflictError` before approval, journal writes, or function
execution. These errors expose `execution_occurred=False`; there is no silent
fallback to Embedded-only execution. A successful contract sync is cached for
that endpoint/action/hash in the process.

After synchronization, approval and the function still run locally, and the
journal is still written under `IGRIS_HOME`.

## 3. Upload evidence explicitly

No guarded call uploads evidence. Review the journal offline, then opt in:

```bash
igris evidence sync "$IGRIS_HOME/journal.jsonl" --public-key "$IGRIS_HOME/verify_key.pem"
```

Expected patterns:

```text
OK: local verification passed (5 event(s), key ed25519:<id>)
synced 5 event(s) in 1 batch(es); execution_provenance stays embedded
  batch <batch-id>: verified, 5 event(s)
```

Copy the returned batch ID and inspect it:

```bash
export IGRIS_BATCH_ID="paste_the_returned_batch_id"
igris evidence status "$IGRIS_BATCH_ID"
```

Expected fields include `evidence_state: verified`,
`execution_provenance: embedded`, `events_accepted`, `events_verified`, and
`chain_head`. Re-running evidence sync is content-idempotent; an unchanged
journal reports that it is already up to date.

## Interpret the result correctly

| Concept | Meaning here |
| --- | --- |
| Local execution | The decorated Python function ran in your process. |
| Central verification | Igris checked uploaded event bytes, signatures, chain, schema, and transitions. |
| Managed execution | The action executes through an authenticated Igris runtime. This alpha does not do this. |

`evidence_state=verified` does not prove that an external refund, payment, or
other side effect happened or was correct. It does not establish trusted time,
host integrity, a named human signer, containment, idempotent action execution,
or exactly-once behavior. Central verification never changes
`execution_provenance=embedded` to `managed`.

## Failure and retry rules

Contract synchronization is before execution. For its typed errors, inspect
`execution_occurred` and `retry_safe`; retry only when `retry_safe is True` or
after correcting the reported configuration/request problem.

Evidence sync never invokes the consequential function. Its transport, 429,
and 5xx errors are content-keyed and report `retry_safe=True`. Validation,
authentication, and conflict errors report `retry_safe=False` and require a
correction or investigation first.

An unrelated guarded-call `ExecutionCompletedEvidenceError` means the function
already ran but local outcome evidence failed to persist. It always has
`execution_occurred=True` and `retry_safe=False`: never automatically call the
action again.

See [What Leaves Your Machine](what-leaves-your-machine.md) before uploading,
and [Troubleshooting](troubleshooting.md) for typed failures.
