# Igris Receipt and Proof Spec v0.1

Status: public draft  
Scope: local Run / Recover / Prove path and current Overture/runtime receipt verification behavior

Igris proof means there is a signed, inspectable execution artifact that can be checked after the action. Logs explain what happened. Receipts prove what the runtime signed and what Overture can verify.

This spec describes the current model. It does not claim production host isolation, public-ledger verification, or proof for every possible run.

## Plain Language Model

- Logs explain. They are useful for debugging, but a log line is not proof.
- Signed runtime callbacks authorize lifecycle state changes such as checkpoint, complete, and failed. They are not execution proof receipts.
- Receipts are runtime-signed records of execution metadata, resource usage, violation state, and hash-chain linkage.
- Verification results are Overture's answer after it re-derives hashes, checks signatures with a registered runtime key, and checks receipt-chain linkage where applicable.

The current local proof loop proves this narrower claim: a local runtime can execute a deterministic action, emit signed artifacts, mutate task state only through signed callback envelopes, block automatic replay for an irreversible failed action, and return receipt/task proof verification results backed by a live Overture server.

## Artifact Types

### Logs

Logs are operational text emitted by scripts, Overture, the runtime, tests, and local tooling. They can show progress, URLs, and failure reasons. Logs are not treated as proof because they are not the canonical signed receipt artifact.

### Signed Runtime Callback Envelopes

Runtime callbacks mutate task lifecycle state in Overture:

- `checkpoint`
- `complete`
- `failed`

The runtime sends an `X-Igris-Callback-Envelope` header with the callback request. Overture validates the envelope before accepting the mutation. The envelope authorizes the lifecycle transition; it does not prove the whole execution.

Envelope fields currently used:

| Field | Meaning |
| --- | --- |
| `version` | Callback envelope schema version. Current value: `runtime_callback.v1`. |
| `tenant_id` | Tenant/user boundary for the task. Treat as sensitive enough to redact in public examples. |
| `task_id` | Durable task being mutated. |
| `runtime_id` | Registered runtime identity that signs the callback. |
| `callback_type` | One of `checkpoint`, `complete`, or `failed`. |
| `body_digest` | SHA-256 hex digest of the exact callback HTTP body. |
| `timestamp_unix_ms` | Runtime signing timestamp in Unix milliseconds. |
| `nonce` | One-time value used for replay protection. |
| `algorithm` | Current value: `ed25519-sha256-canonical-json`. |
| `signature` | Base64 Ed25519 signature over the SHA-256 digest of the canonical envelope JSON. |

The signed canonical callback envelope includes `algorithm`, `body_digest`, `callback_type`, `nonce`, `runtime_id`, `task_id`, `tenant_id`, `timestamp_unix_ms`, and `version`. It excludes `signature`.

The runtime signs callback envelopes with its Ed25519 runtime identity. Overture verifies them by:

1. Parsing the header as JSON or base64-encoded JSON.
2. Checking version, algorithm, tenant, task, callback type, body digest, runtime identity, and timestamp freshness.
3. Looking up the runtime public key in `runtime_instances`.
4. Verifying the Ed25519 signature.
5. Reserving `(tenant_id, runtime_id, nonce)` so the same signed envelope cannot be replayed.
6. Persisting rejected callback evidence without storing raw callback bodies.

Unsigned runtime callbacks are not part of the main path. The local proof loop refuses to run when unsigned callback compatibility is enabled.

### Execution Receipts

The Rust runtime emits `ExecutionReceipt` records. Current runtime fields include:

| Field | Meaning |
| --- | --- |
| `execution_id` | UUIDv7 execution identifier. |
| `agent_id` | Logical agent identifier. |
| `runtime_id` | Runtime/device identity, present when known. |
| `transaction_id` | Optional execution transaction boundary ID. |
| `transaction_hash` | Optional hash of the bounded execution transaction. |
| `cpu_time_ms` | Worker CPU time in milliseconds. |
| `wall_time_ms` | Wall-clock execution duration in milliseconds. |
| `memory_peak_mb` | Peak resident memory in MiB. |
| `fs_bytes_written` | Filesystem bytes written by the worker process. |
| `tool_calls` | Number of tool calls observed. |
| `violation_occurred` | Whether a capability or containment violation occurred. |
| `timestamp_utc` | RFC3339 UTC receipt timestamp. |
| `previous_hash` | Previous receipt hash, empty for a genesis receipt. |
| `hash` / `receipt_hash` | SHA-256 hex of canonical receipt JSON excluding `signature`. |
| `signature` | Base64 Ed25519 signature over the SHA-256 digest of canonical receipt JSON. |

