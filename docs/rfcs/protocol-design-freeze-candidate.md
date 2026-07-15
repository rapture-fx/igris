# Igris protocol corrected design-freeze candidate

Status: **Clock 2A remediation complete; pending independent Clock 2B delta
review and ratification**

Authoritative candidate base:
`41879dcfb971dcad0bfa254dab83b0a6d738dcbf`

Independent review consumed:
`9514931345898505feafd2db32f6d047fe131d2f` (**CONDITIONAL GO**)

Scope: protocol specification and decision freeze only. Ratification does not
merge, publish, deploy, or implement a new signed format.

## Executive decision

The 12 senior-review decisions remain resolved at the architecture/
specification level. The three independent-review conditions are remediated in
documentation and await Clock 2B confirmation. After an independent GO, the
candidate is sufficiently concrete to authorize only additive schema `1`
conformance-vector implementation and machine-readable verification-result
schema freeze. It does not authorize Evidence v2, ActionContract v2, or a
standalone verifier implementation.

## Invariants proposed for freeze

### Normative contract and governance

1. A release manifest pins immutable hashes/identifiers of normative RFCs,
   registries/canonical specifications, machine schemas, and vector suites.
2. Prose defines meaning/claims; referenced canonical rules define bytes;
   schemas define machine shape; vectors define exact enumerated cases.
3. Normative artifacts must agree. Conflict is a specification defect and
   never silently resolved by a reference implementation.
4. Reference implementations and deployed product behavior are non-normative.
5. Released bytes, vector results, and historical semantics are never changed
   by erratum.
6. Current objects are the schema `1` compatibility profile, not an implicitly
   ratified Protocol v1.

### Future canonical data

7. Future signed JSON objects use `igris-canonical-json-1` only at a new schema
   boundary.
8. Input is valid UTF-8 without BOM, exactly one JSON value, with duplicate
   member rejection before object construction.
9. The data model contains null where explicitly nullable, booleans, Unicode
   scalar strings, safe-range integers, arrays, and unique-key objects.
10. Integers are limited to
    `-9007199254740991..9007199254740991`; floats/fractions/exponents are not
    protocol numeric values.
11. Unicode scalar sequences are preserved exactly; no normalization or case
    folding occurs.
12. Object keys sort lexicographically by Unicode scalar sequence.
13. Canonical strings use fixed minimal escapes; solidus and non-ASCII are not
    escaped; controls use the specified short/lowercase forms.
14. Missing and null are distinct. Arrays preserve order. Canonical output is
    compact UTF-8 without newline or surrounding bytes.

### Future schemas and signatures

15. Future schema IDs use `igris:protocol:<object-name>:<major>` and are signed.
16. Signed schemas are closed. Unknown fields invalidate a known schema; the
    first v2 schemas have no generic extension container.
17. Any signed field-set/meaning/canonical/framing/unknown-field change requires
    a new schema ID.
18. Unsupported schema and unsupported algorithm are typed results, not invalid
    signatures, and never trigger downgrade.
19. `igris-ed25519-sha256-1` fixes canonical profile, SHA-256 object hash,
    framed SHA-256 signature digest, Ed25519, padded base64, and a full
    Ed25519-key fingerprint.
20. The signature frame binds protocol magic, frame version, object domain,
    schema ID, suite ID, and complete canonical unsigned payload with explicit
    byte lengths.
21. ActionContract attestation, Evidence event, trust artifact, and checkpoint
    use distinct registered signature domains. The semantic ActionContract is
    content-addressed; attribution is a separate attestation so key rotation
    does not change contract identity.
22. Algorithm substitution is forbidden; new suites require registry review,
    threat analysis, vectors, and specialist cryptographic approval. The
    proposed Ed25519-over-SHA-256(frame) composition depends on SHA-256
    collision resistance and does not retain pure Ed25519's direct-message
    collision-resilience property.

### Action identity

23. Action identity is exactly `(publisher_namespace, action_name)`.
24. Publisher namespaces are opaque random 256-bit IDs in the frozen base32
    form. They are collision-resistant but carry no inherent trust.
25. Local self-asserted namespaces are valid; organization attribution is an
    external trust binding.
    A publisher namespace is an identifier, not an identity credential,
    ownership claim, or possession proof. It can be copied or squatted;
    attribution requires a separate signed attestation and verifier trust
    binding.
26. `contract_hash` identifies an immutable contract version, not the Action.
27. Risk, decision requirement, portable input shape, evidence/disclosure
    requirement, and execution capability requirements affect contract version
    identity.
