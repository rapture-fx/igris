# Igris protocol resolved decisions

Status: **First design-freeze candidate; requires human ratification**

Decision basis: senior review at `8523c597f24599a7d1afb7f8f2420342d3b47c0e`.

Scope: protocol architecture and specification only. These decisions do not
authorize Evidence v2, ActionContract v2, a producer SDK, backend changes, or
deployment.

## Decision classification

| Decision | Classification | Affects | Resolution state |
| --- | --- | --- | --- |
| OD-01 Normative precedence and naming | `schema_semantic_irreversible` | all protocol interpretation and governance | Resolved in candidate |
| OD-02 Canonical data model | `signed_byte_irreversible` | all future canonical bytes, hashes, signatures | Resolved in candidate |
| OD-03 Signature suite and framing | `signed_byte_irreversible` | all future signed objects | Resolved in candidate |
| OD-04 Schema closure and extensions | `schema_semantic_irreversible` | parsing, versioning, signed fields | Resolved in candidate |
| OD-05 Action identity and namespace | `schema_semantic_irreversible`, `trust_policy` | Action identity and attribution | Resolved in candidate |
| OD-06 Contract hash and implementation binding | `signed_byte_irreversible`, `schema_semantic_irreversible` | ActionContract v2 identity | Resolved in candidate |
| OD-07 Evidence identifiers and chain | `signed_byte_irreversible`, `schema_semantic_irreversible` | Evidence v2 identity and continuity | Resolved in candidate |
| OD-08 Core lifecycle | `schema_semantic_irreversible` | event legality and execution conclusions | Resolved in candidate |
| OD-09 Verification-result model | `verifier_policy`, `schema_semantic_irreversible` | portable verifier output | Resolved in candidate |
| OD-10 Trust bundle and revocation | `trust_policy` | attribution and historical trust | Resolved semantically; wire format deferred |
| OD-11 Historical schema `1` profile | `verifier_policy` | permanent legacy compatibility | Resolved in candidate |
| OD-12 Checkpoints and completeness | `safe_to_defer`, `verifier_policy` | optional completeness claims | Resolved: optional external object |

No decision in the register is `implementation_only`. Provider class shapes,
file layout, SDK method names, storage topology, and transport limits remain
implementation-only consequences and do not enter the protocol contract.

## Dependency graph

```text
OD-01 precedence and naming
  |
  +--> OD-02 canonical data model
  |      |
  |      +--> OD-03 signature framing
  |      +--> OD-04 schema closure/versioning
  |              |
  |              +--> OD-05 Action namespace
  |              |      `--> OD-06 semantic contract hash
  |              |
  |              +--> OD-07 Evidence identity/chain
  |              |      `--> OD-08 lifecycle
  |              |
  |              +--> OD-10 trust semantics
  |              +--> OD-12 checkpoint semantics
  |
  +--> OD-11 historical schema-1 profile
  |
  `--> OD-09 verification-result schema
         depends on OD-02, OD-04, OD-08, OD-10, OD-11, and OD-12
