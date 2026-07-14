# RFC 000: Igris protocol program charter

Status: **Draft**
Audience: protocol maintainers, SDK authors, service implementers, reviewers
Scope: governance and compatibility; no production implementation

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
Go reproduces the Python bytes and signatures in
`conformance/contractv1/canonical_conformance_test.go` and verifies ingested
evidence in `igris-overture/api/evidence_verify.go`.

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

1. existing signed Evidence v1 bytes remain interpreted by the shipped v1
   verification algorithm;
2. golden vectors decide byte-level conformance;
3. an RFC correction clarifies intent without retroactively altering bytes;
4. a semantic change uses a new schema version.

Independent implementations MUST be possible without importing Igris code.
Shared implementation code is optional and is not evidence of conformance.

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
