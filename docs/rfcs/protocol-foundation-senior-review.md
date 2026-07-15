# Igris protocol foundation senior architecture review

Status: **Protocol Design-Freeze Candidate; senior approval required**

Amendment (2026-07-16): independent review at
`9514931345898505feafd2db32f6d047fe131d2f` confirmed that current Go
re-encoding diverges from the Python schema `1` baseline for U+2028/U+2029 and
that adversarial external numeric spellings require original-token lexical
preservation. The corrected candidate records both without changing this
review's historical findings or any signed bytes.

Review range: `1ef093a96dc8ae55c317266aa9b0dc94e5b08579..73e0a5ab8cf95eb114a16f0e76c808c168de9c00`

Review posture: independent documentation-only review. This document does not
authorize Evidence v2, ActionContract v2, another SDK, database work, or
deployment.

## Executive summary

The RFC suite has the right architectural center: a small language-neutral
protocol, ordinary callable ergonomics, offline verification, explicit claim
limits, optional Connected services, and no workflow-engine or mandatory-cloud
dependency. Evidence v1 and ActionContract v1 are described honestly enough to
remain compatibility anchors.

The suite is **not ready for an unconditional design freeze**. It is a sound
candidate with specific blockers. Evidence v2, ActionContract v2, and a second
producer SDK must not start until the following are decided and vector-pinned:

1. one normative-document grammar and precedence rule;
2. the complete JSON data model, duplicate-key rule, Unicode domain, number
   domain, and canonical byte algorithm;
3. schema identifiers, closed/open field behavior, and version dispatch;
4. signature-suite identifiers and unambiguous domain-separated framing;
5. semantic Action identity, publisher namespace, and separation from
   implementation identity;
6. signed stream, sequence, and Action-instance identity;
7. signer-reference and minimum trust-record slots;
8. lifecycle semantics that do not infer execution from an allowed decision;
9. a versioned, decomposed verification-result schema; and
10. real language-neutral golden vectors, including negative and policy cases.

The correct senior decision is therefore:

- **FREEZE NOW:** existing schema `1` bytes and legacy verification rules;
  integrity/trust/authorization/external-effect separation; decision-before-
  execution; denial terminality; evidence-incomplete as an orthogonal
  condition; zero-network Embedded behavior; Connected not owning execution;
  normal callable ergonomics; offline verification; and exclusion of workflow
  composition.
- **REVISE BEFORE FREEZE:** canonicalization, normative grammar, Action
  identity, v2 signer/stream framing, lifecycle wording, unknown-field policy,
  result taxonomy, and conformance artifacts.
- **KEEP OPEN:** cancellation/expiry evidence, correlation/causation,
  checkpoints, trust-bundle wire format, trusted time, attestation, and
  implementation-language strategy beyond the first independent verifier.

No production implementation should change on the strength of the current
drafts.

## Overall protocol assessment

### What is architecturally sound

- The protocol is not defined by Python syntax or one SDK.
- Action is separated from an invocation and from the language adapter.
- Evidence is narrower than observability and does not claim external truth.
- Cryptographic integrity is separated from attribution, authorization, trust,
  environment assurance, and completeness.
- Existing Evidence v1 and ActionContract v1 bytes are treated as immutable.
- Connected is optional coordination and storage, not execution provenance.
- Pre-execution evidence failure is fail-closed; post-execution evidence
  failure is explicitly non-retryable.
- Independent implementations and offline verification are first-class goals.
- Workflow composition, durable approval, Rust, WASM, sidecars, and global PKI
  are excluded from the minimum protocol.

### Why the current suite cannot yet be the implementation specification

The suite describes several irreversible choices but does not resolve them.
The vector format and common verification result are still conceptual. Numeric
canonicalization is explicitly open, duplicate-key handling is absent, Unicode
validity and ordering are incomplete, and the exact v2 signature preimage does
not exist. ActionContract v2 has no settled namespace or semantic hash. Evidence
v2 has no settled stream/sequence/instance identifiers. A TypeScript producer
written now would necessarily choose behavior not authorized by the RFCs.

The suite also mixes normative styles. RFC 001 says RFC 2119 terms are normative
only within text labeled “Draft invariant,” while RFCs 000 and 002–008 use those
terms extensively outside such labels. Until one rule applies suite-wide,
independent implementers cannot know which statements are conformance
requirements.

