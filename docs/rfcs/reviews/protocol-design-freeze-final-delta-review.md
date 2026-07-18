# Igris protocol design-freeze candidate — final delta review

Status: **Internal engineering ratification; final verdict GO**

Review date: 2026-07-16

This is an independent, narrow review of the Clock 2A remediation delta. It is
an internal implementation-authorization gate, not an external security audit,
cryptographic certification, or industry-standard designation.

## Executive summary

The corrected design-freeze candidate satisfies all three conditions from the
previous CONDITIONAL GO and accurately incorporates both accepted
clarifications. The remediation defines one portable verification-result
vocabulary, fixes the schema 1 Unicode compatibility record without changing
historical bytes, and gives adversarial numeric spellings one fail-closed
cross-language rule.

OD-01 through OD-12 remain architecturally stable. Changes to their prose are
limited to the exact review conditions and clarifications: specification
conflict mapping, legacy compatibility truth, numeric-token preservation,
conservative future-suite wording, and publisher-namespace trust boundaries.

The exact delta changes 24 Markdown files under docs/ and spec/ only. Git tree
objects for sdk/python, igris-overture, conformance, testdata, and the schema 1
fixture subtree are identical before and after the remediation. No production
source, fixture, migration, canonical byte, hash, signature, key material, or
runtime behavior changed.

The documentation architecture phase is complete. The next protocol task must
implement the additive executable schema 1 conformance vectors and the
machine-readable verification-result schema. Another broad RFC review cycle is
not required by this verdict.

## Exact candidate and delta reviewed

| Item | Exact value |
| --- | --- |
| Original design-freeze candidate | 41879dcfb971dcad0bfa254dab83b0a6d738dcbf |
| Previous independent review | 9514931345898505feafd2db32f6d047fe131d2f |
| Corrected Clock 2A candidate | 55d400490a5e6915b9ae634749c6845a0cd15726 |
| Exact review range | 41879dcfb971dcad0bfa254dab83b0a6d738dcbf..55d400490a5e6915b9ae634749c6845a0cd15726 |
| Candidate branch | rfc/igris-protocol-foundation |
| Verified candidate branch tip | 55d400490a5e6915b9ae634749c6845a0cd15726 |
| Delta size | 24 files, 795 insertions, 162 deletions |
| Delta path scope | docs/ and spec/ only |

The original candidate is the merge base of the corrected candidate. The
previous independent-review commit is present and is based on the same
original candidate. The complete textual diff, name-status output, and
diff-stat for the declared range were reviewed. The local authoritative
candidate branch ref was used; no remote-tracking candidate ref was present.

## Repository and worktree provenance

| Item | Recorded value |
| --- | --- |
| Source repository | /Users/wira/Desktop/system |
| Isolated review worktree | /Users/wira/Desktop/system-worktrees/igris-protocol-final-delta-review |
| Dedicated review branch | review/igris-protocol-foundation-final-delta-gate |
| Delta base SHA | 41879dcfb971dcad0bfa254dab83b0a6d738dcbf |
| Review-branch base / candidate SHA | 55d400490a5e6915b9ae634749c6845a0cd15726 |
| Initial review-worktree status | Clean |

The pre-existing source checkout contained unrelated untracked work and was
not modified. The candidate branch was not checked out or changed in its
existing worktree. This review artifact is the only intended review-branch
change.

## Final verdict

**GO.**

All three prior conditions are resolved, both accepted clarifications are
accurate, OD-01 through OD-12 remain stable, the 39-code portable issue
registry is internally consistent, summary precedence is deterministic, and
the remediation changes no production or signed bytes.

This GO authorizes only the next phase listed below. It does not approve the
future signature suite, claim the current Go interoperability defects are
fixed, or authorize any v2 producer or standalone-verifier implementation.

## Condition 1 verification vocabulary assessment

Result: **ACCEPT**

- unsupported_event_type is absent from the portable issue registry. Its
  remaining textual occurrences are historical or explicit statements that it
  is not a portable alias.
- An unknown event_type in a supported closed schema maps consistently to
  schema=invalid, issue invalid_field, and summary invalid. An unknown schema
  remains unsupported_schema.
- outside_binding_interval and binding_interval_indeterminate are mutually
  exclusive. The former requires trustworthy time evidence placing an
  artifact outside an applicable interval. The latter requires an applicable
  interval that cannot be evaluated because trustworthy time is insufficient.
- unavailable is the sole registered time_confidence value for an evaluated
  absence of usable time evidence. unknown, claimed, and inferred are
  explicitly not registered time_confidence values.
- specification is a required top-level result dimension.
  specification_conflict maps to specification=conflict, affected phases
  not_evaluated, summary indeterminate, and fail-closed termination.