```

Resolution order is OD-01, OD-02, OD-04, OD-03, OD-05, OD-06, OD-07,
OD-08, OD-12, OD-10, OD-11, then OD-09. Schema-1 vector publication depends
on OD-09 and OD-11. A standalone verifier depends on a frozen candidate vector
suite and result schema; its successful run is required to promote that suite
to a released conformance baseline.

### Normative dependency trace

This table records the RFC statements that must remain consistent with each
decision. Section titles, rather than only document titles, are named so later
edits can be reviewed against the dependency.

| Decision | Dependent RFC statements |
| --- | --- |
| OD-01 | RFC 000 “Reference implementation model,” “Normative artifact precedence,” “Governance model,” and “Compatibility philosophy”; RFC 001 “Normative terminology” and “Protocol versioning”; RFC 007 “Golden-file governance” and “Contribution process” |
| OD-02 | RFC 003 “Canonical encoding,” “Hash calculation,” “Unknown field behavior,” and “Size and privacy limits”; RFC 007 “Canonicalization vectors”; RFC 008 “Canonicalization obligations” and TypeScript/Go considerations |
| OD-03 | RFC 003 “Signature input,” “Algorithm identifiers,” “Key identifiers,” and “Schema evolution”; RFC 004 “Key fingerprint” and future trust artifacts; RFC 007 signature vectors; RFC 008 verification/version obligations |
| OD-04 | RFC 001 “Protocol versioning” and “Capability negotiation”; RFC 002 v2 descriptor/contract statements; RFC 003 “Event type registry,” “Unknown field behavior,” and “Schema evolution”; RFC 007 unknown-version vectors; RFC 008 version mapping |
| OD-05 | RFC 002 “Action identity,” “Intent,” “Immutability expectations,” and “Nested actions”; RFC 004 organization binding; RFC 006 contract registry; RFC 008 Python reference limitations |
| OD-06 | RFC 001 “ActionContract”; RFC 002 risk, approval, input, redaction, execution, evidence, and immutability sections; RFC 003 “Contract references”; RFC 006 “Contract registry” |
| OD-07 | RFC 001 “Action instance,” “Evidence chain,” and “Correlation and causation”; RFC 002 “Action instance identity” and “Nested actions”; RFC 003 “Sequence and previous hash” and “Partial chains”; RFC 005 “Idempotency”; RFC 006 “Identifier provider”; RFC 007 hash-chain vectors |
| OD-08 | RFC 001 Decision/Outcome semantics; RFC 002 “Evidence requirements”; RFC 003 “Decision and outcome events” and transition checks; all lifecycle transitions/failure boundaries in RFC 005; RFC 006 provider failure semantics; RFC 007 valid/invalid lifecycle vectors |
| OD-09 | RFC 001 “Verification result”; RFC 003 chain, partial-chain, and historical reporting; RFC 004 verifier trust/revocation reporting; RFC 005 evidence-incomplete reporting; RFC 007 expected results/runner; RFC 008 verification/error obligations |
| OD-10 | RFC 001 signing-identity claims; RFC 003 key/timestamp/historical rules; RFC 004 trust, rotation, revocation, offline, and cross-organization sections; RFC 007 key-trust vectors; RFC 008 key/verification obligations |
| OD-11 | RFC 000 compatibility and feature freeze; every **Current** schema-1 description in RFCs 001–008; RFC 003 canonical/signature/historical sections; RFC 007 backward compatibility and golden governance; RFC 008 version mapping |
| OD-12 | RFC 001 “Evidence chain”; RFC 003 “Partial chains”; RFC 004 compromise-time, offline, and transparency-log sections; RFC 005 crash boundaries; RFC 007 hash-chain vectors; RFC 008 verification obligations |

## RD-01 — Normative protocol contract and precedence

### Decision

An Igris protocol release is defined by a **release manifest** that records the
immutable identifiers and content hashes of its normative artifacts. The
manifest is the root of version selection; it does not silently import the
state of a branch, package, service, or website.

The referenced artifacts have these responsibilities:

1. **Ratified normative RFC requirements** define object meaning, claims,
   required behavior, and compatibility rules.
2. **Referenced canonicalization specifications and registries** define exact
   bytes and registered identifiers within the scope delegated by an RFC.
3. **Machine-readable schemas** define syntactic shape and constraints that
   can be expressed mechanically.
4. **Released conformance vectors** define exact inputs, bytes, and results for
   the cases they enumerate. They test the general rules; they do not create
   unstated general semantics.
5. **Reference implementations and product behavior are non-normative.**

All normative artifacts must agree. This ordering is a responsibility and
interpretation hierarchy, not permission for one artifact to contradict
another. A conflict is a specification defect:

- constructors fail closed rather than choose an interpretation;
- verifiers report `specification_conflict` when the conflict affects the
  artifact under review, set the specification dimension to `conflict`, stop
  affected artifact interpretation, and return summary `indeterminate`;
- the protocol owner issues an erratum or a new release manifest;
- an erratum may clarify meaning but may not change already released canonical
  bytes, hashes, signatures, vector outcomes, or historical schema semantics;
- a semantic or byte change requires a new schema or protocol release; and
- implementation behavior never becomes normative through deployment volume,
  age, or documentation drift.

For the frozen schema `1` compatibility profile, released historical vectors
remain authoritative for their exact bytes even if later prose is corrected.

### Naming

ActionContract schema `1` and Evidence schema `1` are the **Igris schema `1`
compatibility profile**, not a declaration that the unresolved logical model
is a ratified “Protocol v1.” Future protocol releases and object schemas have
independent identifiers.

### Rejected alternatives

- Source code as the specification.
- Vectors silently overriding prose outside the enumerated case.
- “Most permissive interpretation wins.”
- Retroactively editing released vectors or schema `1` semantics.

## RD-02 — Canonical data profile for future signed objects

### Profile identifier

Future JSON-based signed objects use `igris-canonical-json-1`. Schema `1`
continues using its frozen legacy canonicalization and does not adopt this
profile.

### Accepted data model

The canonicalizer accepts exactly these values:

- `null` where the object schema explicitly declares the field nullable;
- booleans;
- Unicode strings;
- integers in the inclusive range
  `-9007199254740991..9007199254740991`;
- arrays whose order is preserved; and
- objects with unique string member names.

Floating-point values, decimal fractions, exponent forms, NaN, infinity,
binary values, dates, maps with non-string keys, and host-language objects are
not canonical values. Domain decimals, large integers, timestamps, and binary
material must use schema-defined strings or encodings.

### Input parsing

- Input must be valid UTF-8 and must not begin with a BOM.
- A parser accepts one JSON value plus optional surrounding JSON whitespace
  (`U+0020`, `U+0009`, `U+000A`, `U+000D`) and rejects trailing content.
- The schema determines the required top-level type; signed protocol objects
  are objects.
- Duplicate member names are rejected before map/object construction. Names
  are duplicates when their decoded Unicode scalar sequences are identical.
- No Unicode normalization is performed before duplicate comparison, sorting,
  hashing, signing, or identity comparison.
- Implementations must support at least 64 nested containers. Schema or
  verifier profiles may impose explicit size/work limits and report
  `resource_limit`; such limits do not alter canonical bytes of accepted data.

### Unicode

Strings contain Unicode scalar values only: `U+0000..U+D7FF` and
`U+E000..U+10FFFF`. Invalid UTF-8, isolated surrogate code points, and invalid
surrogate escape pairs are rejected. Valid surrogate escape pairs in input are
decoded to their scalar value. Canonical output preserves the exact scalar
sequence and applies no NFC, NFD, case, width, or compatibility normalization.

### Object ordering

Member names are compared as sequences of Unicode scalar values. At the first
difference, the lower scalar value sorts first; if one sequence is a prefix,
the shorter sorts first. For valid scalar values this is also UTF-8 byte
lexicographic order. TypeScript implementations must not rely on default
UTF-16 code-unit sorting.

### Integer rendering

Integers use the shortest base-10 representation with no leading plus sign,
no leading zero, and no exponent. Zero is `0`; a parsed negative zero is
canonicalized as `0`. Values outside the safe range are rejected rather than
rounded or stringified implicitly.

### String escaping

- `"` and `\\` encode quotation mark and reverse solidus.
- Backspace, tab, line feed, form feed, and carriage return use
  `\b`, `\t`, `\n`, `\f`, and `\r`.