## Review method and current-behavior trace

All nine RFCs, the glossary, eight ADRs, protocol gap analysis, and test-vector
design were read in full. Current-behavior claims were checked against the
baseline source and tests below. This table is the claim-to-source register for
the suite; proposed behavior is not represented as implemented.

| Current claim | Source authority | Executable evidence | Assessment |
| --- | --- | --- | --- |
| ActionContract v1 field set and hash | `sdk/python/src/igris/contracts.py::ActionContract`, `_build_contract_unchecked` | `sdk/python/tests/test_contracts.py`; `conformance/contractv1/canonical_conformance_test.go::TestContractHashRecomputation` | Implemented |
| Python-origin action and implementation location | `contracts.py::ActionContract.action_id`, `validate_action_name` | `test_contracts.py::TestActionIdentity` | Implemented; not global identity |
| Python parameter descriptors and source fingerprint | `contracts.py::_parameter_descriptors`, `_code_fingerprint` | `test_contracts.py::TestParameterDescriptors` | Implemented; Python-coupled |
| Canonical JSON and SHA-256 | `sdk/python/src/igris/canonical.py`; `igris-overture/internal/canonicaljson/canonicaljson.go` | Python canonical tests; Go canonical package tests; contract-v1 conformance test | Implemented for covered values; number/duplicate/Unicode domain incomplete |
| Evidence v1 hash/signature construction | `sdk/python/src/igris/journal.py::unsigned_payload`, `event_digest`, `finalize_event` | `test_journal.py`; Go `TestEventHashesAndSignatures` | Implemented |
| File-journal ordering and durability | `journal.py::FileJournal.append_event` | `test_journal.py::TestChaining`, `TestConcurrency`, `TestCorruptTail` | Implemented for this store; not a universal storage topology |
| Local Ed25519 identity and truncated key ID | `sdk/python/src/igris/identity.py` | `test_identity.py` | Implemented; self-asserted and collision-prone at global scale |
| Decision-before-execution and denial | `sdk/python/src/igris/guard.py::guard` | `test_guard.py::TestApproval`, `TestFailClosed` | Implemented |
| Sync/async retrofit wrapper | `sdk/python/src/igris/wrap_tool.py` | `test_wrap_tool.py::TestDecoratorEquivalence`, `TestCallableCategories` | Implemented binding behavior, not protocol primitive |
| Post-execution evidence-incomplete error | `guard.py::_record_outcome_or_raise`; `sdk/python/src/igris/errors.py::ExecutionCompletedEvidenceError` | `test_guard.py::test_outcome_write_failure_*` | Implemented |
| BaseException/cancellation gap | `guard.py` and `wrap_tool.py` catch `Exception` | async and failure coverage in `test_wrap_tool.py`; source inspection for BaseException path | Implemented limitation; no signed cancellation |
| Python offline verification | `sdk/python/src/igris/verification.py` | `test_verification.py::TestDetection` | Implemented structural/crypto/chain checks; no transition/trust model |
| Go ingest verification | `igris-overture/api/evidence_verify.go` | `routes_evidence_test.go::TestEvidenceVerifyAcceptsPythonFixtureJournal`, `TestEvidenceVerifyTamperAndTransitionRejections` | Implemented with stricter fields/transitions than Python |
| Connected contract synchronization | `sdk/python/src/igris/connected.py`; `igris-overture/api/routes_contracts.go` | `test_connected.py::TestGuardSynchronization`; contract route tests | Implemented; explicit config, pre-execution, fail-closed |
| Explicit evidence synchronization and privacy preflight | `sdk/python/src/igris/evidence_sync.py`, `evidence_privacy.py` | `test_evidence_sync.py::TestLocalValidationBeforeNetwork`; privacy tests | Implemented; guard does not upload |
| Tenant-bound first verified key registration | `igris-overture/api/routes_evidence.go::handleEvidenceBatchSubmit`, `persistEvidenceBatch` | `TestEvidenceTenantComesFromAuthContext`, `TestEvidenceSubmitBodyTenantAndProvenanceFieldsRejected` | Implemented service observation; not universal identity |
| Embedded provenance separation | `routes_evidence.go`, storage constraints | `TestEvidenceSourceNeverTouchesManagedReceiptStorage`; wrapper security tests | Implemented |
| Tail deletion limitation | previous-hash chain and absence of checkpoint | `test_verification.py::test_tail_deletion_not_detectable_documented_limitation` | Confirmed |
| Actual language-neutral vector suite | none; `spec/test-vectors/README.md` is design only | Existing point-in-time fixtures only | Proposed, not implemented |

