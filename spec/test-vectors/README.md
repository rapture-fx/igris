# Igris protocol test-vector design

Status: **Schema-1 frozen candidate implemented; not released; existing
historical fixtures remain unchanged**

The implemented candidate, its exact manifest, and its release status are in
[`suite-schema-1/`](suite-schema-1/). The publication scope and named vector
families are defined in
[`schema-1-release-plan.md`](schema-1-release-plan.md). Expected verification
objects conform to the machine-readable
[`igris:protocol:verification-result:1`](../schemas/verification-result-1.schema.json)
contract and its
[`ratified data-model specification`](../verification-result-schema-draft.md).

This directory holds the language-neutral schema-1 frozen candidate in
addition to the format and governance material below.
`testdata/igris-contract-v1/` remains the historical Alpha.2 fixture source;
it was copied byte-for-byte where required and was not moved or regenerated.

## Candidate directory structure

```text
spec/test-vectors/
  README.md
  suite-schema-1/
    manifest.json
    CANDIDATE.md
    keys/
      alpha2-historical.public.pem
      deterministic-001.public.raw.b64
      deterministic-001.private.seed.TEST-ONLY.b64
      deterministic-001.metadata.json
    canonical/legacy-json-1/
    contracts/action-contract-1/
    evidence/evidence-1/
    chains/evidence-1/
    mutations/
    trust/
```

Directory names name the object and schema. Vector IDs are lowercase ASCII:
`<area>-<valid|invalid>-<case>-<three digits>`. IDs never change meaning.

## Manifest format

`manifest.json` is UTF-8 JSON and is not itself canonical protocol input.
Proposed shape:

```json
{
  "format": "igris-test-vector-manifest",
  "format_version": "1",
  "suite_id": "igris-protocol-suite-v1",
  "suite_revision": "1.0.0-draft.1",
  "protocol_status": "draft",
  "vectors": [
    {
      "id": "ev-valid-allowed-success-001",
      "object": "evidence",
      "schema_version": "1",
      "capabilities": ["canonical", "verify", "produce"],
      "input": "evidence/evidence-v1/ev-valid-allowed-success-001.input.json",
      "expected": "evidence/evidence-v1/ev-valid-allowed-success-001.expected.json",
      "key_ref": "fixture-ed25519-001",
      "tags": ["decision", "outcome", "unicode"]
    }
  ]
}
```

Required manifest fields are `format`, `format_version`, `suite_id`,
`suite_revision`, `protocol_status`, and `vectors`. Each vector requires
`id`, `object`, `schema_version`, `capabilities`, `input`, and `expected`.
Paths are relative, use `/`, contain no `..`, and must remain inside the suite.

## Expected-file format

Expected files use only language-neutral JSON values:

```json
{
  "canonical": {
    "bytes_base64": "eyJzY2hlbWFfdmVyc2lvbiI6IjEifQ==",
    "utf8": "{\"schema_version\":\"1\"}",
    "sha256_hex": "..."
  },
  "signature": {
    "algorithm": "ed25519",
    "input": "sha256_digest",
    "value_base64": "...",
    "key_id": "ed25519:...",
    "public_key_fingerprint_sha256": "..."
  },
  "verification": {
    "schema_id": "igris:protocol:verification-result:1",
    "artifact": {
      "object_schema_id": "1",
      "object_type": "evidence-chain",
      "artifact_id": null
    },
    "specification": "consistent",
    "parse": "valid",
    "schema": "supported",
    "canonicalization": "valid",
    "algorithm": "supported",
    "object_hash": "valid",
    "signature": "valid",
    "key_resolution": "resolved",
    "continuity": "valid_genesis",
    "completeness": "completeness_unknown",
    "semantics": "valid",
    "trust": "unknown",
    "time_confidence": "producer_asserted",
    "summary": "valid_but_trust_unknown",
    "policy": null,
    "events_verified": 2,
    "issues": []
  }
}
```

`utf8` is a human-review aid; `bytes_base64` is authoritative. Hashes use
lowercase hex. Signatures and binary keys use RFC 4648 standard base64 with
padding. Expected issues are ordered by event index, validation phase, then
code to avoid implementation-map ordering.

## Canonical bytes

Canonical bytes MUST always be present as base64, even when valid UTF-8. A
runner decodes and compares bytes exactly. It MUST NOT reconstruct expected
bytes from the readable `utf8` field. Inputs that should fail canonicalization
omit canonical bytes and carry an expected canonicalization issue.