- Other controls `U+0000..U+001F` use lowercase `\u00xx`.
- Solidus `/` is not escaped.
- All other scalar values, including non-ASCII, `U+2028`, `U+2029`, `<`, `>`,
  and `&`, are emitted as raw UTF-8.

### Structural rendering

Objects and arrays use `,` and `:` with no insignificant whitespace. The
canonical value has no BOM, prefix, suffix, or trailing newline. Missing and
`null` are distinct. An optional field may be absent only when the schema says
it is optional; absence does not imply a null value.

### Security consequence

Rejecting duplicate keys, invalid scalars, unbounded numeric interpretation,
and implicit normalization prevents language-specific parser and signature
differentials. The safe-integer bound is intentionally narrower than Python or
Go capability so TypeScript can implement the profile without loss.

## RD-03 — Future signature framing and domain separation

### Registered identifiers

The initial future suite identifier is `igris-ed25519-sha256-1`. It fixes:

- canonical profile: `igris-canonical-json-1`;
- object hash: SHA-256 over the canonical unsigned payload;
- signature digest: SHA-256 over the framed signature input;
- signature: Ed25519 over the 32-byte signature digest;
- signature encoding: RFC 4648 standard base64 with padding; and
- object-hash encoding: `sha256:<64 lowercase hex characters>`; and
- public-key fingerprint: lowercase SHA-256 hex over the raw 32-byte Ed25519
  public key, represented as `ed25519-sha256:<64 hex>`.