Two current-state statements require correction:

- RFC 002 says “all guarded calls write a decision.” Calls can fail before a
  decision during argument binding, Connected configuration/sync, redaction,
  canonicalization, identity loading, or approval-provider evaluation. The
  correct statement is: every invocation that obtains a valid provider
  decision attempts to durably record it, and application execution is
  forbidden until an allowed decision is durable.
- RFC 005 approximately maps an allowed decision to Executing. The code writes
  the allowed event before invoking the callable. A crash can occur between
  those operations. For evidence consumers, allowed-without-outcome means
  **execution occurrence unknown**, not Executing.

An older statement in `docs/architecture/igris-progressive-contract-v1.md`
says Connected sync failures must not block local execution. Current source and
tests do block execution after explicit Connected enablement. The RFC suite is
correct to follow the current implementation, but the older document must be
marked superseded in a later documentation-only cleanup.

## Normative statement classification register

This register classifies every RFC section containing RFC 2119 terms. A row
applies to all normative clauses in the named section; descriptive “Current”
claims are classified by the source register above. “Proposed” means suitable
direction but not implemented. “Underspecified” or “contradictory” is unsafe to
freeze.

| RFC and normative section(s) | Classification | Senior disposition |
| --- | --- | --- |
| RFC 000: problem invariant | Implemented + proposed | Freeze historical verifiability; retain schema-bump rule |
| RFC 000: product/protocol and reference model | Proposed | Freeze separation; remove any implication that Python is normative |
| RFC 000: open-specification principles | Proposed | Freeze claim separation and offline Embedded requirement |
| RFC 000: commercial boundary | Proposed | Freeze cloud independence; add artifact export requirement |
| RFC 000: governance | Underspecified | Name actual approvers, registry owner, and release process before stable status |
| RFC 000: compatibility philosophy | Proposed + underspecified | Freeze historical support; define exact reader/writer compatibility per schema |
| RFC 000: proposal process and feature freeze | Proposed | Freeze as program governance |
| RFC 001: normative terminology | Contradictory | Replace with one suite-wide rule; currently conflicts with most RFCs |
| RFC 001: protocol objects | Proposed | Freeze conceptual separation, not serialized existence |
| RFC 001: ActionContract | Implemented + proposed | Freeze v1 interpretation; v2 identity is blocked |
| RFC 001: Action instance | Proposed + underspecified | Freeze concept; do not implement until identifier scope is settled |
| RFC 001: Decision and Outcome | Implemented + proposed | Freeze narrow observations and non-claims |
| RFC 001: Evidence event/chain | Implemented + proposed | Freeze v1 bytes and continuity/completeness split |
| RFC 001: signing reference | Implemented + unsafe for new format | Preserve v1; require full collision-resistant v2 reference |
| RFC 001: verification result | Proposed + underspecified | Freeze decomposed dimensions; define an actual schema and remove universal `overall` |
| RFC 001: correlation/causation | Proposed | Freeze non-inference; defer signed general relationships |
| RFC 001: deployment/Connected | Implemented + proposed | Freeze participation/provenance separation |
| RFC 001: versioning | Proposed + contradictory placement | Freeze immutable v1 and pre-interpretation dispatch after normative grammar fix |
| RFC 001: capability negotiation | Underspecified | Defer a negotiation object; freeze no silent downgrade |
| RFC 002: Action definition | Proposed | Freeze Action as static declaration; invocation is separate |
| RFC 002: Action identity | Underspecified | Do not freeze global semantics until namespace and implementation split are chosen |
| RFC 002: intent | Proposed but unnecessary | Keep human descriptions outside minimum semantic hash |
| RFC 002: input descriptors | Implemented Python artifact + underspecified v2 | Preserve v1; define a small portable v2 vocabulary before producer work |
| RFC 002: risk | Implemented | Freeze as asserted policy input, not objective truth |
| RFC 002: approval requirement | Implemented + proposed | Freeze minimum requirement meaning; rich policy stays outside v1 |
| RFC 002: redaction requirements | Underspecified | Decide disclosure/commitment profile before ActionContract/Evidence v2 |
| RFC 002: execution contract | Implemented + proposed | Freeze non-ownership; reject runtime orchestration semantics |
| RFC 002: evidence requirements | Underspecified | Define required lifecycle event profile before ActionContract v2 |
| RFC 002: Action-instance identity | Proposed + underspecified | Required before Evidence v2; scope/format still open |
| RFC 002: static description/invocation | Proposed | Freeze separation and no-network inspection |
| RFC 002: decorator/wrapper, inspectability | Implemented binding + proposed binding guidance | Keep out of wire protocol; retain conformance-level ergonomics only |
| RFC 002: immutability | Ambiguous | Freeze immutable serialized contract; separate Action identity from contract version |
| RFC 002: nested actions/workflow exclusion | Proposed | Freeze correlation non-inference and v1 workflow exclusion |
| RFC 003: claims/non-claims | Implemented + proposed | Freeze |
| RFC 003: field tables and required/optional fields | Implemented + underspecified | Freeze exact v1 bytes; vector-pin conditional fields before formal conformance |
| RFC 003: event registry/transitions | Partially implemented | Freeze known v1 types; reconcile Python/Go semantic profiles |
| RFC 003: sequence/previous hash | Implemented + proposed | Preserve v1; require stream/sequence design for v2 |
| RFC 003: canonical encoding | Unsafe to freeze | Number, duplicate-key, Unicode scalar, escaping, and ordering rules incomplete |
| RFC 003: hash/signature input | Implemented for v1 | Freeze v1 forever; require framed domain separation for v2 |
| RFC 003: algorithms/key identifiers | Implemented v1 + underspecified v2 | Preserve v1; choose one signed v2 suite ID and full signer reference |
| RFC 003: timestamps/contract references | Implemented + proposed | Freeze producer-time non-claim and separate contract resolution |
| RFC 003: unknown fields | Contradictory across consumers | Define cryptographic inclusion separately from semantic and ingest acceptance |
| RFC 003: size/privacy/sanitization | Mixed product/protocol | Freeze safety principles; keep concrete limits and redactors in profiles |
| RFC 003: chain/partial chain | Partially implemented + proposed | Freeze continuity/completeness split; define anchor/checkpoint vocabulary |
| RFC 003: schema evolution/historical verification | Proposed | Freeze listed schema-bump triggers and historical dispatch retention |
| RFC 004: integrity/attribution/trust split | Proposed, source-consistent | Freeze |
| RFC 004: private-key handling and self-asserted mode | Implemented + proposed | Freeze |
| RFC 004: TOFU/BYOK | Proposed optional policy | Safe to defer from signed format |
| RFC 004: Connected organization binding | Implemented service behavior | Do not promote to universal identity |
| RFC 004: trust store/registration | Proposed + underspecified | Freeze minimum slots; defer wire/service topology |
| RFC 004: rotation/revocation/compromise | Proposed + underspecified | Required for Connected GA, not required to verify self-asserted local evidence |
| RFC 004: cross-organization/offline verification | Proposed | Freeze offline integrity; keep federation open |
| RFC 004: transparency/hardware/workload identity | Proposed optional | Explicitly defer |
| RFC 005: lifecycle model | Contradictory at Allowed/Executing boundary | Revise before freeze; separate runtime state from evidence conclusion |
| RFC 005: Prepared/decision/Allowed/Denied | Implemented + proposed | Freeze fail-closed ordering and durable-decision requirement |
| RFC 005: Succeeded/Failed/evidence incomplete | Implemented + proposed | Freeze narrow observation and non-retryable post-write failure |
| RFC 005: Cancelled/Expired | Underspecified | Defer signed states |
| RFC 005: legal transitions | Partially implemented | Freeze v1 core transitions after correcting execution inference |
| RFC 005: sync/async semantics | Implemented + binding guidance | Freeze ordering, not host concurrency model |
| RFC 005: BaseException/crash | Implemented limitation + proposed | Freeze unresolved interpretation |
| RFC 005: provider/evidence-write failures | Implemented + proposed | Freeze |
| RFC 005: idempotency/timeouts/suspension | Proposed non-claims | Freeze no-exactly-once; defer durable suspension/deadlines |
| RFC 006: provider abstraction | Proposed | Keep behavioral and non-normative at wire layer |
| RFC 006: approval/signing/evidence providers | Partially implemented | Freeze failure order; do not freeze class/interface topology |
| RFC 006: registry/clock/identifier providers | Partially implemented + proposed | Keep implementation-specific; freeze only observable requirements |
| RFC 006: defaults/deny/no-network | Implemented + proposed | Freeze |
| RFC 006: Connected/dependency/configuration | Implemented + proposed | Freeze explicit enablement, precedence, and no silent fallback |
| RFC 006: testing/language guidance | Proposed binding conformance | Freeze fixture-key safety; keep API shapes non-protocol |
| RFC 007: conformance levels | Proposed + over-broad at C4/C5 | Freeze C1/C2 wire conformance; rename binding/transport profiles |
| RFC 007: vector families | Proposed | Required before second implementation; expand canonical boundary cases |
| RFC 007: expected results | Proposed + underspecified | Version schema; split continuity/completeness; remove universal overall validity |
| RFC 007: deterministic generation/golden governance | Proposed | Freeze |
| RFC 007: runner contract/contribution/backward compatibility | Proposed | Freeze after suite revision semantics are exact |
| RFC 008: binding invariants | Proposed | Freeze only wire/failure/no-network invariants |
| RFC 008: callable/error/sync-async guidance | Implemented Python + proposed | Retain as binding profile, not core wire protocol |
| RFC 008: canonicalization/verification | Proposed + blocked | Freeze after canonical and result schemas exist |
| RFC 008: provider/key/packaging/version mapping | Proposed | Suitable binding conformance requirements |
| RFC 008: Python limitations/TS-Go/Rust | Descriptive + strategic | Freeze non-copying guidance; keep Rust deferred |

