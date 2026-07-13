# Private-Alpha Troubleshooting

Treat guarded-call failures and explicit evidence-sync failures separately.
Evidence sync never executes an action. For a guarded call, never retry when
`execution_occurred=True` and `retry_safe=False`.

| Symptom | Actual type/code | Did the consequential function execute? | Is retry safe? | Action |
| --- | --- | --- | --- | --- |
| Only one Connected variable is set, URL is invalid, or non-local HTTP is used | `ConnectedConfigurationError` | No (`execution_occurred=False`) | No until fixed (`retry_safe=False`) | Set both variables correctly, or unset both for Embedded mode. |
| Contract credential rejected (401/403) | `ContractSyncError`; server code commonly `unauthenticated` | No | No with same credential | Replace the disposable credential; do not print it. |
| Evidence credential rejected (401/403) | `EvidenceSyncAuthenticationError`; commonly `unauthenticated` | No action is invoked by sync | No with same credential | Correct the credential, then rerun sync. |
| Server recomputes a different contract hash (422) | `ContractSyncError`, `error_code="contract_hash_mismatch"` | No | No for unchanged request | Check SDK/server compatibility and report both versions; do not edit the hash. |
| Contract idempotency key is bound to different content (409) | `ContractSyncConflictError`, `error_code="idempotency_key_conflict"` | No | No for same key/content mismatch | Report endpoint, SDK version, action name, and contract hash without the API key. |
| Journal fails locally, server rejects a batch, or response state is rejected | `EvidenceSyncValidationError`; codes may include `validation_failed`, `hash_mismatch`, `bad_signature`, `invalid_transition`, or `verification_failed` | No action is invoked by sync; earlier journaled actions are unchanged | No until investigated | Run `igris verify`; preserve the journal; do not repair or rewrite it. |
| `igris verify` reports `INVALID` | Verification issue codes include `malformed_json`, `malformed_event`, `unknown_schema`, `unknown_event_type`, `missing_fields`, `chain_break`, `hash_mismatch`, `unknown_key`, `bad_signature` | Verification executes no action | Do not retry an action; verification may be rerun after restoring the original journal/key | Preserve a copy and compare with the trusted original. The CLI exits 1. |
| Server's chain head is absent locally or changes during upload (409) | `EvidenceSyncConflictError`, `error_code="chain_head_mismatch"` | No action is invoked by sync | No automatic retry (`retry_safe=False`) | Check whether another journal used this signing identity. One journal per signing identity is supported. |
| Evidence idempotency key is bound to different bytes (409) | `EvidenceSyncConflictError`, `error_code="idempotency_key_conflict"` | No action is invoked by sync | No for the conflicting request | Preserve the journal and report the batch/idempotency context; never invent a replacement key. |
| Connected request times out | Guard: `ContractSyncError`; explicit upload/status: `EvidenceSyncTransportError` | Contract sync: No. Evidence sync: no action is invoked | Yes only when the exception says `retry_safe=True`; contract registration and evidence ingestion are content-keyed | Retry the identical operation after connectivity recovers. Do not infer that a guarded function ran. |
| Evidence endpoint redirects (3xx) | `EvidenceSyncTransportError` | No action is invoked by sync | Yes after correcting/confirming endpoint (`retry_safe=True`) | Use the final trusted HTTPS endpoint; evidence uploads refuse redirects. Contract sync currently uses standard urllib redirect behavior; see the defect log. |
| Outcome journal append fails after the function returns or raises | `ExecutionCompletedEvidenceError` | **Yes** (`execution_occurred=True`) | **No** (`retry_safe=False`) | Do not invoke the action again automatically. Reconcile the external state or send to operator review. `evidence_state="incomplete"`. |
| Python is older than 3.10 | Installer rejects `Requires-Python >=3.10`, or syntax/import may fail if bypassed | No guarded call should be attempted | Retry only after creating a Python 3.10+ environment | Run `python --version`, recreate the virtual environment, reinstall the wheel. |
| Backend evidence migration is absent | Usually `EvidenceSyncServerError` with HTTP 5xx and server `db_error`; contract storage migration absence similarly yields `ContractSyncError`/`db_error` | Contract sync failure: No. Evidence command: no action is invoked | Typed 5xx errors report retry-safe, but only after the operator applies the expected migration | Stop evaluation and ask the backend owner to apply the normal migration runbook. Never apply or edit migrations from this kit. |

## Inspect Machine-Readable Fields

For a caught Connected guarded-call error:

```python
print(type(exc).__name__)
print(getattr(exc, "execution_occurred", None))
print(getattr(exc, "retry_safe", None))
print(getattr(exc, "status_code", None))
print(getattr(exc, "error_code", None))
```

Most ordinary Embedded exceptions do not expose these fields. `ActionDenied`
means the denied function did not execute. A normal function exception means
the function did execute and Igris re-raised it after writing a failed outcome.

## Authentication and Secret-Safe Reporting

Report status code, typed exception, error code, SDK version, endpoint host,
action name, and contract hash where relevant. Never paste `IGRIS_API_KEY`,
private-key material, full Authorization headers, or an unreviewed journal into
an issue.
