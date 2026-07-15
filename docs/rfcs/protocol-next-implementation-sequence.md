# Igris protocol next implementation sequence

Status: **Candidate sequence after senior approval**

This is a gated order, not authorization to implement. Protocol work and
product work remain separate. No stage may start merely because a prior draft
exists; its exit evidence must be reviewed.

## Sequence overview

```text
0. Senior decisions and RFC corrections
   -> 1. Released schema-1 conformance baseline
      -> 2. Standalone Go verifier
         -> 3. ActionContract v2 freeze and read-path proof
            -> 4. Evidence v2 freeze and verifier-first proof
               -> 5. Opt-in reference producer
                  -> 6. TypeScript verifier, then binding
                     -> 7. Connected dual-version readiness
                        -> 8. GA trust, export, and operations gate
```

## Stage 0 — Resolve the design-freeze blockers

Protocol work only; documentation, schemas, registries, and vector design.

Required work:

1. resolve OD-01 through OD-09 in
   [`protocol-open-decisions.md`](protocol-open-decisions.md);
2. revise RFCs 000–008 so one normative grammar applies suite-wide;
3. correct “all guarded calls write a decision” and Allowed-to-Executing
   inference;
4. mark stale architecture statements superseded where current source differs;
5. approve canonical data model, schema IDs, signature suite/framing, Action
   identity, Evidence identity, lifecycle table, and result schema; and
6. record named protocol/security approvals and registry ownership.

Exit gate:

- no unresolved byte-affecting choice is delegated to an SDK implementer;
- every approved invariant has an explicit compatibility consequence;
- Evidence v1 and ActionContract v1 remain unchanged; and
- the work is still documentation/schema/vector design only.

## Stage 1 — Release the schema `1` conformance baseline

Protocol-conformance work, not a product feature.

Required work:

1. create actual language-neutral manifests and expected-result schemas;
2. import existing ActionContract v1/Evidence v1 fixtures without altering
   their historical bytes;
3. add deterministic additive vectors for canonical valid/invalid boundaries;
4. add malformed, unsupported, tampered, invalid-signature, unknown-key,
   ambiguous-key, untrusted, revoked, partial, incomplete, and transition
   cases;
5. label all fixture private keys `TEST ONLY` and ensure no production path can
   load them;
6. publish suite revision and breaking-change policy; and
7. adapt Python and existing Go tests to consume the manifest independently.

Exit gate:

- clean deterministic regeneration in a temporary directory;
- exact bytes/hashes/signatures independently reproduced;
- Python and Go agree on the versioned result schema or document a declared
  profile difference;
- no network, database, service, secret, or mutable golden dependency; and
- released goldens are immutable.

## Stage 2 — Build the standalone Go verifier

This is the first independent implementation and the protocol-validation goal.
It is not a Go SDK and not a Connected feature.

Required properties:

- consumes only the public specification, schemas, and vector manifest;
- no Python import/subprocess, shared Python-generated runtime code, database,
  network, or Igris account;
- reads evidence/contracts/keys/trust bundles from files or stdin;
- performs bounded parsing and decomposed offline verification;
- writes the versioned machine-readable result without secrets or payload
  echo; and
- passes every claimed historical positive and negative vector.

Exit gate:

- a clean-room reviewer can implement or audit it without reading Python;
- all C1 and C2 schema `1` vectors pass;
- unsupported capabilities return typed unsupported results; and
- differential fuzz/property tests reveal no unresolved parser or canonical
  divergence.

Why this precedes TypeScript: it isolates protocol ambiguity from adoption/API
questions and creates a small, auditable verifier oracle without copying the
Python binding architecture.

## Stage 3 — Freeze ActionContract v2 before implementation

Prerequisites before any ActionContract v2 code:

- OD-02, OD-04, OD-05, and OD-06 approved;
- publisher namespace syntax and trust non-claim fixed;
- semantic hash field set fixed;
- portable input descriptor vocabulary and evolution rules fixed;
- evidence/disclosure requirement profile fixed or explicitly excluded;
- implementation artifact binding explicitly separate/deferred; and
- ActionContract v2 positive/negative/canonical/hash vectors reviewed.

Implementation order after those prerequisites:

1. add schema-only validators and hash verification in standalone Go and Python
   read paths;
2. prove both implementations agree on every vector;
3. add compatibility inspection tooling that distinguishes v1 Python-origin
   descriptors from v2 semantic descriptors; and
4. only then add an opt-in reference constructor behind an explicit schema
   selection. Do not silently change default emission.

Exit gate:

- identical bytes/hash across two independent implementations;
- namespace collision and unknown-field negative cases pass;
- implementation/source changes do not change semantic hash unless a declared
  semantic field changes; and
- existing v1 contracts remain readable and unchanged.

## Stage 4 — Freeze Evidence v2 and implement verifiers first

Prerequisites before any Evidence v2 producer:

- all Stage 0 byte decisions approved;
- ActionContract v2 reference semantics available or Evidence v2 explicitly
  defines how it references a v1 contract;
- full signer reference and signature suite/framing fixed;
- stream/sequence/event/Action-instance identity fixed;
- exact lifecycle/conditional field table fixed;
- continuity/completeness and result schemas fixed;
- minimum trust slots defined; and
- valid, invalid, tampered, unsupported, untrusted, revoked, partial,
  incomplete, and crash-boundary vectors approved.

Implementation order:

1. standalone Go v2 parser/canonicalizer/verifier;
2. Python v2 parser/canonicalizer/verifier;
3. cross-verifier differential and fuzz tests;
4. historical v1 dual-read regression suite; and
5. security review of framing, downgrade, resource bounds, key ambiguity,
   replay, stream fork, sequence overflow, and unknown-field behavior.

Exit gate:

