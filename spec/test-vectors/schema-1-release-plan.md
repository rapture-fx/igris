# Igris schema `1` conformance-vector release plan

Status: **Implementation plan; blocked pending independent Clock 2B GO**

Scope: additive conformance artifacts for the permanent ActionContract schema
`1` and Evidence schema `1` compatibility profile. This plan does not alter or
regenerate current production/reference fixtures and creates no v2 artifact.
Known current implementation gaps are recorded in
[`schema-1-known-implementation-divergences.md`](../../docs/rfcs/schema-1-known-implementation-divergences.md).

## Authorization boundary

Only after an independent Clock 2B GO on the corrected design-freeze delta may
implementation of this schema `1` vector suite begin as a documentation/
test-fixture task. It must not change SDK/backend code, current fixture bytes, schema `1`
cryptographic interpretation, default emission, or package artifacts. Any
new safe-parser or semantic-policy rejection remains a separate result
dimension and is not retroactively labeled a signature failure.

The standalone Go verifier remains blocked until this suite candidate and the
`igris:protocol:verification-result:1` schema/expected outputs are frozen. Its
independent result is required before release promotion.

## Release layout

```text
spec/test-vectors/suite-schema-1/
  manifest.json
  RELEASE.md
  keys/
    alpha2-historical.public.pem
    deterministic-001.public.raw.b64
    deterministic-001.private.seed.TEST-ONLY.b64
    deterministic-001.metadata.json
  canonical/legacy-json-1/
    <vector-id>.input.json
    <vector-id>.canonical.b64
    <vector-id>.expected.json
  contracts/action-contract-1/
    <vector-id>.input.json
    <vector-id>.canonical.b64
    <vector-id>.expected.json
  evidence/evidence-1/
    <vector-id>.input.json
    <vector-id>.canonical.b64
    <vector-id>.expected.json
  chains/evidence-1/
    <vector-id>.input.json
    <vector-id>.expected.json
  mutations/
    <vector-id>.mutation.json
  trust/
    <vector-id>.input.json
    <vector-id>.expected.json
```

Every expected result uses
`igris:protocol:verification-result:1`. Canonical bytes are base64 and are
authoritative; readable UTF-8 is optional review metadata.

## Manifest requirements

`manifest.json` contains:

- manifest format/version;
- immutable suite ID `igris-schema-1-conformance`;
- semantic suite revision;
- source baseline commit;
- object schema/profile;
- vector ID and family;
- input, canonical-byte, expected-result, key, and mutation paths;
- required conformance capability;
- historical versus deterministic provenance;
- expected primary and allowed secondary issues; and
- SHA-256 for every referenced file.

Paths are relative, `/`-separated, contain no `..`, and remain inside the
suite. IDs never change meaning. Released files are immutable.

## Existing-fixture mapping

| Current artifact | Release vector | Treatment |
| --- | --- | --- |
| `testdata/igris-contract-v1/action_contract.json` | `ac1-valid-alpha2-basic-001` | Copy bytes as historical input; recompute expected hash without altering source |
| `action_contract_specialchars.json` | `ac1-valid-alpha2-specialchars-001` | Historical special-character contract and canonical ordering case |
| `journal.jsonl` | `ev1-valid-alpha2-journal-001` | Preserve all lines byte-for-byte as historical chain input |
| `canonical/decision_approved.canonical.json` | `can1-valid-alpha2-decision-001` | Copy content without interpreting the fixture file's storage newline as canonical data |
| `canonical/outcome_succeeded.canonical.json` | `can1-valid-alpha2-outcome-001` | Same treatment |
| `verify_key.pem` | `alpha2-historical.public.pem` | Public historical verification key only |
| `expected.json` | Historical expected metadata | Translate into decomposed result fields and retain original as provenance |
| `generate_fixtures.py` | Generator provenance only | Do not run to overwrite historical files; mine field coverage |
| `generate_specialchars_contract.py` | Generator provenance only | Do not overwrite historical files |
| `conformance/contractv1/canonical_conformance_test.go` | Go runner seed | Existing test remains unchanged; future runner independently consumes manifest |
| `sdk/python/tests/test_verification.py` | Negative-case source | Translate mutations; do not import Python test code at runtime |
| `igris-overture/api/routes_evidence_test.go` | Transition/ingest-policy source | Separate core semantic vectors from Connected transport-policy vectors |

## Canonical byte files

For every positive canonical, contract, and event vector, commit:

- structured input JSON;
- exact canonical bytes as RFC 4648 padded base64;
- optional readable UTF-8 rendering;
- SHA-256 of exact canonical bytes;
- whether the bytes are historical or deterministic-new; and
- the schema `1` rule exercised.

Negative canonical inputs omit canonical bytes and expect a parse or
canonicalization result. Expected files never ask the runner to reconstruct
the expected bytes from readable JSON.

## Required vector families