## RFC-by-RFC findings

### RFC 000 — Protocol program charter

The charter is acceptable with revision. Its strongest decisions are open
interoperability, historical verification, claim precision, and a feature
freeze. Its governance is not operationally complete: “designated protocol
owner,” registry ownership, security approval, vector release, and errata
authority must be named before any RFC becomes stable. The protocol/commercial
boundary also needs an explicit right to export evidence, keys, trust metadata,
checkpoints, and historical schemas.

### RFC 001 — Igris Protocol v1

The object decomposition is sound. Calling the umbrella “Protocol v1” while
most logical objects are not serialized risks implying stability that does not
exist. Use “schema `1` compatibility profile” for current artifacts and reserve
an Igris Protocol release number for an approved suite. The normative-language
rule contradicts the rest of the suite. The decomposed verification model is
correct but not yet a schema.

### RFC 002 — Action model

Action can be defined without Python: a stable declaration in a publisher
scope, with immutable contract versions and distinct invocation instances.
The draft correctly makes decorators and `wrap_tool` adapters. It must stop
using current `action_id` as anything stronger than a Python code-location
hint, correct the “all guarded calls” statement, and settle publisher namespace
plus semantic contract hashing before ActionContract v2.

### RFC 003 — Evidence envelope

The claim and non-claim sections are strong. The v1 field/signature account is
source-accurate. The canonical profile is not complete enough for a new format,
and the suite cannot yet define an independent verifier for arbitrary numeric
or adversarial JSON. Unknown fields currently have three different dimensions:
they are included cryptographically, semantically uninterpreted, and sometimes
rejected by Connected security policy. Those dimensions must be named rather
than collapsed into “accepted.”

