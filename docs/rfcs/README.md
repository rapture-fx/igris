# Igris protocol RFC index

Status: **Draft program; not a stable protocol or external standard**

This directory defines the proposed protocol direction around the formats
already emitted by Igris 0.1.0a2. It does not change production bytes, add a
runtime, or declare consensus. The Python SDK remains the current reference
implementation; an independent implementation conforms by matching the
specification and public vectors, not by importing Python code.

## Reading labels

- **Current** means implemented on `origin/main` at the Alpha.2 merge
  (`1ef093a96dc8ae55c317266aa9b0dc94e5b08579`).
- **Draft invariant** or **candidate invariant** is proposed for senior
  ratification using RFC 2119-style terms; it is not yet a released protocol
  contract.
- **Open decision** remains a blocker or explicitly deferred choice.
- **Rejected for v1** is deliberately outside the Protocol v1 boundary.

No draft invariant changes the interpretation of ActionContract schema `1`
or Evidence schema `1`. Any incompatible field, hashing, signing, identity,
or lifecycle change requires a new schema and new vectors.

## RFC suite

| RFC | Subject |
| --- | --- |
| [000](000-igris-protocol-program-charter.md) | Program charter and governance |
| [001](001-igris-protocol-v1.md) | Language-neutral protocol model |
| [002](002-igris-action-model.md) | Action model |
| [003](003-igris-evidence-envelope.md) | Evidence envelope and signed bytes |
| [004](004-igris-identity-and-trust.md) | Identity and trust |
| [005](005-igris-execution-semantics.md) | Execution lifecycle and crash semantics |
| [006](006-igris-runtime-provider-model.md) | Runtime-provider model |
| [007](007-igris-conformance-and-test-vectors.md) | Conformance and test vectors |
| [008](008-igris-language-binding-guidelines.md) | Language-binding guidance |

Supporting analysis:

- [Protocol gap analysis](protocol-gap-analysis.md)
- [Glossary](glossary.md)
- [Senior foundation review](protocol-foundation-senior-review.md)
- [Resolved decisions](protocol-resolved-decisions.md)
- [Design-freeze candidate](protocol-design-freeze-candidate.md)
- [Design-freeze matrix](protocol-design-freeze-matrix.md)
- [Open decisions](protocol-open-decisions.md)
- [Next implementation sequence](protocol-next-implementation-sequence.md)
- [Standalone Go verifier design](standalone-go-verifier-design.md)
- [Verification-result schema draft](../../spec/verification-result-schema-draft.md)
- [Test-vector design](../../spec/test-vectors/README.md)
- [Schema-1 vector release plan](../../spec/test-vectors/schema-1-release-plan.md)
- [Schema-1 known implementation divergences](schema-1-known-implementation-divergences.md)
- [Independent-review condition resolution](protocol-independent-review-condition-resolution.md)

Material architecture decisions are recorded in [the ADR index](../adr/README.md).

## Current implementation authority

The following sources, not older roadmap wording, establish current behavior:

| Area | Source | Tests |
| --- | --- | --- |
| ActionContract v1 | `sdk/python/src/igris/contracts.py` (`ActionContract`, `build_contract`) | `sdk/python/tests/test_contracts.py`; `igris-overture/api/routes_contracts_test.go::TestContractSyncAcceptsPythonGeneratedFixtureContract` |
| Evidence v1 construction | `sdk/python/src/igris/journal.py` (`finalize_event`); `sdk/python/src/igris/guard.py` (`_append_event`) | `sdk/python/tests/test_journal.py`; `sdk/python/tests/test_guard.py::TestOutcomeSemantics` |
| Python verification | `sdk/python/src/igris/verification.py` | `sdk/python/tests/test_verification.py::TestDetection` |
| Signing identity | `sdk/python/src/igris/identity.py` | `sdk/python/tests/test_identity.py` |
| Canonical encoding | `sdk/python/src/igris/canonical.py`; `igris-overture/internal/canonicaljson/canonicaljson.go` | `sdk/python/tests/test_canonical.py`; `igris-overture/internal/canonicaljson/canonicaljson_test.go` |
| Cross-language fixtures | `testdata/igris-contract-v1/` | `conformance/contractv1/canonical_conformance_test.go` |
| Go evidence verification | `igris-overture/api/evidence_verify.go` | `igris-overture/api/routes_evidence_test.go::TestEvidenceVerifyAcceptsPythonFixtureJournal`; `TestEvidenceVerifyTamperAndTransitionRejections` |
| Existing callable adapters | `sdk/python/src/igris/wrap_tool.py` | `sdk/python/tests/test_wrap_tool.py` |
| Explicit evidence sync/privacy | `sdk/python/src/igris/evidence_sync.py`; `evidence_privacy.py` | `sdk/python/tests/test_evidence_sync.py`; `test_evidence_privacy.py` |
