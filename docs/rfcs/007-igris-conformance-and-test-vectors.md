# RFC 007: Igris conformance and test vectors

Status: **Draft**
Goal: enforce interoperability without shared implementation code

## Conformance levels

Conformance is capability-scoped; no implementation is simply “Igris
conformant” without a level and schema list.

| Level | Required behavior |
| --- | --- |
| C1 Canonical | Reproduce canonical bytes and hashes for declared schemas |
| C2 Verify | C1 plus signature, required-field, chain, and typed-result verification |
| C3 Produce | C2 plus emit valid contracts/evidence for supported lifecycle paths |
| C4 Binding | C3 plus provider failure ordering, callable ergonomics, zero-network Embedded behavior, and error taxonomy |
| C5 Connected transport | C2 plus authenticated/scoped upload semantics, limits, idempotency, and provenance separation |

An implementation MAY claim multiple levels. Claims MUST name schema versions,
algorithms, vector-suite revision, language/runtime version, and excluded
optional profiles.

## Canonicalization vectors

Vectors MUST contain the structured input, exact canonical UTF-8 bytes encoded
as base64, a readable UTF-8 rendering when valid, and SHA-256. Coverage must
include key ordering, Unicode, `<>&`, quotes, backslashes, control characters,
null/bool/integer, arrays, nested objects, empty values, invalid numbers,
excessive depth, and input-shape failures.

Current positive authority is
`testdata/igris-contract-v1/canonical/*.canonical.json`. Current negative
control is `TestHTMLEscapedEncodingMustDiffer` in
`conformance/contractv1/canonical_conformance_test.go`.

## Signature vectors

Each vector contains public key bytes/encoding, full fingerprint, v1 key ID,
canonical unsigned bytes, digest, signature, and expected verification result.
Negative cases cover changed payload, changed digest, wrong public key,
malformed base64, wrong-length signature, and signatures over the wrong input
(canonical bytes rather than the raw digest).

No production private key belongs in the repository. A deterministic fixture
private key may exist only under a clearly test-only vector directory if the
governance policy in the test-vector README is accepted.

## Hash-chain vectors

Positive vectors cover null genesis, two or more linked events, and a partial
segment with an external anchor. Negative vectors cover wrong genesis, middle
deletion, insertion, reorder, duplicated event, recomputed-hash tampering,
forked successor, and mismatched segment anchor. Tail truncation is expected to
be internally valid but incomplete/unwitnessed.

## ActionContract vectors

Vectors include exact v1 bodies, canonical bytes without `contract_hash`,
expected contract hash, and validation result. Cases cover parameter ordering,
nullable code fingerprint, all risk/approval values, invalid names, unknown
schema, missing/extra fields, tampered hash, and special characters.

Current source fixtures are `action_contract.json` and
`action_contract_specialchars.json` under `testdata/igris-contract-v1/`.

## Valid evidence vectors

At minimum:

- allowed decision followed by succeeded outcome;
- allowed decision followed by failed outcome;
- denied decision without outcome;
- multiple instances in one chain;
- Unicode/special-character content;
- fully redacted, partially redacted, no-argument, and privacy-unknown
  summaries as privacy-policy inputs (not all safe to upload).

## Invalid evidence vectors

Invalid vectors MUST isolate a primary expected failure while allowing a list
of acceptable secondary diagnostics. They cover malformed JSON, non-object,
unknown schema/type, missing/wrong-type fields, invalid timestamp, invalid
decision/status, orphan outcome, outcome after denial, duplicate outcome,
oversize/depth limits where the level includes transport, and prohibited
tenant/managed-provenance assertions.

## Tampering vectors

Tampering vectors preserve the original source vector and apply a declarative
mutation (path, operation, value). Expected results distinguish hash mismatch,
bad signature, chain break, and semantic transition failure. A test runner
MUST NOT regenerate the expected signature after applying an attacker mutation
unless the vector explicitly tests recomputed-hash tampering.

## Unknown-version vectors

Unknown schema vectors expect `unsupported_schema`, not `invalid_signature`,
when cryptographic evaluation cannot safely dispatch the field layout. Runners
must demonstrate fail-closed behavior and bounded parsing. Future known-schema
vectors remain in version-specific directories so old runners can skip them
with a typed unsupported result.