### RFC 004 — Identity and trust

The trust model correctly rejects signature-as-identity. The minimum local mode
can remain self-asserted. Before external v2 evidence, the format must carry an
unambiguous full signer reference and verifiers must have trust-result slots.
A global PKI, mandatory cloud, transparency log, attestation, and trusted time
remain unnecessary. Rotation/revocation records are external trust artifacts,
not evidence events by default.

### RFC 005 — Execution semantics

The core ordering is correct, but the state diagram mixes internal runtime
states, durable evidence, authorization validity, and evidence completeness.
Allowed does not prove invocation. Expired is a property of authorization;
evidence incomplete is an orthogonal evidence condition. Cancel request and
observed cancellation are also distinct. Freeze only the current core state
facts and defer signed cancellation/expiry.

### RFC 006 — Runtime provider model

Provider behavior is useful binding architecture, not wire protocol. Freeze
observable ordering, explicit configuration, fail-closed behavior, durability,
and no hidden networking. Do not standardize Python interfaces, dependency
injection, files, environment names, or synchronous provider topology.

### RFC 007 — Conformance and test vectors

The proposed families and governance are directionally correct. There is no
actual language-neutral suite today, so conformance is not ready. C1 and C2 are
core protocol conformance. C3 is producer conformance. C4 and C5 combine
product/binding/transport behavior and should be named profiles rather than a
linear claim that one is “more protocol conformant.” The common result shape
must be versioned and must not define a universal policy-level `overall` value.