## Hashes, signatures, key IDs, and outcomes

Expected files record:

- SHA-256 over exact canonical bytes;
- the signature algorithm and exact input convention;
- base64 signature;
- v1 key ID and full public-key fingerprint;
- per-event hash and previous hash for chain vectors;
- decomposed verification outcome and acceptable secondary issue codes.

Trust outcomes are separate from signature outcomes. A valid signature under
an untrusted or revoked key remains cryptographically valid.

## Valid and invalid vectors

Valid vectors are complete positive examples for a named capability. Invalid
vectors should change one property from a valid source and name the expected
primary issue. When one mutation necessarily causes secondary failures (for
example hash mismatch plus invalid signature), the expected file lists them
explicitly.

Mutation files use JSON Pointer-like paths and an operation:

```json
{
  "base_vector": "ev-valid-allowed-success-001",
  "mutations": [
    {"op": "replace", "path": "/events/1/status", "value": "failed"}
  ]
}
```

Allowed operations are `add`, `remove`, `replace`, `reorder`, `truncate`, and
`raw_bytes_replace`. Mutation application is test tooling, not protocol.

## Deterministic fixture-key policy

Fixture keys are for tests only. The suite may contain one fixed Ed25519 seed
only when all of the following are true:

- the filename and adjacent metadata say `TEST ONLY`;
- the public fingerprint is documented in the manifest;
- no service, example, default configuration, or package reads the key;
- secret scanners are configured narrowly so the fixture stays visible to
  reviewers rather than being disguised;
- generation runs only against isolated temporary homes;
- production code rejects or never references the fixture identifier.

**No production private key, credential, tenant key, or private URL belongs in
this repository.** If repository policy rejects committed deterministic private
seeds, generation may derive the test key from a public fixed seed phrase in
the generator; the resulting private bytes remain equally test-only.

## Deterministic generation

Generators pin fixture key, event/action IDs, timestamps, contract source,
input values, and order. They write to a temporary output directory. CI compares
that directory byte-for-byte with goldens and fails on drift. Generation MUST
NOT modify goldens during ordinary tests.

Every generator records tool/runtime versions in non-normative generation
metadata. Normative output must not depend on absolute paths, locale, timezone,
randomness, current time, map iteration, or network services.

## Mapping existing Python and Go fixtures

| Existing artifact/test | Proposed vector family | Treatment |
| --- | --- | --- |
| `testdata/igris-contract-v1/action_contract.json` | `contracts/action-contract-v1/ac-valid-python-ref-001` | Copy as historical input in a future vector commit; expected hash from `expected.json` |
| `action_contract_specialchars.json` | `ac-valid-specialchars-001` | Canonical special-character coverage |
| `journal.jsonl` | `evidence/evidence-v1/ev-valid-alpha2-journal-001` | Preserve exact lines; split readable manifest references only |
| `canonical/decision_approved.canonical.json` | `canonical/can-valid-decision-001` | Base64 exact bytes without committed trailing fixture newline |
| `canonical/outcome_succeeded.canonical.json` | `canonical/can-valid-outcome-001` | Same |
| `verify_key.pem` | `keys/fixture-alpha2-historical.public.pem` | Public-only historical key |
| `expected.json` | Expected files for contract/evidence vectors | Decompose into common result shape without altering original |
| `conformance/contractv1/canonical_conformance_test.go` | Go C1/C2 runner seed | Adapt runner later; existing test stays unchanged now |
| `igris-overture/internal/canonicaljson/canonicaljson_test.go` | Production Go C1 coverage | Consume proposed manifest later |
| `sdk/python/tests/test_verification.py` | Python negative-vector source | Translate tamper/reorder/delete/unknown cases later |
| `igris-overture/api/routes_evidence_test.go` | Go transition/transport source | Translate semantic and prohibited-field cases later |

Current fixtures are nondeterministic point-in-time snapshots because the
generator creates fresh keys, UUIDs, and timestamps. They MUST remain as
historical compatibility fixtures. A new deterministic suite is additive and
does not rewrite them.

## Golden-file governance

Golden changes require protocol-owner and security review, a manifest revision,
byte/hash/signature diff, compatibility statement, and successful independent
runners. Released suite revisions are immutable. Corrections add a superseding
vector/revision with rationale; they do not silently edit history.