Algorithm names are protocol registry identifiers, not library names.

### Unsigned payload

For every framed signed object, the canonical unsigned payload is the complete
object excluding only `object_hash` and `signature`. It includes `schema_id`,
`signature_suite`, the full signer reference, and every other schema-declared
field. The payload's `signature_suite` must equal the suite selected by the
frame. `object_hash` is `sha256:` plus the digest hex below.

ActionContract v2 is a content-addressed semantic descriptor, not inherently a
key-owned object: its `contract_hash` is computed under RD-06 and it has no
signer field. When publisher attribution is required, a separate signed
ActionContract-attestation object references the schema-qualified
`contract_hash` and uses this frame. Key rotation therefore does not change the
semantic contract hash.

### Exact conceptual frame

```text
MAGIC = UTF8("IGRIS-SIGNATURE-FRAME") || 0x00
FRAME_VERSION = uint16_be(1)
LP(x) = uint64_be(length_in_bytes(x)) || x

frame = MAGIC
     || FRAME_VERSION
     || LP(UTF8(object_domain))
     || LP(UTF8(schema_id))
     || LP(UTF8(signature_suite))
     || LP(canonical_unsigned_payload)

object_hash = "sha256:" || lowercase_hex(SHA-256(canonical_unsigned_payload))
signature_digest = SHA-256(frame)
signature = base64(Ed25519.Sign(private_key, signature_digest))
```

All length values are unsigned big-endian byte lengths. Domain, schema, and
suite identifiers are ASCII and at most 128 bytes. Length framing is mandatory
even though the initial identifiers have restricted syntax.

### Object domains

| Signed object | Domain |
| --- | --- |
| ActionContract attestation | `igris.action-contract` |
| Evidence event | `igris.evidence-event` |
| Trust binding/revocation artifact | `igris.trust-artifact` |
| Chain checkpoint | `igris.chain-checkpoint` |

A new signed object type requires a new registered domain. Domains are not
reused across object types or schema families.

The fixed magic binds the protocol family; the frame version binds framing
semantics; `schema_id` includes the object schema major version. Product or
package versions do not enter the signature context.

### Algorithm evolution

There is no algorithm negotiation or substitution while verifying an object.
The signed suite identifier selects one complete construction. An unsupported
suite returns `unsupported_algorithm`; a verifier must not try another suite.
A new suite requires registry review, threat analysis, and vectors. A change to
canonical field meaning or signed field set also requires a new object schema.

### Legacy boundary

Evidence schema `1` remains Ed25519 over the raw SHA-256 digest of its legacy
canonical unsigned payload, with no domain frame. ActionContract schema `1`
retains its legacy hash. No future framing rule is backported.

## RD-04 — Schema identifiers, closure, and evolution

### Schema identifiers

Future object schemas use ASCII identifiers:

```text
igris:protocol:<object-name>:<major>
```