### Legacy canonical JSON profile

Positive vectors:

- empty object/array, null, booleans, zero, negative integer, safe and large
  historical integer values;
- finite floating-point spellings actually produced by the Python schema `1`
  encoder, including `1.0`, `-0.0`, exponent boundaries, and round-trip edge
  values;
- sorted ASCII keys, prefix keys, Unicode BMP and supplementary-plane keys;
- raw Unicode, `<`, `>`, `&`, solidus, quote, reverse solidus, controls,
  raw-UTF-8 `U+2028`, and raw-UTF-8 `U+2029`, each pinned to the Python
  historical producer bytes;
- nested arrays/objects and optional metadata values; and
- unknown fields included in the unsigned-payload hash.

Negative/policy vectors:

- NaN/infinity input to a producer;
- invalid UTF-8, invalid surrogate escape, trailing JSON content;
- duplicate member names, reported as malformed by the safe parser profile;
- excessive depth/size reported as `resource_limit`; and
- non-object event/contract top levels.

Legacy numeric vectors document the frozen schema `1` rule; they do not apply
`igris-canonical-json-1` to schema `1`. Python-emitted artifacts use the
historical Python rendering. For arbitrary externally supplied valid JSON, the
canonical reconstruction preserves each original number token lexeme. A
runner must compare exact lexemes rather than parsed numeric equality.

Required lexical families include:

- `1E+2`, `1e2`, and `100` as distinct signed byte representations;
- `-0`, `0`, and `0.0` as distinct representations when accepted by the
  legacy JSON grammar;
- finite spellings emitted by the Python reference producer, including
  normalization boundaries;
- large integers near and beyond common host-language limits without rounding;
- other valid JSON spellings that Python and Go would otherwise re-render
  differently; and
- invalid forms such as leading-plus, leading-zero, incomplete decimal,
  NaN/infinity, or malformed exponent spellings, rejected during parsing.

If a runner cannot preserve an accepted token needed for exact reconstruction,
the expected result is `canonicalization=unsupported`, issue
`unsupported_legacy_representation`, summary `unsupported`, and dependent
checks `not_evaluated`. It must not silently normalize the token.

### ActionContract schema `1`

Positive vectors:

- both current contracts;
- all risk and approval values;
- nullable `code_fingerprint`;
- parameter ordering and every Python parameter-kind string currently emitted;
- Unicode/special-character names and annotations; and
- exact body-without-`contract_hash`, canonical bytes, and expected hash.

Negative vectors:

- unknown schema;
- missing/extra/wrong-type fields;
- invalid Action name, risk, approval, execution mode, descriptor, and
  fingerprint;
- tampered body with unchanged hash;
- valid body with malformed hash; and
- duplicate member input.

Expected results separate schema validity from hash validity. Python-origin
fields are documented as legacy, not language-neutral requirements.

### Evidence event schema `1`

Positive vectors:

- allowed decision;
- denied decision;
- succeeded Outcome;
- failed Outcome with sanitized summary;
- optional metadata and optional success output hash;
- Unicode/special characters;
- U+2028 and U+2029 in applicable signed string fields, with raw UTF-8
  canonical bytes;
- correct unknown-field cryptographic inclusion with semantic warning; and
- exact unsigned payload, canonical bytes, digest, event hash, signature, and
  key ID.

Negative vectors:

- malformed/non-object event;
- unsupported schema, plus an unregistered event type mapped to
  `schema=invalid` and `invalid_field`;
- missing/wrong-type field;
- invalid timestamp/decision/status;
- tampered payload with original hash/signature;
- recomputed hash with original signature;
- tampered signature, malformed base64, wrong signature length;
- signature over canonical bytes instead of raw digest;
- wrong public key, unknown key ID, and truncated-ID ambiguity; and
- prohibited Connected-only tenant/provenance assertion as an ingest-policy
  vector, not a core cryptographic vector.

### Evidence chain schema `1`

Positive vectors:

- null genesis and two-or-more event chain;
- allowed decision followed by one succeeded Outcome;
- allowed decision followed by one failed Outcome;
- denied decision with no Outcome;
- multiple independent invocations in one journal;
- partial segment with a supplied trusted preceding hash; and
- tail-truncated locally valid chain with completeness unknown.

Negative vectors:

- wrong genesis;
- broken previous hash;
- middle deletion, insertion, reorder, duplicate, and fork;
- orphan Outcome;
- Outcome after denial;
- duplicate Outcome for one decision; and
- expected checkpoint/manifest head not reached (`incomplete`).

### Trust overlays

The same cryptographically valid event is evaluated with:

- supplied self-asserted key (`trust=unknown`);
- trusted pin;
- unknown key;
- ambiguous truncated key ID;
- explicitly untrusted key;
- active organization binding;
- revoked key;
- evidence inside/outside a defensible binding interval;
- an applicable binding interval that is indeterminate because trustworthy
  time is unavailable; and