- two independent verifiers agree without a producer implementation;
- v1 remains fully verifiable;
- no unknown/unsupported case is collapsed into invalid signature;
- no trusted identity/time/external-effect claim is implied; and
- released draft-v2 vectors are stable enough to authorize an emitter.

## Stage 5 — Add an opt-in reference v2 producer

Only after Stage 4. Begin in the Python reference binding because it already
owns current emission behavior, but do not make v2 the default.

Required properties:

- explicit schema selection and no silent downgrade;
- action instance allocated once per attempt;
- stream sequence update atomic with durable append;
- decision durable before invocation;
- post-execution evidence failure remains non-retryable;
- no hidden networking;
- v1 emission unchanged and covered by historical vectors; and
- every emitted artifact accepted by both independent verifiers.

Exit gate:

- producer C3 vectors pass in both verifier implementations;
- crash/concurrency/fork/failure-injection behavior is tested;
- migration/default-emission plan receives separate product approval; and
- no external v2 evidence is emitted before trust/export policy is ready for
  its intended deployment.

## Stage 6 — TypeScript verifier, then TypeScript binding

This stage is the product-adoption test. It is not the first protocol proof.

Prerequisites before any TypeScript SDK:

- released schema `1` suite and draft/stable v2 suite;
- standalone Go plus Python verifier agreement;
- complete number/BigInt and Unicode rules;
- ActionContract v2 portable descriptors fixed;
- Evidence v2 lifecycle/signing/trust results fixed;
- version support/downgrade policy documented; and
- zero-network and fixture-key rules available as binding tests.

Order:

1. TypeScript C1 canonical implementation;
2. TypeScript C2 offline verifier;
3. cross-language read/verify in all directions;
4. only then an idiomatic C3/C4 callable/Promise binding; and
5. optional Connected transport after core offline behavior is complete.

Success criteria:

- exact canonical bytes, hashes, signatures, and results for all vectors;
- Python-produced evidence verifies in TypeScript and Go;
- TypeScript-produced evidence verifies in Python and Go;
- native Promise/cancellation behavior with honest unresolved semantics;
- no Python runtime or shared native core;
- no decorator requirement, lazy-only API, hidden network, or workflow
  abstraction; and
- package artifacts contain no private keys, journals, credentials, or local
  state.

## Stage 7 — Connected dual-version support

Product/service implementation, separate from protocol approval.

Prerequisites:

- v1 and v2 server-side verification reuse the approved schema dispatch;
- authenticated tenant scope remains server-derived;
- client cannot assert Managed provenance;
- key lookup uses full fingerprint and rejects ambiguity;
- stream head/sequence updates are transactionally safe and idempotent;
- v1/v2 storage never rewrites original evidence bytes/meaning;
- unsupported versions fail closed without invalid-signature mislabeling; and
- evidence export includes every artifact needed for offline verification.

Exit gate:

- replay, fork, race, collision, partial batch, downgrade, and resource-limit
  tests pass;
- failed/rejected batches cannot block later honest submissions;
- organization binding is reported as a Connected trust observation, not
  universal identity; and
- deployment/migration/rollback and observability plans are independently
  reviewed.

## Stage 8 — Connected GA gate

Prerequisites before Connected GA:

1. OD-10 through OD-12 approved where GA claims depend on them;
2. key registration, rotation, revocation, compromise, and recovery operations
   are tenant-scoped, audited, and fail closed;
3. trust-policy version/evaluation time appears in verification reports;
4. offline revocation staleness and producer-time limitations are explicit;
5. users can export original evidence, contracts, public keys, trust bindings,
   revocation snapshots, checkpoints, schema/suite versions, and policy
   metadata;
6. historical artifacts have retention and disaster-recovery ownership;
7. authorization, retention, privacy, deletion, and compliance controls are
   tested independently from signature verification;
8. API limits, abuse controls, monitoring, incident response, and restore
   exercises are complete; and
9. GA wording never claims signature proves human identity, trusted execution,
   authorization, complete history, or external effects.

## Protocol implementation versus product features

| Protocol/conformance work | Product/Connected work |
| --- | --- |
| RFCs, schemas, registries | Organization admin UI/workflows |
| Canonical/signature rules | KMS/HSM operations and recovery |
| Verification result schema | Hosted trust policy and revocation distribution |
| Golden vectors/runners | Retention, search, audit views, exports |
| Standalone verifier | Authenticated upload/status APIs |
| Reference binding | SLAs, monitoring, support, deployment |
| Open trust/checkpoint export formats | Managed storage and checkpoint operation |

Product work may implement an approved protocol but must not define protocol
semantics through private service behavior.

## What should not be built yet

- Evidence v2 or ActionContract v2 production emitters before vector-backed
  freeze;
- a TypeScript producer before independent C1/C2 verification;
- a full Go SDK before the standalone verifier proves a distinct need;
- Rust core, WASM, sidecar, shared scheduler, or execution engine;
- workflow composition, DAGs, `andThen`, fibers, sagas, compensation, or
  exactly-once mechanisms;
- durable suspension/resume or remote approval workflow;
- mandatory global PKI, transparency log, trusted time, hardware identity,
  workload attestation, or cloud dependency;
- Managed execution or external-side-effect proof inferred from Evidence; or
- automatic schema upgrades/downgrades and default-emission changes.

## Delivery discipline for every future stage

Each stage must use a focused branch and review range, preserve unrelated dirty
worktrees, and report:

- exact base and final tip;
- changed files and whether any production path changed;
- schema/vector revisions and artifact hashes;
- tests/checks with exact pass/fail/skip counts;
- security and compatibility review coverage over the exact delta;
- unproven runtime paths and deployment prerequisites; and
- explicit confirmation that no push, merge, publication, or deployment
  occurred unless separately authorized.