### RFC 008 — Language binding guidelines

This is strong guidance: independent implementations, normal host ergonomics,
offline core, explicit errors, and no required lazy object. Canonicalization
and verification obligations cannot become normative until the missing v2
decisions and vectors exist. TypeScript should follow vectors, not Python
architecture. Rust remains unjustified.

## Critical architectural corrections

1. Establish one normative grammar across the suite and make status/precedence
   explicit.
2. Separate the immutable schema `1` compatibility profile from the future
   protocol release name.
3. Define parsing before canonicalization: UTF-8 validity, one JSON value,
   object-only where required, duplicate rejection, depth/size bounds, and no
   trailing content.
4. Define a deliberately small numeric domain. The recommended v2 core uses
   integers only with a fixed range; arbitrary application numbers remain in
   application payloads or separately specified commitment profiles.
5. Define valid Unicode scalar strings with no implicit normalization and one
   exact key-order/escape rule.
6. Make semantic Action identity `(publisher_namespace, action_name)` and keep
   implementation bindings separate.
7. Correct Allowed-without-outcome to execution-unknown for verifiers.
8. Replace truncated v2 key IDs with a full algorithm-qualified fingerprint or
   collision-resistant equivalent.
9. Use one signed signature-suite identifier plus unambiguous domain-separated
   framing; do not add loosely coupled algorithm fields.
10. Split verification into parse, schema, canonical/integrity, key resolution,
    continuity, completeness, semantics, trust, authorization-policy, and time
    confidence. A universal `overall_valid` is not protocol truth.
11. Separate core conformance from binding and Connected transport profiles.
12. Require exportable historical verification artifacts at the commercial
    boundary.

## Action model decision

**Candidate decision:** Action is only the static semantic declaration. An
ActionContract is one immutable serialized version of that declaration. An
Action instance begins when a runtime creates an opaque invocation identifier
and binds invocation context. Invocation is not the Action.

Semantic Action identity is `(publisher_namespace, action_name)`. Contract
identity is the schema-qualified digest of policy-relevant semantic fields.
Implementation identity is a separate binding/artifact reference and must not
affect semantic contract identity. For ActionContract v2, identity-affecting
fields should be limited to namespace/name, portable input shape, declared
risk/decision requirement, evidence/disclosure requirement profile, and any
explicit execution capability requirement. Provider instances, input values,
caller/session, trace context, deadlines, idempotency keys, and transport
configuration belong to invocation context.

`wrap_tool`, decorators, annotations, builders, and callable objects remain
binding concerns. Normal call/await ergonomics remains primary. Static
inspection must not invoke application code or require networking. Nested
Actions are independent instances; any relationship is correlation unless a
future signed causation profile is explicitly adopted. No `andThen`, fibers,
sagas, compensation, DAG, or workflow ownership enters Protocol v1.

## Evidence model decision

Evidence is a signed producer assertion about one lifecycle fact. Successful
integrity verification proves bytes relative to a key and schema. It does not
prove key trust, authorization, honest execution, complete history, trusted
time, or external side effects.

The minimum additional Evidence v2 commitments recommended before external
emission are:

- a globally unambiguous schema/object identifier;
- a signed signature-suite identifier;
- an algorithm-qualified full signer fingerprint/reference;
- a signed `stream_id` and monotonic `sequence`;
- a signed opaque `action_instance_id` shared by that instance's events;
- a schema-qualified ActionContract reference;
- the existing event identity/type, previous hash, producer timestamp,
  lifecycle payload, event hash, and signature; and
- version-specific domain-separated signature framing.

`correlation_id`, general `causation_id`, parent Action, trace IDs, trusted-time
claims, attestation, transparency inclusion, provider reason, human identity,
and external receipts are not minimum v2 fields. They may remain external
metadata or future typed extensions. Action name may be a projection resolved
from the contract reference rather than duplicated signed identity.

Sequence plus a stream ID detects internal gaps relative to an anchor; it still
does not prove the latest tail without a trusted checkpoint. Unknown fields
must be included in cryptographic reconstruction only if the schema declares an
extension container. Required security semantics never arrive as anonymous
unknown fields.