`object-name` matches `[a-z][a-z0-9-]{0,63}`. `major` is an unsigned decimal
integer without leading zero and begins at `1`. The complete identifier is at
most 128 bytes. Examples include `igris:protocol:evidence-event:2` and
`igris:protocol:verification-result:1`.

The schema ID is a stable identifier, not a network location. It is present in
the signed payload and signature frame. There is no separate product protocol
version in an object.

### Closed schemas

Signed protocol objects are closed by default. A known schema accepts exactly
its declared required and optional fields. An unknown field under a known
schema produces schema status `invalid` and issue `unknown_field`. If generic
canonicalization and key resolution succeed, a verifier may still report the
cryptographic dimensions; it must not treat the unknown field as understood.

The first v2 schemas have no generic extension container. A future extension
mechanism must be introduced by a new schema and must define namespace,
collision, canonicalization, privacy, criticality, and downgrade behavior.

### Optional fields and null

Optional means the field may be absent. Nullable means the value may be null.
These are independent schema properties. Defaults are applied only to
application views and never injected during hash/signature reconstruction
unless the schema explicitly defines a canonical default as part of the wire
object.

### Versioning

Adding, removing, renaming, retyping, changing the meaning or requiredness of a
signed field, changing canonicalization or signature framing, or changing
unknown-field acceptance requires a new schema ID. Clarifying prose may keep a
schema ID only when every previously conforming byte/result remains conforming
with the same meaning.

Schema dispatch occurs immediately after bounded syntactic parsing and before
schema-specific canonicalization, hash, signature, or semantic evaluation.
Unknown schema returns `unsupported_schema`, not `invalid_signature`. No
downgrade or best-effort reinterpretation is permitted.

## RD-05 — Language-neutral Action identity

### Namespace

`publisher_namespace` uses this wire form:

```text
igris-publisher:<52 lowercase base32 characters without padding>
```

The payload is 32 cryptographically random bytes encoded with RFC 4648 base32
lowercase and no padding. It is opaque: it does not encode a key, organization,
tenant, DNS name, package, or location. Generation uses a cryptographically
secure random source. Collision handling is exact-value comparison and fail
closed; no automatic merge is permitted.

Namespaces are probabilistically globally unique but not globally trusted.
Local-only namespaces are valid and self-asserted. An organization, Connected,
or another authority may bind a namespace to a subject in trust metadata.
Transfer or delegated control is a trust-artifact operation and does not change
historical Action identity.

### Action identity

The semantic Action identity is exactly:

```text
(publisher_namespace, action_name)
```

`action_name` retains the language-neutral ASCII profile
`^[A-Za-z][A-Za-z0-9_.:-]{0,127}$`. Two publishers choosing the same name have
different Actions because their namespaces differ. Python module path,
qualified name, decorator, wrapper, package, source path, function address,
and source hash do not participate.

### Contract versions

One Action may have multiple immutable contract versions. `contract_hash`
identifies a version, not the Action. A change to risk, approval/decision
requirement, portable input descriptors, declared evidence/disclosure profile,
or declared execution capability creates a new contract hash for the same
Action identity. These fields are policy-relevant and therefore part of the
semantic contract body.

Invocation inputs, caller/session identity, provider instances, transport,
trace context, deadlines, and application idempotency keys are invocation
context and do not change the contract unless a contract declares a requirement
profile governing them.

## RD-06 — Semantic contract hash and implementation binding

ActionContract v2's semantic hash is:

```text
sha256:<lowercase hex SHA-256 of the canonical semantic contract body>
```

The body includes the schema ID, publisher namespace, Action name, portable
input shape, risk, decision requirement, evidence/disclosure requirement
profile, and declared execution capability requirements. The exact v2 field
schema and vectors remain a separate prerequisite before implementation.

The body excludes source text, module/qualified name, repository/package path,
build ID, provider configuration, signer private-key provenance, human-facing
description, and implementation artifact digest. Human intent text may be
associated metadata but does not alter semantic identity.

