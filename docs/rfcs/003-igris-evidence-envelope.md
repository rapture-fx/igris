# RFC 003: Igris Evidence envelope

Status: **Draft**
Compatibility anchor: current Evidence event schema `1`
Critical rule: this RFC does not redefine existing signed bytes

## Evidence claims

**Current:** Evidence v1 records what the SDK observed around a callable: a
decision before an allowed execution and, when the SDK remains able to do so,
an outcome after the callable returns or raises. The event is integrity-bound
to a signing key and linked to the preceding event hash.

**Draft invariant:** Successful content verification establishes:

- the event bytes, as reconstructed by the schema's canonicalization rule,
  match `event_hash`;
- the signature verifies under the selected public key;
- the event's declared key identifier matches that key under v1 rules;
- provided events satisfy the checked chain linkage and schema semantics.

Trust in the key and completeness of the chain are separate conclusions.

## Explicit non-claims

Evidence v1 does **not** by itself prove:

- that the signer is a named person, organization, workload, or device;
- that the host, SDK, callable, clock, key, or approval provider was honest or
  uncompromised;
- that an external side effect occurred, occurred once, or matched intent;
- that the provided chain includes its true beginning or latest tail;
- that input/output summaries are complete or non-sensitive;
- that execution was contained, deterministic, authorized by an organization,
  or performed by Igris Managed runtime.

## Envelope fields

Evidence v1 is one JSON object per JSONL line. The signed **unsigned payload**
is the full event object except `event_hash` and `signature`.

Shared fields:

| Field | v1 type | Meaning |
| --- | --- | --- |
| `schema_version` | string | Exactly `"1"` for this schema |
| `event_type` | string | `decision` or `outcome` |
| `event_id` | string | Producer-generated event identifier |
| `action_id` | string | Python-origin code-location hint |
| `action_name` | string | Logical action name |
| `contract_hash` | 64-char lowercase hex string | ActionContract v1 hash |
| `timestamp_utc` | string | Producer-asserted UTC timestamp |
| `key_id` | string | Truncated Ed25519 public-key fingerprint reference |
| `previous_event_hash` | null or 64-char lowercase hex string | Previous event hash; null at local genesis |
| `event_hash` | 64-char lowercase hex string | Hash of canonical unsigned payload |
| `signature` | base64 string | Ed25519 signature over raw hash bytes |

Decision fields:

| Field | v1 type | Meaning |
| --- | --- | --- |
| `decision` | string | `allowed` or `denied` |
| `risk` | string | Contract-declared risk |
| `approval_mode` | string | Contract-declared approval mode |
| `redacted_input_summary` | string | Bounded producer summary |
| `input_hash` | 64-char lowercase hex string | Hash of redacted canonical input |
| `metadata` | canonical JSON value | Optional adapter-supplied, redacted metadata |

Outcome fields:

| Field | v1 type | Meaning |
| --- | --- | --- |
| `status` | string | `succeeded` or `failed` |
| `decision_event_id` | string | Authorizing decision event |
| `observed_result_type` | string or null | Producer-observed type |
| `redacted_output_hash` | string | Optional on success |
| `exception_type` | string | Present on emitted failure outcomes |
| `sanitized_error_summary` | string | Present on emitted failure outcomes |

Source authority is `sdk/python/src/igris/journal.py` and
`sdk/python/src/igris/guard.py::_append_event` /
`_record_outcome_or_raise`. The concrete fixture is
`testdata/igris-contract-v1/journal.jsonl`.

## Required and optional fields

The Python verifier requires every shared field, including
`previous_event_hash`, plus the decision or outcome minimums listed in
`sdk/python/src/igris/verification.py`. It does not require every conditional
outcome detail. The Go ingest verifier additionally validates indexed field
types, timestamps, decisions, statuses, and transitions in
`igris-overture/api/evidence_verify.go`.

**Draft invariant:** v1 validity uses the strictest documented common semantic
profile for new conformance vectors. Historical local verification results may
remain less strict; tightening a verifier MUST NOT be reported as a signature
failure when the cryptography is valid. Conditional field rules must be
vector-pinned before protocol approval.