## Identity and trust decision

The minimum trust slots that must exist before externally exchanged Evidence
v2 are:

| Slot | Required meaning |
| --- | --- |
| Signer key | Full public key/fingerprint and signature suite; no truncated-only lookup |
| Trust scope | Local, organization, bilateral, or other named relying scope |
| Subject binding | Optional person/org/workload identifier plus binding type; unknown is valid |
| Binding authority | Who asserted the binding and by what authenticated provenance |
| Status interval | Active, revoked, compromised, suspended, or unknown with effective/recorded times |
| Time confidence | Producer-asserted, receipt-observed, checkpoint-bounded, or trusted; never silently upgraded |
| Evaluation context | Evaluation time and trust-policy version |
| Artifact availability | Schema, algorithm, key, revocation snapshot, and checkpoint retention/export status |

These slots may all evaluate to unknown for self-asserted offline evidence.
That does not make a valid signature invalid. Organization attribution must
come from an external scoped binding. Connected may operate that binding, but
the open trust-bundle/export format must allow independent historical
verification after service exit.

TOFU and BYOK remain optional policies. Rotation must introduce new key
material without rewriting history. Revocation changes trust evaluation, not
the mathematical signature result. Producer timestamps cannot establish a
safe pre-compromise interval. No global PKI, cloud root, trusted clock,
transparency log, hardware identity, or attestation is mandatory.

## Execution semantics decision

Freeze this minimal lifecycle:

```text
declaration resolved
  -> invocation prepared
  -> decision evaluation
     -> denied (terminal; durable denial, no invocation)
     -> allowed (durable authorization observation)
        -> invocation attempted (runtime fact, not inferable from v1 evidence)
           -> returned
           -> raised ordinary failure
           -> execution occurrence/outcome unresolved
```

Evidence status is evaluated separately:

```text
complete for required events | incomplete | unknown/unverified
```

Pre-execution failure prevents application invocation and must never emit an
allowed decision. Post-execution evidence failure must report execution
occurred, evidence incomplete, and retry unsafe. An allowed decision without an
outcome is execution-unknown to a verifier. A succeeded outcome is an observed
return, not external-effect proof. A failed outcome does not prove rollback.

Cancellation request, observed cancellation, timeout, authorization expiry,
durable suspension, and restart repair are not frozen signed states. Host
bindings may expose them honestly without synthesizing v1 outcomes. Exactly-
once execution is explicitly rejected.

## Canonicalization and versioning decisions

The detailed classification is in
[`protocol-design-freeze-matrix.md`](protocol-design-freeze-matrix.md). The
candidate v2 canonical profile is intentionally smaller than general JSON:

- exactly one UTF-8 JSON value of the required top-level type;
- duplicate object names rejected before object construction;
- valid Unicode scalar values only, no implicit normalization;
- one exact scalar/UTF-8 key ordering and minimal escape rule;
- `null` distinct from absent and permitted only by schema;
- booleans, strings, arrays, objects, and bounded canonical integers only;
- no floats, exponent spellings, NaN, infinity, or arbitrary JSON numbers in
  the signed core;
- closed required core fields plus explicitly named extension points;
- schema dispatch before semantic or cryptographic interpretation; and
- unambiguous domain-separated, length-framed signature input.

The exact integer bounds, schema-ID syntax, ordering definition, suite ID, and
domain bytes remain senior decisions and block v2 implementation. Evidence v1
and ActionContract v1 retain their legacy Python-compatible algorithms forever;
v2 rules must never be backported under schema `1`.

## Conformance readiness

An independent engineer **cannot yet** implement a complete conforming verifier
from the spec and proposed vectors alone. There is no actual manifest suite,
the common result is conceptual, conditional field rules are incomplete, and
canonical edge cases are unresolved.

The minimum viable suite before TypeScript SDK work is:

1. a versioned manifest and expected-result schema;
2. exact C1 bytes for valid and invalid Unicode, ordering, escapes, null,
   integer bounds, duplicate keys, trailing data, depth, and malformed input;
3. ActionContract v1 body/hash vectors, including unknown/missing/extra fields;
4. Evidence v1 decision/outcome/hash/signature/chain vectors;
5. invalid cases distinguishing malformed, unsupported, invalid signature,
   tampered hash, unknown/ambiguous key, untrusted, revoked, partial,
   incomplete, invalid transition, and unresolved outcome;
