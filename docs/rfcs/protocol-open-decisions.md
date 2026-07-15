# Igris protocol open decisions

Status: **Architecture decisions resolved in first design-freeze candidate;
ratification and implementation-enabling artifacts remain open**

The senior review identified 12 decisions. All 12 now have candidate
resolutions in [`protocol-resolved-decisions.md`](protocol-resolved-decisions.md).
This register preserves their disposition, dissenting alternatives, and the
remaining gates. Candidate resolution is not human ratification.

## Resolved senior-review decisions

| ID | Candidate resolution | Classification | Remaining gate |
| --- | --- | --- | --- |
| OD-01 | Release manifest pins normative artifacts; prose/canonical rules/schemas/vectors have explicit responsibilities; implementations are non-normative | `schema_semantic_irreversible` | Human governance ratification |
| OD-02 | `igris-canonical-json-1`: duplicate rejection, safe integers, scalar-preserving Unicode, scalar ordering, fixed escaping, explicit null | `signed_byte_irreversible` | Canonical vectors and ratification |
| OD-03 | `igris-ed25519-sha256-1` with length-framed object domains/schema/suite/payload; ActionContract attribution uses a separate attestation | `signed_byte_irreversible` | Frame vectors and cryptography approval |
| OD-04 | ASCII schema IDs, dispatch before interpretation, closed schemas, no generic v2 extension container | `schema_semantic_irreversible` | Machine schemas and negative vectors |
| OD-05 | Action identity `(opaque random publisher_namespace, action_name)`; trust binding external | `schema_semantic_irreversible`, `trust_policy` | ActionContract v2 schema/vectors |
| OD-06 | Semantic contract hash includes language-neutral policy requirements; implementation binding separate/deferred | `signed_byte_irreversible` | Exact ActionContract v2 body schema/vectors |
| OD-07 | Signed random stream/instance IDs, sequence, previous hash, decision hash reference; no minimum event UUID | `signed_byte_irreversible` | Exact Evidence v2 schemas/vectors |
| OD-08 | Pre-decision failure emits no required Decision; Allowed does not prove execution; denial terminal; at most one Outcome | `schema_semantic_irreversible` | Event field/transition vectors |
| OD-09 | Versioned decomposed verifier result with descriptive summary and separate named policy | `verifier_policy`, `schema_semantic_irreversible` | Ratified machine schema and released expected results |
| OD-10 | External trust slots and temporal rules frozen; self-asserted/TOFU/Connected meanings separated | `trust_policy` | Serialized trust bundle only before an exchange/GA claim requires it |
| OD-11 | Permanent schema `1` legacy dispatch; stronger policy never rewrites cryptographic facts | `verifier_policy` | Released schema `1` vectors |
| OD-12 | Checkpoint optional, separate signed object; continuity/completeness vocabulary frozen | `safe_to_defer`, `verifier_policy` | Serialized checkpoint only before checkpoint-backed claims |

## Remaining blockers

### OPEN-01 — Human ratification

The protocol owner, cryptography/security reviewer, SDK implementability
reviewers, and conformance owner must approve the candidate. Until then none of
the resolved decisions is a ratified protocol release.

Blocks: all implementation authorization, including schema `1` vector work.

### OPEN-02 — ActionContract v2 object schema and vectors

Architecture now fixes Action identity, semantic-hash inclusion/exclusion,
canonical profile, schema closure, and signature framing. The exact required/
optional field schema, portable input vocabulary, requirement-profile
registries, and golden vectors do not yet exist.

Blocks: ActionContract v2 implementation and TypeScript producer.

### OPEN-03 — Evidence v2 object/event schemas and vectors

Architecture now fixes stream/instance/sequence/linkage identity and lifecycle
meaning. The exact event field tables, contract-reference representation,
conditional fields, object hashes, signatures, and golden vectors do not yet
exist.

Blocks: Evidence v2 implementation and TypeScript producer.

### OPEN-04 — Verification-result machine schema release

The language-neutral model is drafted at
[`../../spec/verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md).
A machine-readable schema, issue registry revision, and released expected
results must be approved before verifier implementation.

Blocks: standalone Go verifier.

### OPEN-05 — Schema `1` vector candidate and release

The release is fully designed at
[`../../spec/test-vectors/schema-1-release-plan.md`](../../spec/test-vectors/schema-1-release-plan.md),
but the additive files have not been generated. After ratification they may be
frozen as a candidate using maintained Python and Go paths. The Stage 2
standalone verifier supplies the independence result required for release
promotion.

Blocks: standalone Go verifier until the candidate files/result schema are
frozen. After OPEN-01, candidate-vector implementation is the only task the
candidate recommends authorizing.

### OPEN-06 — Trust/checkpoint serialization when claimed

Minimum trust and checkpoint semantics are frozen. Their serialized schemas
remain deliberately deferred. A trust-bundle schema is required before trusted
cross-organization exchange or Connected GA depends on portable trust input. A
checkpoint schema is required before any product claims checkpoint-backed
completeness.

Does not block: local integrity verification or schema `1` vector release.

## Dissenting alternatives retained

The candidate rejects these alternatives but records them for ratification:

| Decision | Rejected alternative | Reason |
| --- | --- | --- |
| Precedence | Let fixtures or deployed behavior silently override prose | Makes implementation accidents normative and hides conflicts |
| Canonical numbers | Arbitrary JSON numbers/JCS-style binary64 for all protocol data | Cross-language loss and unnecessary numeric surface; domain decimals can be strings |
| Unicode | NFC-normalize before signing | Silent transformation changes identifiers and hides original code points |
| Ordering | Use host-language default sort | TypeScript UTF-16 ordering can differ for supplementary scalars |
| Signatures | Sign canonical bytes with an unframed algorithm field | Cross-object/version ambiguity and algorithm substitution risk |
| Extensions | Accept unknown signed fields with warnings | Creates semantic divergence and downgrade ambiguity |
| Namespace | DNS/tenant/key-derived namespace | Couples identity to infrastructure, service, or rotation |
| Event identity | Mandate UUIDv4 plus stream/sequence | Redundant identity with no distinct minimum purpose |
| Lifecycle | Add execution-start/cancellation/expiry now | Adds crash/recovery semantics not required for current interoperability |
| Results | One universal `valid` boolean | Collapses crypto, trust, completeness, semantics, and policy |
| Trust | Mandatory CA, Igris cloud, or transparency log | Breaks offline/local operation and centralizes trust |
| Checkpoint | Put checkpoints inside every Evidence stream | Expands minimum signed surface without a current interoperability need |

## Decisions deliberately deferred

- Generic signed extensions.
- Implementation-artifact binding and signed human intent.
- General correlation, causation, and OpenTelemetry fields.
- Execution-start, cancellation, expiry, repair, suspension, and workflow
  recovery events.
- Global PKI, mandatory log/cloud, trusted time, and attestation.
- Workflow composition, exactly-once, compensation, distributed transactions.
- TypeScript producer, full Go SDK, Rust/WASM/sidecar/shared engine.

## Approval rule

Closing OPEN-01 requires named approval recorded against the exact candidate
tip. Closing any implementation-enabling item additionally requires:

1. normative schema/RFC update;
2. compatibility and threat analysis;
3. positive and negative language-neutral vectors;
4. independent runner results where applicable; and
5. a focused review range with no unrelated production change.

No implementation may choose a remaining detail silently.