- The registry contains exactly 39 unique codes. Each row has one meaning, one
  dimension effect, one fixed severity, and a deterministic minimum summary
  consequence. All 27 error-severity codes force a non-optional adverse
  summary consequence.
- A valid signature remains signature=valid when trust is revoked, untrusted,
  outside an interval, or rejected by a named policy. Those states cannot be
  relabeled invalid_signature.
- Summary rules use an explicit first-match order:
  invalid, unsupported, indeterminate, valid_but_untrusted,
  valid_and_trusted, valid_but_trust_unknown. No unresolved overlapping
  first-match case was found.

The result vocabulary is sufficiently coherent to implement and freeze its
machine-readable schema in the next phase.

## Condition 2 U+2028/U+2029 assessment

Result: **ACCEPT**

- Python 0.1.0a2-emitted schema 1 bytes are explicitly the historical producer
  baseline.
- U+2028 and U+2029 are normatively raw UTF-8 bytes E2 80 A8 and E2 80 A9 in
  that legacy profile.
- The current production Go re-encoder is consistently described as
  non-conforming for these scalars, not as an alternate canonical form.
- No reviewed document claims general Python/Go schema 1 equivalence. Claims
  are limited to existing covered fixtures and are paired with the known
  divergence.
- No document redefines schema 1 to match Go encoding/json behavior.
- The vector plan requires distinct raw-byte U+2028 and U+2029 cases,
  applicable signed string positions, and mixed-text coverage.
- The Go production fix remains a separate task after normative vectors exist.
- Historical fixtures and signed bytes are unchanged.
- Binding guidance warns against relying on a host-language default serializer.

Source confirmation:

- sdk/python/src/igris/canonical.py uses json.dumps with ensure_ascii=False and
  UTF-8 encoding.
- A live Python check emitted 7b226b223a22e280a8e280a9227d for an object
  containing both scalars, which contains their raw UTF-8 sequences.
- igris-overture/internal/canonicaljson/canonicaljson.go uses encoding/json
  with SetEscapeHTML(false).
- The installed Go 1.26.4 encoding/json encoder explicitly and unconditionally
  escapes U+2028 and U+2029 in its legacy encoding path.

The production divergence remains real and unresolved. Its accurate
documentation is the condition that is accepted here.

## Condition 3 numeric-literal assessment

Result: **ACCEPT**

- Python-emitted numeric rendering remains the historical producer baseline.
- Externally supplied accepted schema 1 numbers preserve their original token
  lexemes for canonical reconstruction.
- 1E+2, 1e2, 100, -0, 0, and 0.0 are explicitly distinct signed byte
  representations even when a host runtime gives some of them equal numeric
  values.
- A verifier must not normalize an untrusted numeric token and claim the
  normalized bytes were signed.
- Loss of a required accepted lexeme maps to
  canonicalization=unsupported, issue unsupported_legacy_representation,
  summary unsupported, and dependent checks not_evaluated.
- Invalid JSON number forms fail during parsing, not canonicalization.
- The vector plan covers exponent case/sign, zero forms, large integers,
  Python float-rendering boundaries, cross-runtime normalization differences,
  and invalid JSON forms.
- Current production behavior is not described as already conforming.

A live Python check independently confirmed the divergence risk:
1E+2 and 1e2 both re-render as 100.0, while -0 re-renders as 0. The current Go
decoder uses json.Decoder.UseNumber and can retain the submitted spelling.
The selected lexical-preservation rule therefore removes a real
cross-language ambiguity and fails closed when a verifier lacks the required
capability.

The implementation work remains future work; no verifier was changed here.

## Cryptographic framing clarification assessment

Result: **ACCEPT**

- igris-ed25519-sha256-1 remains explicitly proposed and unapproved.
- The documents state that signing SHA-256(frame) depends on SHA-256 collision
  resistance and does not retain pure Ed25519 direct-message collision
  resilience.
- No document claims that this internal review supplies cryptographic approval.
- Specialist review of composition, domain separation, collision behavior, and
  substitution properties is mandatory before any new signed schema using the
  suite is approved or emitted.
- Evidence v2 and ActionContract v2 remain blocked.
- Schema 1 signature construction and behavior are unaffected.

This review does not redesign, select alternatives for, or approve the future
suite.

## Publisher namespace clarification assessment

Result: **ACCEPT**

- publisher_namespace supplies opaque probabilistic uniqueness only.
- It is not an identity credential, ownership claim, possession proof,
  authorization conclusion, or trust conclusion.
- Copying and squatting are explicitly acknowledged.
- Semantic ActionContract identity remains signer-independent.
- Publisher attribution requires both a separate signed attestation and an
  explicit verifier trust binding.