- stale or absent revocation snapshot.

Trust overlays never change canonical bytes or mathematical signature results.

## Minimum named vectors

The first release must include at least these IDs:

| ID | Primary expectation |
| --- | --- |
| `ac1-valid-alpha2-basic-001` | Exact current contract hash |
| `ac1-invalid-tampered-body-001` | `hash_mismatch` |
| `ev1-valid-alpha2-journal-001` | Valid signatures/continuity, trust unknown, completeness unknown |
| `ev1-invalid-tampered-payload-001` | `hash_mismatch`, `invalid_signature` |
| `ev1-invalid-tampered-signature-001` | `invalid_signature` |
| `ev1-invalid-broken-previous-hash-001` | `chain_discontinuity` |
| `ev1-unsupported-schema-001` | `unsupported_schema`; signature not evaluated |
| `ev1-malformed-object-001` | `malformed` |
| `ev1-indeterminate-unknown-key-001` | `unknown_key`; signature not evaluated |
| `ev1-valid-revoked-key-001` | Signature valid; trust revoked; `valid_but_untrusted` |
| `ev1-valid-tail-unwitnessed-001` | Continuity valid; completeness unknown |
| `ev1-invalid-outcome-after-denial-001` | Crypto may be valid; semantics invalid |
| `can1-valid-u2028-raw-001` | Python-baseline raw UTF-8 U+2028 canonical bytes |
| `can1-valid-u2029-raw-001` | Python-baseline raw UTF-8 U+2029 canonical bytes |
| `can1-valid-number-1Eplus2-001` | Exact `1E+2` lexeme retained |
| `can1-valid-number-1e2-001` | Exact `1e2` lexeme retained and distinct from `1E+2` |
| `can1-unsupported-number-lexeme-lost-001` | `unsupported_legacy_representation`; dependent checks not evaluated |

## Mutation format

Mutations name a base vector and one declarative operation: `add`, `remove`,
`replace`, `reorder`, `truncate`, or `raw_bytes_replace`. They record whether
the attacker also recomputes the submitted hash. The runner must not
automatically resign a mutation.

## Fixture-key policy

- Current historical private material is not reconstructed or committed.
- New deterministic signatures may use one fixed 32-byte Ed25519 seed only in
  `*.TEST-ONLY.*` under the vector suite.
- Adjacent metadata contains `purpose: conformance-test-only`, public
  fingerprint, creation method, and a prohibition on production use.
- No production package, example, service, default, or test outside the vector
  runner may load the seed.
- Generation uses an isolated temporary home and no network.
- Secret scanning must allow the one explicit fixture without disguising it.
- CI scans production artifacts and references to ensure the fixture key cannot
  ship or be selected by configuration.

## Expected-result rules

Every vector has a complete
`igris:protocol:verification-result:1` expected object. Primary failure and
permitted secondary issues are explicit. Required examples include:

- `specification=consistent` for ordinary vectors and a separate
  `specification_conflict` governance/result case;
- cryptographically valid but trust unknown;
- cryptographically valid but untrusted/revoked;
- cryptographically valid but semantic policy rejected;
- unsupported schema/algorithm with signature `not_evaluated`;
- unknown key with signature `not_evaluated`;
- local continuity valid but completeness unknown; and
- malformed input where all later phases are `not_evaluated`.

## Deterministic generation and review

Generators pin key, IDs, timestamps, all structured values, runtime/tool
version, and output ordering. They write only to a temporary directory. CI
compares every byte and hash with the frozen candidate or released suite and
fails on drift.

Release requires:

1. decoded structured diff and raw byte/hash/signature diff;
2. protocol-owner approval;
3. security-owner approval for crypto/trust/negative cases;
4. a frozen candidate checked by maintained Python and existing Go paths, with
   the known Go U+2028/U+2029 non-conformance reported as a blocking production
   divergence rather than normalized away;
5. a successful standalone independent Go verifier result over the unchanged
   candidate;
6. clean regeneration; and
7. manifest/file hashes recorded in `RELEASE.md`.

Candidate freeze and release promotion are separate gates. The frozen
candidate is the input to the independent verifier; only after that verifier
passes may the unchanged suite be labeled released. A candidate-byte change
invalidates the independent result and returns the suite to candidate review.

## Breaking changes

Changing canonical bytes, hash/signature, fixture key, field meaning,
acceptance, summary, required issue, vector ID meaning, or expected result is a
breaking vector change. A released suite is immutable. Corrections add a new
suite revision and superseding vector with rationale; they never edit history.

## Completion criteria

The release plan is complete when an independent engineer can download the
suite, implement only the documented legacy algorithms, and reproduce every
byte/result without importing Python or contacting Connected. Publication of
the plan alone does not satisfy that criterion; the actual vectors and two
runner implementations, including the standalone independent Go verifier,
must exist.