28. Python paths, source hashes, decorators, wrappers, provider instances,
    transport, and human description do not define semantic Action identity.
29. Implementation binding is a separate deferred object.

### Evidence identity and lifecycle

30. Evidence v2 will sign opaque 256-bit stream and Action-instance IDs.
31. Event identity is `(stream_id, sequence)` plus object hash; no redundant
    event UUID is required in the minimum model.
32. Sequence begins at zero, increments exactly one, and cannot wrap.
33. Genesis previous hash is null; later events sign the prior object hash.
34. Outcomes share the Action-instance ID and reference the decision event
    hash.
35. Equal contracts/inputs do not imply the same Action instance.
36. Trace/correlation/causation identifiers are not minimum fields.
37. Pre-decision failures may occur and emit no Decision; all prevent
    application invocation.
38. Allowed is a durable permission observation, not proof that execution
    started.
39. Denied is terminal and permits no Outcome.
40. An allowed decision permits at most one observed Outcome.
41. Succeeded/Failed are adapter observations, not external-effect/rollback
    proof.
42. Allowed without Outcome means execution occurrence/result unknown to an
    evidence-only verifier.
43. Post-execution evidence failure is retry-unsafe and does not synthesize an
    Outcome.
44. Execution-start, cancellation, expiry, repair, suspension, workflow, and
    exactly-once semantics are outside the minimum.

### Verification and trust

45. Portable results use
    `igris:protocol:verification-result:1` and decompose every verification
    phase, including specification consistency.
46. Cryptographic validity may coexist with trust unknown, explicit distrust,
    revocation, outside-binding interval, or policy rejection.
47. Every issue has one meaning, dimension, fixed severity, and summary
    consequence. Completeness unknown alone does not invalidate signed content.
48. A descriptive summary is not a universal authorization decision; named
    policy output is separate.
49. Trust input is external to Evidence and minimally records full key,
    fingerprint, subject/authority binding, scope, interval/status, time
    confidence, policy/evaluation context, and historical artifacts.
50. Self-asserted local verification has trust unknown unless relying policy
    says otherwise. TOFU is local policy, not identity proof.
51. Rotation preserves historical keys. Revocation changes trust, not signature
    math. Producer time alone cannot prove pre-compromise creation.
52. Connected organization binding is scoped/exportable trust metadata, not a
    universal root.
53. An unknown event type under a supported closed schema is `invalid_field`,
    not `unsupported_event_type`.
54. `outside_binding_interval` requires trustworthy time proving the artifact
    outside; `binding_interval_indeterminate` means trustworthy time is
    insufficient. `time_confidence=unavailable` is the sole no-usable-time
    value.
55. A relevant specification conflict stops affected verification and yields
    `indeterminate`; no implementation receives implicit precedence.

### Historical compatibility and checkpoints

56. Every schema `1` field, byte, hash, signature, fixture, and historical
    meaning remains permanently verifiable under dedicated legacy dispatch.
57. No future canonical, domain, key, stream, sequence, identity, or lifecycle
    rule is backported to schema `1`.
58. Stronger parsing/semantic/trust policy may reject a cryptographically valid
    schema `1` artifact but must preserve the valid cryptographic fact.
59. Released schema `1` vectors and verification materials are retained
    indefinitely and never rewritten.
60. Checkpoints are optional external signed objects, not minimum Evidence
    events and not a mandatory Connected/global service.
61. Continuity and completeness are separate. A local chain cannot prove its
    latest tail.
62. `complete_to_checkpoint` means the verified chain reaches one exact trusted
    checkpoint head; it does not prove no later events or external truth.
63. Python 0.1.0a2-emitted bytes are the historical schema `1` producer
    baseline. U+2028/U+2029 are raw UTF-8; current Go escaped re-encoding is a
    known non-conforming implementation defect.
64. Externally supplied accepted schema `1` number tokens are reconstructed
    with preserved original lexemes. A verifier unable to preserve a required
    lexeme returns `unsupported_legacy_representation` and stops dependent
    verification.
65. Valid JSON, Python producer-conforming output, and equal host-language
    numeric values are not interchangeable canonical-byte claims.

## Signed-byte consequences