## Event type registry

Schema `1` registers only `decision` and `outcome`. Under the portable result
vocabulary, any other `event_type` in a supported schema `1` object is
`schema=invalid` with issue `invalid_field` and summary `invalid`; there is no
separate `unsupported_event_type` alias. An unknown object schema remains
`unsupported_schema`. A verifier MUST NOT reinterpret an unregistered event
layout. Adding an event type whose fields participate in schema `1` signed
payloads risks verifier divergence and therefore requires either an explicit
compatible registry decision with vectors or, preferably, Evidence v2.

## Decision and outcome events

A denied decision is terminal and has no outcome. An allowed decision may be
followed by at most one outcome that references its `event_id`. Outcome status
describes the adapter's observation of a return or ordinary exception. It does
not assert an external transaction result. An allowed decision alone proves
permission was durably observed; it does not prove invocation began. Without an
Outcome or another future execution observation, execution occurrence and
result are unknown to the verifier.

The current Python verifier checks event structure and chain but not the
decision/outcome state transition. The current Go ingest verifier does check
unknown decision references, outcomes after denial, and duplicate outcomes.
This difference is **current behavior** and a conformance gap, not permission
to call the paths equivalent on semantic verification.

## Sequence and previous hash

Evidence v1 has no explicit sequence number. Order is the JSONL order and is
committed transitively by `previous_event_hash`. The first local event uses
JSON `null`. Connected segments carry the expected preceding hash out of band
and require the first event to match it.

Adding a signed sequence number or stream ID changes the unsigned payload and
requires Evidence v2. A transport may count events without presenting that
count as signed evidence.

**Design-freeze candidate for Evidence v2:** Every event signs an opaque random
256-bit `stream_id`, an integer `sequence`, an opaque random 256-bit
`action_instance_id`, and the previous object hash. Sequence begins at `0`,
increments by exactly one, and cannot wrap. Genesis alone has a null previous
hash. Event identity is `(stream_id, sequence)` plus object hash; no separate
minimum event UUID is required. An Outcome repeats the instance ID and
references the Decision's object hash. General trace/correlation/causation IDs
remain deferred.

## Canonical encoding

For schema `1`, canonical bytes are UTF-8 JSON with:

- object keys sorted lexicographically **by Unicode scalar value** —
  equivalently, by byte-wise comparison of the keys' UTF-8 encodings, since
  UTF-8 byte order equals scalar order. The comparison unit is the Unicode
  scalar, never the UTF-16 code unit: host languages whose default string
  comparison is UTF-16-code-unit based (for example JavaScript and Java)
  order supplementary-plane keys differently and MUST NOT use that default.
  The frozen vector `can1-valid-unicode-supplementary-keys-001` pins U+FFFF
  ordering before U+1F600, which is scalar order and contradicts UTF-16
  code-unit order;
- separators exactly `,` and `:` with no insignificant whitespace;
- non-ASCII characters emitted as UTF-8, not `\u` escapes;
- `<`, `>`, and `&` not HTML-escaped; `/` SOLIDUS not escaped (an input `\/`
  escape decodes to `/` and is re-emitted unescaped);
- within strings, exactly two printable ASCII characters escaped: `"` as
  `\"` and `\` as `\\`;
- control characters U+0000 through U+001F escaped, and only they: U+0008,
  U+0009, U+000A, U+000C, and U+000D use the short escapes `\b`, `\t`, `\n`,
  `\f`, and `\r`; every other scalar in that range uses a four-digit
  **lowercase**-hex `\u00xx` escape. U+007F DELETE is outside the range and
  is emitted raw. The frozen vector `can1-valid-control-characters-001` pins
  these exact bytes;
- no Unicode normalization at any point: decoded string content is emitted as
  the exact scalar sequence received, so NFC/NFD-equivalent spellings remain
  distinct canonical bytes;
- no trailing newline in the canonical value;
- finite JSON numbers only for values emitted by the Python canonicalizer.

For externally supplied schema `1` JSON text, the accepted string grammar and
its classification are normative:

- input MUST be valid UTF-8; anything else is `parse=malformed` with issue
  `invalid_utf8` (`can1-invalid-utf8-001`);
- a `\uXXXX` escape is accepted with either hex-digit case and, when it
  denotes a non-surrogate scalar, decodes to that scalar and is re-emitted
  under the output rules above (raw UTF-8 unless the scalar is `"`, `\`, or a
  U+0000–U+001F control);