6. an external-anchor segment and a tail-truncated valid-but-unwitnessed case;
7. deterministic clearly test-only keys and reproducible generation;
8. immutable released suite revisions with protocol/security approval; and
9. Python plus standalone Go runners that consume only the manifest.

A breaking vector change is any change to canonical bytes, hash/signature,
field meaning, required result code/dimension, acceptance status, or vector ID
meaning. It requires a new schema or suite revision; released goldens are not
edited in place.

## Second implementation recommendation

Build a **standalone Go verifier first**, not a Go SDK. This is the smallest
independent implementation that tests the specification rather than product
adoption. It should have no database, network, Connected dependency, or Python
runtime; consume the public manifest/vectors; verify supplied bundles offline;
and emit the versioned decomposed result.

The existing Go server verifier is useful independent evidence, but it is
coupled to ingest policy and storage lookups. A standalone verifier forces the
spec to carry all required meaning.

After that passes released v1 and draft-v2 vectors, a TypeScript C1/C2 verifier
is the stronger ecosystem/adoption test. A TypeScript producer/binding should
begin only after ActionContract v2 and Evidence v2 are frozen and dual-language
verification exists. Success means exact canonical bytes and signatures in
both directions, identical typed results for all negative vectors, zero Python
runtime dependency, and no copied Python API architecture.

## Protocol versus commercial boundary

Open protocol surface:

- normative RFCs, schema and algorithm registries;
- Evidence and ActionContract formats;
- canonicalization, hashing, signing, and verification rules;
- verification-result and trust-bundle/export schemas;
- conformance vectors, runner contract, and golden governance;
- at least one offline verifier and reference binding; and
- historical schema/algorithm materials required to verify exported evidence.

Commercial Connected surface:

- organization identity administration and authenticated binding workflows;
- managed key registration, rotation, revocation distribution, and recovery;
- shared verification, retention, checkpoints, search, audit views, exports,
  policy coordination, operational controls, SLAs, and support.

Commercial operation may be proprietary; interoperability artifacts cannot be
service-locked. A departing user must be able to export original evidence,
contracts, public keys, binding provenance, revocation snapshots, checkpoints,
schema/suite identifiers, and verification-policy metadata sufficient for
independent historical evaluation.

## Design-freeze decisions

The candidate freeze is **conditional GO** for the small invariants listed in
the executive summary and **NO-GO** for any new signed format or producer. The
matrix is authoritative for per-decision classification. Approval of this
review does not approve any unresolved item in the open-decision register.

## Unresolved decisions requiring human senior review

The blocking decisions, owners, recommended resolutions, and implementation
gates are in [`protocol-open-decisions.md`](protocol-open-decisions.md). None
may be silently chosen in SDK code.

## Recommended next implementation sequence

The exact gated sequence is in
[`protocol-next-implementation-sequence.md`](protocol-next-implementation-sequence.md).
In short: correct/freeze prose; publish actual v1 schemas/results/vectors;
build the standalone Go verifier; freeze ActionContract v2; freeze Evidence v2
and trust slots; implement verifiers before producers; then consider a
TypeScript binding and Connected dual-version support.

## Explicitly deferred work

- workflow composition, DAGs, `andThen`, fibers, sagas, and compensation;
- durable suspension/resume and remote approval workflow;
- signed cancellation/expiry/repair events;
- global PKI, mandatory cloud identity, or mandatory transparency log;
- trusted time, hardware/workload identity, and attestation;
- managed execution or proof of external side effects;
- Rust core, WASM module, sidecar, shared scheduler, or execution engine;
- TypeScript producer, full Go SDK, or additional language SDK;
- universal application payload schema or general observability envelope.

## Files changed

This review adds only the four required Markdown review artifacts under
`docs/rfcs/`. No RFC draft, ADR, source, test, fixture, schema, migration,
backend, SDK, database, or deployment file is modified.

## Branch and commit status

The authoritative input is branch `rfc/igris-protocol-foundation` at
`73e0a5ab8cf95eb114a16f0e76c808c168de9c00`, based on
`1ef093a96dc8ae55c317266aa9b0dc94e5b08579`. Review commits are added after
that tip, preserve the five original RFC commits, and must remain unpushed and
unmerged unless separately authorized.
