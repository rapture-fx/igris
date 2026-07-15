# RFC 007: Igris conformance and test vectors

Status: **Draft**
Goal: enforce interoperability without shared implementation code

**Current:** Alpha.2 has Python-generated ActionContract/Evidence fixtures and
two Go byte-verification suites, but no language-neutral manifest, deterministic
fixture generator, common result schema, or declared conformance levels.

**Candidate proposal:** The levels, vector families, runner contract, and
governance below define the target conformance program. They do not alter
current fixtures. The concrete schema-1 release design is
[`schema-1-release-plan.md`](../../spec/test-vectors/schema-1-release-plan.md).

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

C1 through C3 are protocol-object capabilities. C4 is a language-binding
profile, and C5 is a Connected transport/product profile; neither adds fields
to a signed protocol object. A standalone verifier is expected to claim C2,
not C4 or C5.

## Canonicalization vectors

Vectors MUST contain the structured input, exact canonical UTF-8 bytes encoded
as base64, a readable UTF-8 rendering when valid, and SHA-256. Coverage must
include key ordering, Unicode, `<>&`, quotes, backslashes, control characters,
null/bool/integer, arrays, nested objects, empty values, invalid numbers,
excessive depth, and input-shape failures.

Schema `1` vectors MUST separately pin raw-UTF-8 U+2028 and U+2029 to the
Python historical producer bytes. They MUST also preserve original number-token
lexemes for externally supplied legacy JSON and distinguish numerically equal
spellings such as `1E+2`, `1e2`, and `100`. Valid JSON is not automatically
producer-conforming canonical output. A runner unable to preserve a required
legacy number lexeme returns `unsupported_legacy_representation`; it must not
normalize and continue.

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

All new expected-result files use the draft portable result schema in
[`verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md).
For example:

```json
{
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
```

The result draft's issue-code registry is the only portable registry. In
particular, an unregistered event type in a supported closed schema maps to
`schema=invalid` plus `invalid_field`; `unsupported_event_type` is not a
portable alias. `outside_binding_interval` requires trustworthy evidence that
the artifact is outside the interval, while `binding_interval_indeterminate`
requires an applicable interval that cannot be evaluated because trustworthy
time is insufficient. `time_confidence=unavailable` is the sole no-usable-time
value. `specification_conflict` owns the specification dimension, returns
`indeterminate`, and stops affected verification. Language exceptions may
differ but MUST map to the registry meanings. Cryptographic facts, continuity,
completeness, semantics, trust, time basis, and policy remain separate;
warnings and fatal issues have the registry-defined summary consequences.

## Language-neutral vector format

Vectors are UTF-8 JSON data plus binary material encoded as base64 and hashes
as lowercase hex. The manifest identifies suite revision, protocol object,
schema version, capability level, input files, expected files, cryptographic
material, mutations, and results. No Python module/class name may be required
to interpret a vector.

The detailed proposed layout is
[`spec/test-vectors/README.md`](../../spec/test-vectors/README.md).
The schema-1 release MUST retain the existing fixture bytes and add manifests,
canonical-byte files, expected values, and declarative negative mutations
around them. It MUST NOT regenerate historical signatures with a replacement
key.

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

The smallest independent implementation is the offline C2 verifier specified
in
[`standalone-go-verifier-design.md`](standalone-go-verifier-design.md). Its
implementation is not authorized until a schema-1 candidate suite and the
portable result schema are frozen. Passing that independent verifier is an
exit gate for promoting the candidate vectors to a released baseline.

## Backward compatibility

Historical vector suites remain runnable. New runners MUST keep support for
claimed historical schemas. Old runners may report a new schema unsupported.
No golden update may cause valid Alpha.2 v1 journals to hash differently.
Conformance tightening that adds semantic diagnostics must preserve separate
cryptographic results and document whether historical overall status changes.
The current Go U+2028/U+2029 behavior is a known implementation defect to be
fixed only in a separate production task after normative vectors exist.

## Design-freeze gates

- Publishing the additive schema-1 vector suite MAY proceed only after
  independent Clock 2B GO on the corrected candidate delta.
- A standalone Go verifier MAY begin only after that suite and the result
  vocabulary are frozen.
- No Evidence v2 or ActionContract v2 producer may begin from prose alone;
  each requires its closed schema, exact canonical/signature vectors, and
  positive and negative semantic vectors.