Overture also exposes receipt rows through API shapes that may include `tenant_id`, `status`, `prompt_preview`, runtime labels, proof status, and receipt IDs. Public examples should redact tenant IDs and avoid prompts or request bodies that may contain secrets.

Expected/proposed fields that may appear in higher-level docs or future surfaces, but are not the core runtime receipt fields above, include:

- `version`
- `task_id`
- `action_digest`
- `checkpoint_digest`
- `policy_decision_id`
- explicit `algorithm`
- explicit `verification_status`
- separate body/hash fields for governed non-runtime receipt families

When these fields are absent, do not infer proof. Treat proof as unavailable or partial according to the verification result.

### Verification Results

Current receipt verification endpoints include:

- `POST /proof/receipts/verify`
- `POST /v1/tasks/:id/proof/verify`

Verification result fields include:

| Field | Meaning |
| --- | --- |
| `verified` / `valid` | True only when fresh cryptographic verification succeeds. |
| `hash_valid` | Whether the canonical receipt hash re-derives correctly. |
| `signature_matches` | Whether the receipt signature verifies against the runtime public key. |
| `runtime_key_found` | Whether Overture found a usable runtime public key. |
| `chain_valid` / `chain_link_valid` | Whether `previous_hash` is a valid genesis or resolves to an intact prior receipt. |
| `verification_status` / `status` | Current persisted proof state, such as `verified`, `present`, `missing`, `mismatch`, or `failed`. |
| `message` / `verification_reason` | Human-readable reason for the verification outcome. |

Stored-value comparison alone is not enough to mark `verified=true`. If the runtime key or signed receipt artifact is missing, the result must stay unavailable, present, missing, mismatch, or failed rather than being promoted to verified.

## Proof States

- Verified: Overture has a signed receipt, can derive the stored hash, can verify the Ed25519 signature with a registered runtime key, and reports chain status.
- Partially verified: some checks pass, but another independent check is absent or false, such as missing chain link or missing runtime key.
- Unavailable: the task has no persisted proof reference, receipt, signature, runtime key, or database-backed proof route needed to verify.
- Failed: Overture performed verification and one or more required checks did not pass.

## Redacted Example Receipt

```json
{
  "execution_id": "019e5924-8ade-7c70-b58f-1a115d3d92d8",
  "agent_id": "action-task-demo",
  "runtime_id": "ed5cc5b1-efc0-4e98-ae8f-9411889719e2",
  "cpu_time_ms": 12,
  "wall_time_ms": 48,
  "memory_peak_mb": 64,
  "fs_bytes_written": 0,
  "tool_calls": 1,
  "violation_occurred": false,
  "timestamp_utc": "2026-05-24T15:42:00Z",
  "previous_hash": "REDACTED_OR_EMPTY_FOR_GENESIS",
  "hash": "REDACTED_SHA256_HEX",
  "signature": "REDACTED_BASE64_ED25519_SIGNATURE"
}
```

## Redacted Verification Result

```json
{
  "verified": true,
  "valid": true,
  "execution_id": "019e5924-8ade-7c70-b58f-1a115d3d92d8",
  "receipt_id": "REDACTED_RECEIPT_ROW_ID",
  "runtime_id": "ed5cc5b1-efc0-4e98-ae8f-9411889719e2",
  "hash": "REDACTED_SHA256_HEX",
  "signature": "REDACTED_BASE64_ED25519_SIGNATURE",
  "verification_status": "verified",
  "hash_valid": true,
  "signature_matches": true,
  "chain_valid": true,
  "runtime_key_found": true,
  "message": "Receipt cryptographically verified."
}
```

## Current Limits

- Proof is unavailable without signed runtime artifacts and a registered runtime key.
- Signed callback envelopes authorize lifecycle mutation; they are not execution proof receipts.
- Boundary records document runtime-supported execution controls and policy decisions. They are not a claim of full OS or container isolation.
- Broad multi-runtime portability remains experimental.
- Docker is optional for local onboarding and should only be called validated after the live proof loop completes on a Docker-enabled machine.
- The local proof loop is a developer proof path, not a production guarantee.

## Security Notes

Do not put secrets in receipts, checkpoints, proof exports, prompts, callback bodies, or demo transcripts. Avoid raw `DATABASE_URL`, database passwords, private keys, bearer tokens, API keys, raw callback bodies, and raw environment values. Public examples should use redacted IDs and hashes, and should preserve only the fields needed to explain the proof model.

