# RFC 000: Igris protocol program charter

Status: **Draft**
Audience: protocol maintainers, SDK authors, service implementers, reviewers
Scope: governance and compatibility; no production implementation

Normative status: requirements in this RFC are candidate requirements governed
by the artifact precedence below. They become normative only when a release
manifest records human ratification.

## Problem statement

Igris began with an SDK-first developer experience: guard an ordinary callable,
obtain a decision, execute locally, and write signed evidence. Alpha.2 now has
two independent canonicalization/verification paths, explicit Connected
contract/evidence synchronization, and committed cross-language fixtures. The
long-term product therefore cannot be defined only by Python decorators or by
one service implementation.

The protocol program exists to make the portable claims precise: which bytes
are signed, what an Action means, which lifecycle transitions are valid, what
a signature proves, and how an independent verifier reaches a typed result.

**Current:** ActionContract schema `1` and Evidence schema `1` are implemented
in `sdk/python/src/igris/contracts.py` and `sdk/python/src/igris/journal.py`.
Go reproduces the Python bytes and signatures for the current fixtures in
`conformance/contractv1/canonical_conformance_test.go` and verifies those
covered ingested values in `igris-overture/api/evidence_verify.go`. This is not
general schema `1` equivalence: current Go re-encoding is known non-conforming
for U+2028/U+2029.

**Draft invariant:** Protocol work MUST preserve verifiability of already
emitted evidence. A design improvement is not permission to reinterpret
signed bytes.

## Product versus protocol distinction

The **protocol** is the language-neutral set of object meanings, encoding and
cryptographic rules, verification outcomes, lifecycle constraints, versioning,
and conformance artifacts. The **product** includes SDK ergonomics, hosted
coordination, enterprise trust administration, retention, search, operations,
and managed execution.

An Igris product MAY implement more than the protocol. It MUST NOT label a
product-specific claim as protocol-conformant unless a conformance level covers
that claim.

## Reference implementation model

The Python SDK is the current reference implementation because it emits the
adopted v1 artifacts. It is not automatically the specification. Where prose,
fixtures, and code disagree during the draft period:

1. the disagreement is recorded as a specification defect rather than choosing
   deployed behavior as normative;
2. existing schema `1` fixtures continue to pin the exact historical bytes and
   verification cases they enumerate;
3. construction of a disputed future object fails closed until the candidate
   artifacts agree; and
4. an RFC erratum may clarify but never alter released bytes/meaning; a semantic
   or byte change uses a new schema/release.

Independent implementations MUST be possible without importing Igris code.
Shared implementation code is optional and is not evidence of conformance.

## Normative artifact precedence

An Igris protocol release is identified by an immutable release manifest that
pins the identifiers and hashes of its normative artifacts:

1. ratified RFC requirements define meaning, claims, and compatibility;
2. referenced canonicalization specifications and registries define exact
   bytes and registered identifiers in their delegated scope;
3. machine-readable schemas define mechanically expressible shape; and
4. released vectors define exact inputs, bytes, and results for enumerated
   cases.

These artifacts MUST agree. A conflict is a specification defect, not a choice
for an implementation. Construction fails closed; verification reports
`specification_conflict` when affected; the protocol owner issues an erratum or
new release. An erratum MUST NOT change released bytes, signatures, vector
outcomes, or historical meaning. Reference implementations and deployed
product behavior are non-normative and MUST NOT become normative accidentally.

The full candidate resolution is
[`protocol-resolved-decisions.md`](protocol-resolved-decisions.md#rd-01--normative-protocol-contract-and-precedence).

## Open specification principles

- Specifications, schemas, registries, threat boundaries, and non-secret test
  vectors SHOULD be publicly reviewable.
- Normative requirements MUST be separable from examples and product copy.
- Claims MUST distinguish integrity, continuity, attribution, authorization,
  environment trust, and external-side-effect truth.
- Canonical construction and verification MAY be deterministic. External
  execution MUST NOT be described as deterministic merely because its evidence
  encoding is deterministic.
- Embedded operation MUST remain possible without an account or network.
- Extensions MUST be explicitly versioned or capability-negotiated.

## Commercial boundary

The protocol and conformance materials define interoperability. Hosted and
enterprise offerings may monetize authenticated organization binding, shared
policy and approval coordination, trust stores, revocation distribution,
transparency witnesses, retention, search, exports, operational controls, and
managed execution.

No commercial service is required to perform local cryptographic verification.
The Igris cloud MUST NOT be made a root of trust for all deployments.

## Governance model

The initial model is maintainer-led and proposal-driven:

- RFC editors maintain normative text and registries.
- Security reviewers approve cryptographic or trust-model changes.
- SDK maintainers confirm language implementability.
- Service maintainers confirm transport and storage implications.
- A designated protocol owner records acceptance, rejection, or deferral.

During the draft program, “accepted RFC” means repository governance approval;
it does not mean industry consensus or standards-body recognition.

Registry additions that cannot affect signed interpretation may use normal
review. Changes to signed fields, canonical bytes, algorithm identifiers,
version semantics, or verification meaning require an RFC, vectors, migration
analysis, and security review.

The protocol owner also owns release manifests and errata. The conformance
owner owns vector-suite releases. Cryptographic changes require a named
cryptography/security approval. A release is not ratified until these roles and
the SDK implementability reviewers approve one exact candidate tip.

## Compatibility philosophy

Readers and verifiers SHOULD be liberal only where the relevant schema says
that an extension is safe. Writers MUST emit one exact supported schema.
Unknown schemas fail closed with a typed unsupported result; they are not
invalid signatures merely because the verifier does not understand them.

Historical verification is a permanent requirement. A conforming verifier
SHOULD retain or make obtainable the algorithm, schema, public key, trust
metadata, and revocation-time information needed to evaluate old evidence.

Protocol compatibility and product API compatibility are separate. An SDK may
add an adapter or improve an exception without changing the protocol. It may
not change signed construction under the same schema.

## Decision-making process

Every protocol proposal MUST state:

1. current implemented behavior with exact source/tests;
2. the proposed invariant and threat boundary;
3. compatibility with existing journals and contracts;
4. required schema/version changes;
5. test-vector and conformance effects;
6. rejected alternatives and unresolved questions.

Irreversible decisions receive additional scrutiny before external evidence
is generated: version dispatch, canonical number/string rules, signature input,
domain separation, key and algorithm identifiers, unknown-field semantics,
chain/stream identity, stable action identity, and verification result taxonomy.

## Feature-freeze boundary

Until RFCs 001–008 receive explicit approval, protocol development is frozen
to research, specification, schemas, and test design. No draft text authorizes:

- changes to ActionContract v1 or Evidence v1 bytes;
- new signed production fields;
- a new canonicalizer or signing algorithm;
- workflow composition or durable remote approval;
- a Rust engine, WASM core, or sidecar;
- additional production SDKs;
- Managed execution behavior.

Security fixes to existing implementations remain possible, but any fix that
alters v1 interpretation requires a separate compatibility decision.

## Non-goals

- Selecting Rust or a shared execution engine.
- Defining a workflow language, DAG, queue, scheduler, or fiber system.
- Guaranteeing exactly-once execution or external side effects.
- Creating a global PKI or requiring Igris cloud identity.
- Standardizing application payload schemas.
- Treating evidence as full logs, traces, metrics, or observability.
- Claiming protocol stability, consensus, or external standard status.