- a high-surrogate escape immediately followed by a low-surrogate escape
  decodes to the single supplementary-plane scalar and is re-emitted as raw
  UTF-8;
- a lone surrogate escape is tolerated syntactically (`parse=valid`) but the
  containing value fails canonical reconstruction: `canonicalization=invalid`
  with issue `invalid_unicode_scalar` and dependent checks `not_evaluated`
  (`can1-invalid-surrogate-001`);
- a duplicate member name within one object is `parse=malformed` with issue
  `duplicate_member` (`can1-invalid-duplicate-member-001`);
- non-whitespace content after the single permitted top-level value is
  `parse=malformed` with issue `trailing_content`
  (`can1-invalid-trailing-content-001`);
- parse depth and size bounds are implementation-declared bounded-work
  limits, not signed-byte semantics; exceeding one is `parse=resource_limit`
  with summary `indeterminate`, never a signature failure.

These issue classifications reference the registry in
[`verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md)
and introduce no new codes. String serialization and numeric handling are
separate rules: the string rules above never alter a number token, and the
numeric-lexeme rules below never alter string bytes. This section documents
the frozen historical behavior already pinned by the cited vectors and by the
Python 0.1.0a2 producer baseline; it defines no new behavior.

Canonical evidence bytes are computed from the already constructed unsigned
payload. Python uses `canonical_json_bytes` in
`sdk/python/src/igris/canonical.py`; Go uses
`igris-overture/internal/canonicaljson/canonicaljson.go::Encode`. Exact bytes are in
`testdata/igris-contract-v1/canonical/` and checked by both Go conformance
suites.

Python 0.1.0a2-emitted bytes are the historical normative schema `1` producer
baseline. In particular, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR
are raw UTF-8, not `\u2028` or `\u2029`. Current production Go re-encoding
escapes those two scalars even with HTML escaping disabled. That behavior is a
known non-conforming implementation defect; it is not an alternate schema `1`
profile. Existing fixtures do not contain these scalars. The documentation-only
record is
[`schema-1-known-implementation-divergences.md`](schema-1-known-implementation-divergences.md).

For numbers emitted by the Python reference producer, its historical rendering
is authoritative. For arbitrary externally supplied schema `1` JSON, the
verification rule is preservation of each accepted original number token's
lexeme during canonical reconstruction. Thus `1E+2`, `1e2`, `100`, `-0`, `0`,
and `0.0` are distinct byte representations even where a host language assigns
equal numeric values. A verifier MUST NOT parse an untrusted number, silently
normalize it, and claim the normalized bytes were signed. If it cannot
preserve a required accepted lexeme, it returns
`unsupported_legacy_representation` with canonicalization `unsupported`,
summary `unsupported`, and dependent cryptographic checks `not_evaluated`.
Invalid JSON number forms fail during parsing.

Schema `1` retains this legacy profile permanently. Its release vectors MUST
pin historical integer/finite-float behavior, adversarial number lexemes,
raw-UTF-8 U+2028/U+2029, parsing, and unknown fields without changing existing
fixtures. A verifier implements the profile rather than delegating correctness
to a language-default JSON serializer.

Future signed schemas do not generalize the legacy encoder. They use
`igris-canonical-json-1`, fully defined in
[`protocol-resolved-decisions.md`](protocol-resolved-decisions.md#rd-02--canonical-data-profile-for-future-signed-objects): duplicate names rejected
before object construction; valid Unicode scalar values without normalization;
keys sorted by Unicode scalar sequence; fixed escaping; missing distinct from
null; and integers only in
`-9007199254740991..9007199254740991`. Floating-point and exponent values are
not future protocol numeric values.

## Hash calculation

1. Remove only `event_hash` and `signature` from the event.
2. Canonically encode the remaining object.
3. Compute SHA-256 over those bytes.
4. Encode the 32-byte digest as 64 lowercase hexadecimal characters in
   `event_hash`.

`previous_event_hash` is included. Unknown fields, when present, are included.

## Signature input

Decode the `event_hash` value to its raw 32-byte digest representation, or
equivalently recompute that digest from the canonical unsigned payload. The
signature is Ed25519 over those raw 32 bytes and is standard-base64 encoded.
A verifier MUST verify over the recomputed digest, not trust the submitted
`event_hash`.

There is no additional domain-separation string in Evidence v1. Adding one is
cryptographically attractive but incompatible and requires Evidence v2.

Future signed objects use the exact `IGRIS-SIGNATURE-FRAME` construction in
[`protocol-resolved-decisions.md`](protocol-resolved-decisions.md#rd-03--future-signature-framing-and-domain-separation).
The frame length-binds object domain, schema ID, signature-suite ID, and the
complete canonical unsigned payload before SHA-256 and Ed25519. Evidence uses
domain `igris.evidence-event`. This rule begins only at a new schema boundary.

## Algorithm identifiers

Evidence v1 implicitly fixes SHA-256, Ed25519, lowercase hex, and standard
base64. It has no independent hash or signature algorithm fields. The
`ed25519:` prefix in `key_id` is an identity encoding, not a general algorithm
negotiation framework.

The first future suite is `igris-ed25519-sha256-1`, which selects the canonical
profile, SHA-256 object/signature digests, Ed25519, padded standard base64, key
encoding, and frame. The signed suite identifier is selected before key or
signature interpretation. Unsupported suites return `unsupported_algorithm`;
verifiers MUST NOT substitute or downgrade. New suites require registry,
security, and vector review.

The proposed suite signs `SHA-256(frame)`, so the composition depends on
SHA-256 collision resistance and gives up pure Ed25519's direct-message
collision-resilience property. This RFC does not claim cryptographic approval.
Specialist review of that composition, domain separation, collision behavior,
and substitution resistance is mandatory before Evidence v2, ActionContract
attestations, or any other new signed schema using the suite is approved or
emitted.

## Key identifiers

`key_id = "ed25519:" + SHA-256(raw_ed25519_public_key).hex()[0:16]`.
Because this truncates the fingerprint, it is a lookup hint, not sufficient
collision-resistant identity for an unbounded global namespace. A verifier
SHOULD bind it to the full public key fingerprint in its trust context and
MUST reject ambiguity.

Changing the identifier or adding a full signed fingerprint requires
Evidence v2. A trust store may record the full fingerprint without changing
events.

Future objects use the full reference
`ed25519-sha256:<64 lowercase hex characters>` derived from the raw 32-byte
public key. It remains a key reference, not a human/organization identity.

## Timestamp claims

`timestamp_utc` is generated by the producer's wall clock. The Go verifier
checks RFC 3339 parsing and normalizes for storage. Neither path proves clock
accuracy or monotonicity. A server receipt time or transparency-log inclusion
time is a separate observation and MUST NOT overwrite the signed timestamp.

Trusted-time evidence, clock-source identifiers, or monotonic counters require
new signed fields and therefore Evidence v2.

## Contract references

`contract_hash` links an event to an ActionContract v1 body by hash. A
cryptographically valid event does not prove the verifier possesses that body
or that the body was authorized. Verification SHOULD report contract
resolution separately from signature validity. Embedding a contract or
versioned reference object requires a future schema decision.

Evidence v2 MUST carry a schema-qualified contract reference containing the
contract schema ID and semantic contract hash. The exact field representation
and vectors remain an implementation blocker.

## Unknown field behavior

Current Python verification accepts additional fields and includes them when
recomputing the hash. Go ingestion does the same except it rejects
caller-controlled `tenant_id` and `execution_provenance` on security grounds.
This means cryptographic acceptance does not imply semantic understanding.

**Draft invariant:**

- A v1 verifier MUST include every field except `event_hash` and `signature`
  in hash recomputation.
- It MUST NOT infer semantics from an unknown field.
- It SHOULD report `unknown_fields_present` as a non-cryptographic diagnostic.
- Security-boundary fields such as tenant and managed provenance MUST remain
  transport/server-assigned, not client-asserted v1 extensions.
- A required semantic extension uses a new schema.

Future signed schemas are closed. A known future schema with an undeclared
field has schema status `invalid` and issue `unknown_field`; generic
cryptographic dimensions may still be reported when safely computable, but the
field is never treated as understood. The first v2 schemas have no generic
extension container. Adding a signed field requires a new schema ID.

## Size and privacy limits

Current producer summaries are bounded to 2,000 characters and individual
summary values to 120 characters; sanitized error text is bounded to 300
characters (`sdk/python/src/igris/redaction.py`). Connected ingestion limits
the body to 1 MiB, a batch to 500 events, an event to 64 KiB, a public-key PEM
to 4 KiB, and depth to 64 (`igris-overture/api/routes_evidence.go`). The client
targets batches below 900 KiB.

These are product/transport limits, not part of existing signed bytes.
Conformance vectors MUST remain small. Implementations SHOULD bound parse
depth, event size, issue count, and total work before expensive verification.

Redaction is not anonymity. Names, types, hashes, timestamps, metadata, and
sanitized summaries may disclose information. Hashes of low-entropy data may
be guessable. Private keys and raw credentials MUST NOT appear in evidence or
test vectors.

## Error and exception sanitization

Current failed outcomes record an exception type and a bounded summary after
replacing known sensitive input strings. This is best-effort: undeclared
business-sensitive values can remain. Sanitization MUST occur before signing
and persistence. A verifier proves the stored summary was signed; it cannot
prove sanitization was adequate.

## Chain verification

A chain verifier MUST, in order:

1. parse with resource bounds;
2. dispatch the supported schema;
3. validate required shape and types;
4. recompute canonical bytes and hash;
5. resolve the public key and verify signature;
6. compare each `previous_event_hash` with the preceding submitted hash or
   trusted segment anchor;
7. validate known lifecycle transitions;
8. report trust and completeness separately.

Using the stored hash to advance after a bad event may reduce cascading error
noise, but the chain result remains invalid.

## Partial chains

A segment whose first previous hash is non-null may be internally valid but is
partial until its anchor is supplied or trusted. A null-genesis segment may
still be tail-truncated. Verifiers MUST distinguish `chain_valid` from
`chain_complete`. Evidence v1 alone cannot prove complete history.

Candidate result vocabulary is `valid_genesis`, `valid_anchored`,
`valid_unanchored`, or `discontinuous` for continuity and
`complete_to_checkpoint`, `incomplete`, or `completeness_unknown` for
completeness. A checkpoint is an optional separately signed object using domain
`igris.chain-checkpoint`, not an Evidence event or mandatory service. It proves
only observation of one head under its stated witness/time confidence.

## Schema evolution

Evidence v2 is required for any of the following:

- action instance, stream, or sequence identifiers;
- explicit algorithm identifiers or signature domain separation;
- a full signed key fingerprint or richer signer reference;
- trusted-time, environment-attestation, or provider-identity references;
- cancellation, expiration, preparation, or evidence-repair event types;
- changed canonical number rules or changed required/unknown-field semantics;
- any change to the existing field meanings or signature input.

New SDK-only errors, trust-store policies, transport limits, privacy
inspection, and adapter APIs do not change the evidence schema.

General correlation/causation, execution-start, cancellation, expiry, repair,
trusted-time, and attestation fields are deliberately deferred beyond minimum
Evidence v2. Their presence in this list does not authorize them.

## Historical verification

Verifiers MUST keep immutable schema `1` canonical/signature dispatch and
released golden vectors permanently. No future canonical, domain, schema,
signer, stream, sequence, or lifecycle rule is backported. Revocation or later
distrust changes trust, not the mathematical fact that an old signature
verified. A stronger semantic/ingest policy may reject a cryptographically
valid schema `1` artifact but MUST report those dimensions separately.

Historical reports include evaluation time, policy version, key status
interval and time confidence when known, artifact availability, and
completeness limitations. Schema `1` signatures remain self-asserted relative
to a key unless an external trust binding says more.