## Key trust vectors

Trust vectors layer policy metadata over cryptographically valid/invalid
content:

- supplied but untrusted key;
- unknown key ID;
- key-ID collision/ambiguity;
- trusted TOFU pin and changed pin;
- organization-bound key;
- rotated key;
- revoked key before/after/unknown compromise time;
- stale offline revocation snapshot.

Expected results contain separate integrity, key-resolution, and trust fields.

## Privacy vectors

Privacy vectors contain fixture markers only, never real personal data or
secrets. They test exact redaction markers, undeclared ordinary values,
truncated/ambiguous summaries, unsupported markers, nested sensitive keys,
sanitized exceptions, and low-entropy-hash warnings. Reports must not echo
retained values.

## Expected verification results

The common result shape is conceptual until a language-neutral schema is
approved, but vectors use these fields:

```json
{
  "parse": "valid",
  "schema": "supported",
  "integrity": "valid",
  "key_resolution": "resolved",
  "trust": "not_evaluated",
  "chain": "valid_unwitnessed",
  "semantics": "valid",
  "overall": "valid_with_unestablished_trust",
  "issues": []
}
```

Required distinct issue codes include `malformed`, `unsupported_schema`,
`unsupported_event_type`, `missing_field`, `invalid_field`, `hash_mismatch`,
`invalid_signature`, `unknown_key`, `ambiguous_key`, `untrusted_key`,
`revoked_key`, `chain_break`, `partial_chain`, `invalid_transition`, and
`unresolved_decision`. Language exceptions may differ but must map to these
meanings.

## Language-neutral vector format

Vectors are UTF-8 JSON data plus binary material encoded as base64 and hashes
as lowercase hex. The manifest identifies suite revision, protocol object,
schema version, capability level, input files, expected files, cryptographic
material, mutations, and results. No Python module/class name may be required
to interpret a vector.

The detailed proposed layout is
[`spec/test-vectors/README.md`](../../spec/test-vectors/README.md).

## Deterministic fixture generation

Generators MUST pin all nondeterministic inputs: test-only key, IDs, timestamps,
clock, field order inputs, and source contract. Generation occurs in a clean
environment and must be reproducible byte-for-byte. A separate verifier written
independently SHOULD validate generated artifacts.

Current fixtures are point-in-time rather than reproducible because
`testdata/igris-contract-v1/generate_fixtures.py` creates a fresh key, UUIDs,
and timestamps. They remain valuable historical fixtures but do not yet meet
the proposed deterministic-generation level.

## Golden-file governance

Golden files are append-only within a released suite revision. A changed byte
requires either correcting a demonstrably erroneous pre-release vector with an
explicit review note or adding a new schema/suite revision. Reviews must show
decoded diff, byte diff, expected hash/signature diff, compatibility impact,
and approvals from protocol plus security owners.

Generators MUST NOT overwrite goldens as an incidental test step. CI verifies
clean regeneration in a temporary directory.

## Cross-language test runner contract

A runner accepts a manifest path and optional capability filter, performs no
network access, writes no fixture files, and exits:

- `0` when every supported vector matches;
- `1` for a conformance mismatch;
- `2` for invalid runner invocation/suite corruption;
- `3` when the requested capability/schema is unsupported.

Machine-readable output lists vector ID, support status, actual structured
result, expected result, and byte/hash differences without secret material.
Runners must not call a reference implementation at runtime.

## Contribution process

1. State the bug, ambiguity, or new capability.
2. Add or update normative RFC text.
3. Add positive and negative language-neutral vectors.
4. Run every maintained independent runner.
5. Include compatibility and security review.
6. Record golden-file approval and suite revision.

One implementation passing its own generated vectors is necessary but not
sufficient. At least one independent verifier should pass before a new signed
format is accepted.

## Backward compatibility

Historical vector suites remain runnable. New runners MUST keep support for
claimed historical schemas. Old runners may report a new schema unsupported.
No golden update may cause valid Alpha.2 v1 journals to hash differently.
Conformance tightening that adds semantic diagnostics must preserve separate
cryptographic results and document whether historical overall status changes.