An implementation binding, if later standardized, is a separate versioned
object that binds a semantic contract hash to an artifact/reference and its own
trust assertions. It is deliberately deferred from minimum ActionContract v2.

## RD-07 — Evidence identity and chain model

### Identifiers

Evidence v2 uses opaque 256-bit identifiers encoded as lowercase unpadded RFC
4648 base32:

- `stream_id = "igris-stream:" + 52 characters`;
- `action_instance_id = "igris-instance:" + 52 characters`.

Both are generated from a cryptographically secure random source and signed in
every applicable event. They are collision-resistant global identifiers but
carry no identity, authorization, time, order, or idempotency meaning.

The minimum v2 model has no independent `event_id`. An event is identified by
`(stream_id, sequence)` and its `object_hash`. This avoids a redundant UUID.
An outcome references its decision by `decision_event_hash` and repeats the
same `action_instance_id`.

Future Evidence `object_hash`, `previous_event_hash`, and
`decision_event_hash` values use the suite's algorithm-qualified
`sha256:<64-lowercase-hex>` encoding. The unqualified 64-hex schema `1` event
hash remains unchanged.

### Sequence and linkage

- `sequence` is a signed integer in `0..9007199254740991`.
- Genesis is sequence `0` and has `previous_event_hash = null`.
- Each later event increments sequence by exactly one and carries the prior
  event's `object_hash`.
- On sequence exhaustion, a producer creates a new stream; no wrap is allowed.
- A stream may contain interleaved Action instances.
- Key rotation does not require a new stream; signer/trust is evaluated per
  event while hash continuity remains stream-scoped.

All identifiers, sequence, previous hash, decision reference, signer reference,
and schema-qualified contract reference are signed.

### Partial and complete chains

A segment beginning after sequence `0` requires an external trusted anchor to
establish continuity before its first event. Without one it may be internally
consistent but is `valid_unanchored`. A sequence gap or previous-hash mismatch
is `discontinuous`. A local chain cannot prove that its presented tail is the
latest tail. Completeness is unknown without a trusted checkpoint or equivalent
witness statement.

General trace, correlation, causation, parent Action, and OpenTelemetry IDs are
not minimum fields. They may be external metadata or a future typed schema.

## RD-08 — Minimum execution lifecycle

### Pre-decision failures

An attempted host-language call may fail before a Decision exists: argument
binding, contract/provider resolution, Connected configuration or explicit
contract synchronization, redaction/canonicalization, signing identity, clock
or identifier generation, approval-provider evaluation, or decision-evidence
persistence may fail. Such a failure must prevent application invocation. The
minimum protocol requires no Evidence event for a pre-decision failure.

### Decision and execution

- `Allowed` means a provider's permission observation was durably recorded. It
  does not mean invocation began.
- `Denied` means denial was durably recorded, is terminal for that Action
  instance, and permits no Outcome.
- An allowed decision permits at most one observed Outcome for the same Action
  instance and decision reference.
- `Succeeded` means the adapter observed a normal return.
- `Failed` means the adapter observed an ordinary application failure.
- Neither Outcome proves an external effect or rollback.
- Allowed without Outcome means execution occurrence and result are unknown to
  an evidence-only verifier.

An execution-start event is not required in minimum Evidence v2. It would
reduce one ambiguity only if durably written at the exact execution boundary,
while adding crash and recovery semantics. It is safely deferred.

### Evidence failure after execution

If application execution returns or raises but Outcome persistence fails, the
binding reports execution occurred, evidence incomplete, and retry unsafe. It
does not fabricate an Outcome, retry the Action, or claim exactly-once external
behavior. A verifier that sees only the durable decision remains unable to
distinguish this condition from another crash boundary.

Signed cancellation, expiry, suspension, workflow recovery, compensation, and
distributed transaction states are deferred.

## RD-09 — Portable verification-result model