| Decision | Consequence |
| --- | --- |
| Canonical profile | Every future canonical byte differs only according to one language-neutral algorithm; schema `1` is unchanged |
| Closed schemas | Adding any signed field requires a new schema ID |
| Full signer reference | Evidence v2 bytes cannot reuse schema `1` truncated-only identity |
| Signature frame/domain | Every future signature intentionally differs from legacy schema `1` |
| Action namespace/hash | ActionContract v2 bytes require publisher namespace, exclude Python implementation identity from semantic hash, and use a separate signed attestation when publisher attribution is required |
| Stream/sequence/instance | Evidence v2 bytes require new signed identity/linkage fields |
| No generic extensions | Unplanned signed metadata cannot enter v2 without a schema decision |
| Optional checkpoints/trust artifacts | They are separate signed objects with their own domain/schema, never anonymous Evidence fields |
| Schema `1` Unicode/numbers | Existing Python-emitted bytes remain authoritative; the Go Unicode fix and number-token preservation are later verifier work, not byte changes |

No consequence changes existing schema `1` bytes.

## Backward-compatibility consequences

- Verifiers permanently retain schema-specific canonical and signature
  dispatch.
- Schema `1` remains readable after v2 exists; no migration/re-signing is
  required or permitted.
- A future writer explicitly selects its emission schema and never silently
  upgrades/downgrades.
- Stronger semantic/trust evaluation adds dimensions rather than relabeling old
  signatures invalid.
- Trust/checkpoint export must retain old keys, bindings, policies, and schema
  artifacts for historical evaluation.
- The cost is permanent dual-version support; the benefit is no retrospective
  reinterpretation.

## Decisions unresolved after this candidate

The 12 architecture decisions are resolved in this candidate. The following
implementation-enabling specifications remain intentionally incomplete and
therefore remain blockers:

1. exact ActionContract v2 field schema and golden vectors;
2. exact Evidence v2 field/event schemas and golden vectors;
3. ratified JSON/machine schema for the verification-result draft;
4. frozen schema `1` candidate vector files, followed by an independent runner
   result before release promotion;
5. serialized trust-bundle schema before trusted cross-organization exchange or
   Connected GA depends on it; and
6. serialized checkpoint schema before any product claims checkpoint-backed
   completeness.

These are not delegated implementation choices.

## Deliberately deferred decisions

- Generic signed extension containers.
- Signed intent prose and implementation-artifact binding.
- General correlation/causation/tracing.
- Execution-start/cancellation/expiry/repair/suspension events.
- Workflow composition, compensation, transactions, exactly-once effects.
- Trusted time, transparency log, global PKI, hardware/workload attestation.
- Mandatory cloud/Connected dependency.
- TypeScript producer, Go SDK, Rust/WASM/sidecar/shared engine.

## Authorization matrix

| Work | Authorization after independent Clock 2B GO | Reason |
| --- | --- | --- |
| Schema `1` vector implementation | **ELIGIBLE TO PROCEED, narrowly** | Legacy semantics/result model are sufficiently resolved; work must be additive test/spec artifacts only |
| Machine-readable verification-result schema freeze | **ELIGIBLE TO PROCEED, narrowly** | Clock 2B must first confirm the reconciled vocabulary and mappings |
| Standalone Go verifier implementation | **NOT YET AUTHORIZED** | Requires frozen schema `1` candidate vectors and a ratified result schema |
| ActionContract v2 implementation | **NOT AUTHORIZED** | Exact object schema and golden vectors do not exist |
| Evidence v2 implementation | **NOT AUTHORIZED** | Exact event schemas and golden vectors do not exist |
| TypeScript producer/SDK | **NOT AUTHORIZED** | Depends on v2 freeze and two independent verifiers |
| Rust core/shared engine | **DEFERRED** | No demonstrated requirement or multi-SDK drift |

Authorization never includes backend, database, migration, deployment,
publication, or Connected feature work.

## Clock 2B ratification checklist

Independent Clock 2B review of the exact remediation delta must confirm:

- canonical integer bound, Unicode ordering, and escape rules are acceptable;
- frame bytes, suite ID, domains, and full fingerprint are acceptable;
- closed-schema/no-generic-extension policy is acceptable;
- random publisher/stream/instance identifier forms are acceptable;
- risk/approval/evidence requirements belong in semantic contract versions;
- no event UUID or execution-start event is required in the minimum;
- result summary is descriptive and policy remains separate;
- the three review conditions and two accepted clarifications are complete;
- no OD-01 through OD-12 decision changed unexpectedly;
- no production source, fixture, migration, or schema `1` signed byte changed;
- trust/checkpoint wire formats may remain deferred; and
- schema `1` vector work is the only next implementation authorized.

Until Clock 2B records GO against the exact remediation tip, this file remains
a candidate and authorizes no implementation. It does not self-ratify.
