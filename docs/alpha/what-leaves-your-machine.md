# What Leaves Your Machine

## Data Matrix

| Data or operation | Embedded (Connected variables absent) | Connected contract sync | Explicit evidence sync |
| --- | --- | --- | --- |
| Network request | None | `POST /v1/contracts/sync` before execution | `POST /v1/evidence/batches`; status uses `GET /v1/evidence/batches/:id` |
| Function execution | Local | Local, after successful sync and approval | No action is executed |
| Argument values | Local only; redacted form may enter journal | Never sent | Only already-redacted event summaries/hashes present in selected journal |
| ActionContract | Derived locally | Sent | Contract hash is present in signed events |
| Decision/outcome events | Local journal | Not sent by the guard | Selected signed events sent verbatim |
| Public verification key | Local file | Not sent | Sent as PEM with derived `key_id` |
| Private signing key | Local file only | Never sent | Never sent |
| API key | Not used | Authorization header only | Authorization header only |
| Local paths/environment | Local only | Never sent | Never sent |

No telemetry, update check, implicit registration, automatic evidence upload,
or background synchronization exists in Embedded mode.

## Contract Synchronization Payload

The request contains `contract`, with:

- `schema_version`
- `action_name`
- `module`
- `qualified_name`
- `risk`
- `approval_mode`
- `execution_mode` (always `embedded` in this SDK)
- `parameter_descriptors`, each containing `name`, `kind`, `has_default`, and
  `annotation`, never an argument value
- `code_fingerprint` (SHA-256 of dedented function source when available, not
  the source itself)
- `contract_hash`

It also contains `client.sdk="igris-python"` and `client.sdk_version`. The API
key is an Authorization bearer credential, and a content-derived idempotency
key is a header. No journal or evidence is included.

## Evidence Synchronization Payload

The explicit command first verifies the journal locally, then sends:

- `key_id`
- `public_key_pem`
- `journal_segment.first_previous_event_hash`
- `journal_segment.events`, containing selected signed decision/outcome events
  verbatim

Each event includes common identity, contract, timestamp, chain, hash, and
signature fields. Decision events include the decision, risk, approval mode,
redacted input summary, input hash, and optional redacted metadata. Outcome
events include status, decision reference, observed result type, and either a
redacted output hash or sanitized exception information.

## Never Sent

These values are not sent by either synchronization path:

- `signing_key.pem` or any private-key bytes
- `IGRIS_API_KEY` in a body, event, error, or journal
- unrelated environment variables
- local filesystem paths
- function source code
- raw values replaced by redaction before journaling
- unselected journals

Redaction is name-based and recursive for known sensitive keys plus names you
configure. It is not a general data-loss-prevention system: choose parameters
and metadata carefully and inspect the local journal before upload.

## Signing Identity

On first use, the SDK creates an Ed25519 key pair under `IGRIS_HOME`. The
`key_id` and fingerprint derive from the public key. A valid signature proves
that a holder of that local private key produced the event. It does not prove a
named human, legal identity, particular device, secure enclave, uncompromised
host, or trustworthy approver. Protect and back up the key according to the
sensitivity of the evidence; rotation and revocation are not in this alpha.

## Provenance and State

`execution_provenance=embedded` means execution was observed in the caller's
local process/environment. Evidence ingestion fixes this value; the client
cannot request `managed`, and central verification cannot promote it.

`evidence_state=verified` means the server recomputed canonical hashes,
verified Ed25519 signatures, checked chain continuity, recognized the schema,
and checked decision/outcome transitions. It does not strengthen execution
provenance.

The separate value `evidence_state="incomplete"` exists only on local
`ExecutionCompletedEvidenceError`; it means execution occurred but the local
outcome event could not be persisted. It is not a central ingestion state.

## Non-Guarantees

Neither Embedded nor centrally verified Embedded evidence proves:

- that a refund or any external side effect happened or was correct;
- trusted timestamps (the timestamp comes from the local clock);
- that the host or private key was uncompromised;
- legal or human identity of an approver;
- journal tail completeness without an external checkpoint;
- containment, runtime isolation, anti-replay, or safe recovery;
- action idempotency or exactly-once execution;
- Managed execution.

Igris guards and observes this local call. It does not control the synthetic
example's fictional external world.