Verifier output uses `igris:protocol:verification-result:1`, specified in
[`../../spec/verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md).

The result decomposes specification consistency, parse, schema,
canonicalization, algorithm, object hash, signature, key resolution,
continuity, completeness, lifecycle semantics, trust, time confidence, and
optional named policy evaluation. An artifact may be cryptographically valid
and policy-rejected. Unsupported schema/algorithm is not invalid signature.
Unknown or revoked key does not erase signature math.

`summary` is a deterministic descriptive classification, not a universal
authorization verdict: `valid_and_trusted`, `valid_but_trust_unknown`,
`valid_but_untrusted`, `invalid`, `unsupported`, or `indeterminate`. Policy
acceptance appears only when a named policy profile is supplied. Issues carry
one registered meaning, owning dimension, fixed severity, and deterministic
minimum summary consequence. An unregistered event type under a supported
closed schema is `invalid_field`, not `unsupported_event_type`.

## RD-10 — Minimum trust-bundle semantics

Trust input is external to Evidence. A minimum trust bundle supplies:

- schema/bundle identifier and trust scope;
- full signer public key and algorithm-qualified fingerprint;
- optional subject binding and subject type;
- binding authority identifier and provenance;
- validity interval, if one is asserted;
- active, revoked, suspended, compromised, or unknown status;
- effective time, recorded time, and the confidence/source of each time;
- rotation/predecessor/successor references when applicable;
- policy identifier/version and evaluation time; and
- the historical signed binding/revocation artifact or an integrity-protected
  reference to it.

An opaque remote reference alone is insufficient for offline historical
evaluation. The referenced key/binding/revocation material must be supplied or
locally resolvable to the verifier; otherwise the affected trust dimension is
unknown or not evaluated.

The bundle container does not become trusted merely by being well formed. A
relying party trusts its acquisition channel, configured authority, or signed
trust artifacts. Signed binding/revocation artifacts use the
`igris.trust-artifact` domain.

Self-asserted local evidence may be verified with a supplied key and returns
trust `unknown` unless local policy explicitly trusts it. TOFU is local verifier
policy: it detects later key change but does not authenticate first use.
Connected may assert an organization-scoped binding based on authenticated
registration; that assertion is not universal and must be exportable for
historical verification.

Rotation creates a new fingerprint and retains old keys/bindings. Revocation
changes trust, not cryptographic validity. If compromise time is reliably
bounded, policy may distinguish evidence proven to exist before and after that
bound. A producer timestamp alone is not reliable evidence of creation time.
Without trustworthy time, an applicable interval is
`binding_interval_indeterminate`; a verifier must not invent a safe interval.
With trustworthy time proving the artifact outside it, the distinct result is
`outside_binding_interval`. Time evidence uses `unavailable` when no usable
basis exists; it does not use `unknown`, `claimed`, or `inferred` as portable
`time_confidence` values.

The exact serialized trust-bundle schema is deferred until an external trust
exchange or Connected GA claim requires it. These semantic slots are frozen.

## RD-11 — Permanent schema `1` compatibility profile

### Frozen artifacts and algorithms

ActionContract schema `1` and Evidence schema `1` retain forever:

- their existing fields and field meanings;
- Python-compatible sorted, compact, UTF-8/non-ASCII legacy JSON
  canonicalization for the values emitted by the reference release;
- ActionContract hash over all contract fields except `contract_hash`;
- Evidence event hash over all event fields except `event_hash` and
  `signature`;
- SHA-256 lowercase hexadecimal hashes;
- Ed25519 signature over the raw 32-byte Evidence event digest;
- standard padded base64 signatures;
- truncated `ed25519:<16 hex>` key lookup hint;
- null genesis previous hash and existing chain semantics; and
- every released historical fixture and expected byte/result.

The historical producer baseline is the exact schema `1` byte representation
emitted by Python 0.1.0a2. U+2028 and U+2029 are raw UTF-8 in that baseline.
Current Go production re-encoding escapes those scalars and is a known
non-conforming implementation defect, not an alternate legacy profile.
Verification follows the schema profile/vectors rather than a host serializer.

For arbitrary externally supplied schema `1` JSON, every accepted numeric
token's original lexeme is preserved for canonical reconstruction. Python-
emitted number rendering remains authoritative for Python-produced artifacts;
numerically equal external spellings are not interchangeable bytes. A verifier
that cannot preserve a required lexeme fails closed with
`unsupported_legacy_representation` and does not evaluate dependent
cryptography.

No v2 canonical, schema, key-reference, domain, stream, sequence, or lifecycle
rule is backported. Future verifiers retain a dedicated schema `1` dispatch.

### Known limitations

Schema `1` has no domain separation, signed stream/sequence/Action-instance ID,
full signer fingerprint, trusted time, general correlation, chain-tail witness,
portable Action descriptors, or trust/revocation object. Its `action_id`,
parameter descriptors, and source fingerprint are Python-origin artifacts.
Signatures prove content relative to a supplied key, not person, organization,
authorization, environment, complete history, or external effect.

### Security and semantic profiles

Security fixes may strengthen bounded parsing, duplicate detection, key
ambiguity handling, semantic transitions, or trust policy without changing
signed bytes. Results must keep cryptographic facts separate. A schema `1`
artifact can have valid hash/signature while a newer semantic or ingest policy
rejects it. Such a result is not `invalid_signature`.

The initial released schema `1` vector suite must pin current positive bytes,
raw-UTF-8 U+2028/U+2029, preserved numeric-lexeme variants, and parser,
transition, key, and chain limitations.
Released vectors, public keys, schemas, and issue meanings are retained
indefinitely and never rewritten in place.

## RD-12 — Optional checkpoint and witness model

Checkpoints are useful for detecting presentation of a chain truncated before
a witnessed head, but are not required in minimum Evidence v2 and are never
Evidence events.

A future checkpoint is a separate signed object containing at minimum:

- checkpoint schema ID;
- stream ID;
- witnessed sequence and event hash;
- witness signer reference and signature suite;
- observation time plus time-confidence/source; and
- optional prior checkpoint reference.

It uses the `igris.chain-checkpoint` signature domain. Connected or any trusted
third party may act as witness; no global service or transparency log is
required.

A trusted checkpoint proves only that the witness observed that chain head no
later than the defensible observation bound and allows detection of a later
presentation ending before that head. It does not prove the Action outcome,
truth of external effects, absence of an earlier fork without verified
continuity, or that no events were appended after the checkpoint.

Verification vocabulary is frozen:

- `valid_genesis`: continuity verified from sequence `0`;
- `valid_anchored`: continuity verified from a trusted supplied anchor;
- `valid_unanchored`: internal linkage valid but the start is not trusted;
- `discontinuous`: sequence/hash linkage fails;
- `complete_to_checkpoint`: the verified segment reaches the exact trusted
  checkpoint head; and
- `completeness_unknown`: no trusted assertion establishes the latest required
  head.

The serialized checkpoint schema and checkpoint service are safely deferred.
No implementation may claim complete latest history from a local chain alone.

## Deliberately deferred decisions

- Generic extension containers.
- Signed intent prose and implementation bindings.
- General correlation, causation, parent Action, and trace fields.
- Execution-start, cancellation, expiry, repair, and suspension events.
- Serialized trust-bundle and checkpoint schemas until an interoperability
  claim requires them.
- Global PKI, transparency log, trusted time, hardware/workload attestation.
- Workflow composition, compensation, distributed transactions, exactly-once.
- Rust, WASM, sidecar, shared execution engine, TypeScript producer, Go SDK.

## Compatibility consequence

These resolutions create explicit future schema boundaries and do not change a
single schema `1` byte. Implementations must dual-dispatch rather than migrate
or reinterpret historical objects. The cost is permanent legacy verification;
the benefit is that future language-neutral rules do not pretend to have been
present in Alpha.2.