- No global namespace registry, PKI, blockchain, Connected service, or other
  mandatory infrastructure dependency was introduced.

## OD-01 through OD-12 stability matrix

| Decision ID | Previous meaning | Current meaning | Classification | Compatibility consequence | Verdict |
| --- | --- | --- | --- | --- | --- |
| OD-01 | A release manifest pins normative artifacts; conflicts fail closed | Same precedence model; specification conflict now has an explicit result dimension and summary | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | No byte change; conflict behavior is implementable | ACCEPT |
| OD-02 | Future signed objects use igris-canonical-json-1; schema 1 stays legacy | Same future profile; current schema 1 Go Unicode divergence is no longer hidden by fixture-level agreement | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | Future bytes unchanged; legacy truth is recorded | ACCEPT |
| OD-03 | Future signatures use a length-framed, domain-separated proposed suite | Same frame and suite proposal; pre-hash trade-off and mandatory specialist approval are explicit | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | No schema 1 effect; future suite still blocked | ACCEPT |
| OD-04 | Future signed schemas are closed; dispatch precedes interpretation; no downgrade | Unchanged | UNCHANGED | None | ACCEPT |
| OD-05 | Action identity is publisher namespace plus action name; trust is external | Same tuple; namespace copy/squatting and separate attestation/trust binding are explicit | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | No identity or signed-byte change | ACCEPT |
| OD-06 | Contract hash covers the semantic, language-neutral contract body; implementation identity is separate | Unchanged | UNCHANGED | None | ACCEPT |
| OD-07 | Evidence uses opaque stream/instance identity, sequence, previous hash, and no minimum event UUID | Unchanged | UNCHANGED | None | ACCEPT |
| OD-08 | Allowed is permission, not execution; denial is terminal; at most one observed Outcome | Unchanged | UNCHANGED | None | ACCEPT |
| OD-09 | Verification results decompose protocol facts, trust, time, and policy | Same model; issue meanings, specification dimension, and summary precedence are fully mapped | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | Result-schema draft only; no artifact reinterpretation | ACCEPT |
| OD-10 | Trust input is external, scoped, and preserves cryptographic validity | Same model; outside versus unevaluable binding intervals and time-confidence values are disambiguated | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | Trust results become deterministic; signatures unchanged | ACCEPT |
| OD-11 | Schema 1 bytes and meanings are permanent under legacy dispatch | Same permanence; Python Unicode baseline and external numeric-lexeme rule are explicit | CLARIFIED_WITHOUT_ARCHITECTURE_CHANGE | Existing bytes remain valid; future verifiers gain fail-closed rules | ACCEPT |
| OD-12 | Checkpoints are optional external objects; continuity and completeness remain separate | Unchanged | UNCHANGED | None | ACCEPT |

No MATERIAL_CHANGE was found. Every clarification is either directly required
by the previous review or records an accepted clarification without reopening
the decision.

## Cross-document consistency findings

The review cross-checked:

- RFCs 001, 002, 003, 004, 007, and 008;
- protocol-resolved-decisions.md;
- protocol-open-decisions.md;
- protocol-design-freeze-matrix.md;
- protocol-design-freeze-candidate.md;
- verification-result-schema-draft.md;
- schema-1-release-plan.md;
- standalone-go-verifier-design.md;
- schema-1-known-implementation-divergences.md;
- the glossary;
- ADR 0010 and ADR 0011; and
- the previous independent review at
  9514931345898505feafd2db32f6d047fe131d2f.

Mandatory searches covered unsupported_event_type, invalid_field,
binding_interval_indeterminate, outside_binding_interval, time_confidence,
unavailable, specification_conflict, unsupported_legacy_representation,
U+2028, U+2029, publisher_namespace, identity credential, collision
resistance, cryptographic approval, schema-1 equivalence, and Python/Go
agreement claims.

No stale normative use of unsupported_event_type or an unregistered
time_confidence value was found. Remaining occurrences of old terms are
historical descriptions or explicit rejections. Verification examples include
the new required specification field. Link targets and anchors resolve.

No contradiction was found that could alter schema 1 signed bytes,
verification results, trust semantics, or the authorized implementation
boundary.

## Production and signed-byte invariant verification

The exact remediation range contains no change under sdk/, conformance/,
igris-overture/, cmd/, testdata/, migrations/, workflows/, deployment paths,
or infrastructure paths.

Git tree identities are byte-level invariants:

| Tree | Original candidate object | Corrected candidate object | Result |
| --- | --- | --- | --- |
| testdata/igris-contract-v1 | 8f47a81a8fcc48e5c96080bcb3b0f50a9df38bbe | 8f47a81a8fcc48e5c96080bcb3b0f50a9df38bbe | IDENTICAL |
| sdk/python | e8a13aa09db701201561437563bce194b6de1ae9 | e8a13aa09db701201561437563bce194b6de1ae9 | IDENTICAL |
| igris-overture | 0ac81da30757547f663d55d7e4ed3d12efecf088 | 0ac81da30757547f663d55d7e4ed3d12efecf088 | IDENTICAL |
| conformance | 9d24e7b35e0cd2f7ada4223d608784065a66634b | 9d24e7b35e0cd2f7ada4223d608784065a66634b | IDENTICAL |
| testdata | 333d8a161cb1230a96a373f9a2c2dc0d28f235a1 | 333d8a161cb1230a96a373f9a2c2dc0d28f235a1 | IDENTICAL |

Because the complete fixture trees are identical, every existing canonical
file, expected hash, signature, public key, and other fixture byte is
identical. Documentation cannot have changed runtime behavior, and no
generated artifact was added.

## Validation executed

| Check | Result |
| --- | --- |
| Candidate branch tip equals 55d400490a5e6915b9ae634749c6845a0cd15726 | PASS |
| Original candidate and prior review commits present | PASS |
| Original candidate is ancestor and merge base of corrected candidate | PASS |
| git diff --name-status for exact range | PASS: 24 Markdown paths under docs/ and spec/ only |
| git diff --stat for exact range | PASS: 795 insertions, 162 deletions |
| Complete textual diff for exact range | REVIEWED |
| git diff --check for exact range | PASS |
| Production/fixture/deployment path allowlist | PASS: no changes |
| Relative Markdown link and anchor check | PASS: 38 files, 66 relative links, 3 anchors |
| Issue-registry uniqueness and shape | PASS: 39 unique codes |
| Fixed issue severity and fatal summary consequence | PASS: 39 fixed severities; 27 fatal rows have adverse consequences |
| Summary-precedence consistency | PASS: six ordered, first-match summaries |
| Freeze-matrix structural validation | PASS: 49 data rows, 10 columns |
| Unresolved draft-marker inventory | PASS: 0 |
| Focused terminology and contradiction searches | PASS |
| Python focused schema 1 compatibility/verification tests | PASS: 49 passed |
| go test ./conformance/contractv1/... | PASS |
| go test ./igris-overture/internal/canonicaljson/... | PASS |
| go test ./igris-overture/api -run TestEvidenceVerify-or-TestEvidence | PASS |
| Schema 1 fixture tree equality | PASS: identical Git tree object |
| sdk/python, igris-overture, conformance, and testdata tree equality | PASS: identical Git tree objects |

The green Go suites exercise current fixtures only. They do not contain the
new U+2028/U+2029 cases and therefore do not prove the production defect fixed.

## Blocking findings

None.

## Non-blocking findings

1. The current Go U+2028/U+2029 production interoperability defect remains
   unresolved by design. It must be fixed only in a separate production task
   after the normative raw-byte vectors exist.
2. Schema 1 numeric-token preservation and fail-closed unsupported handling
   remain future verifier work. No current implementation is granted
   conformance by this review.
3. Current green tests do not cover either declared divergence. The executable
   vector suite is the required next proof artifact.

These are recorded implementation gaps, not documentation inconsistencies and
not permission to change historical schema 1 bytes.

## Exactly what is authorized next

This GO authorizes the following narrow next phase:

- additive schema 1 conformance-vector implementation;
- the machine-readable
  igris:protocol:verification-result:1 schema implementation and freeze;
- a versioned schema 1 vector manifest;
- exact canonical-byte files;
- expected hash and signature files;
- expected verification-result files;
- the Python vector runner;
- the existing Go-path vector runner; and
- cross-language candidate CI.

The phase must preserve every historical schema 1 byte and must expose the
known Go and numeric-token gaps honestly. Production fixes may be scheduled
after normative vectors exist, but are not implemented or authorized by this
review artifact itself.

## Exactly what remains blocked

The following remain blocked or outside this review:

- standalone Go verifier implementation, until the candidate vector suite and
  machine-readable result schema are frozen;
- Evidence v2 implementation;
- ActionContract v2 implementation;
- approval or emission of igris-ed25519-sha256-1 without specialist
  cryptographic review;
- any change to schema 1 bytes, signatures, or default producer behavior;
- TypeScript producer or full SDK;
- full Go producer SDK;
- Rust or WASM core;
- workflow composition;
- managed execution;
- unrelated Connected feature development;
- database migrations;
- deployment;
- package publication;
- merge to main; and
- push of this review branch without separate authorization.

This GO is final internal engineering ratification of the corrected
documentation candidate for the stated next phase. It is not external
independent security certification.
