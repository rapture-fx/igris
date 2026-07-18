# Igris protocol independent-review condition resolution

Status: **Clock 2A remediation record; pending independent Clock 2B delta
review**

Authoritative inputs:

- design-freeze candidate
  `41879dcfb971dcad0bfa254dab83b0a6d738dcbf` on
  `rfc/igris-protocol-foundation`;
- independent review
  `9514931345898505feafd2db32f6d047fe131d2f` on
  `review/igris-protocol-foundation-independent-gate`; and
- review document
  `docs/rfcs/reviews/protocol-design-freeze-independent-review.md` at that
  review commit, with verdict **CONDITIONAL GO**.

This record resolves documentation and specification defects only. It does not
ratify the protocol, alter a signed byte, change production behavior, or
authorize implementation. Final disposition belongs to an independent Clock
2B review of the exact delta from the candidate commit to the remediation tip.

## Remediation impact matrix

| Item | Current wording or claim | Contradiction | Selected resolution | Affected documents | Compatibility impact | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| Condition 1: portable verification vocabulary | RFC 007 names `unsupported_event_type` and `binding_interval_indeterminate`; the result draft omits both, uses `outside_binding_interval`, uses `time_confidence=unknown`, and registers `specification_conflict` without a dimension or summary | One portable result cannot be produced consistently | Unknown event types in a supported closed schema map to schema `invalid` plus `invalid_field`; both binding terms remain with mutually exclusive time-evidence conditions; `unavailable` is the sole no-usable-time value; a specification-consistency dimension fails closed to `indeterminate`; every issue gets one dimension, fixed severity, field effect, and summary consequence | RFC 001, RFC 003, RFC 004, RFC 007, RFC 008, result-schema draft, vector design/release plan, resolved/open decisions, freeze matrix/candidate, Go-verifier design, glossary | Result-model draft only; no artifact, fixture, SDK API, or historical signature changes | Registry uniqueness, summary-precedence, duplicate-vocabulary, link, heading, and focused result searches |
| Condition 2: schema `1` U+2028/U+2029 | Candidate prose implies the maintained Python and Go paths agree for legacy values | Python emits raw UTF-8; current Go `encoding/json` re-encoding emits escapes for U+2028/U+2029 | Freeze Python-emitted raw UTF-8 as the historical producer baseline; declare current Go ingest/re-encoding non-conforming for these characters; require raw-byte vectors and a later production fix | RFC 001, RFC 003, RFC 007, RFC 008, schema-1 release plan, resolved decisions, freeze matrix/candidate, senior-review amendment, Go-verifier design, RFC index, known-divergence record | Existing bytes remain authoritative and unchanged; current Go defect is documented, not fixed | Source/test inspection, focused Python/Go tests, invariant diff, and required future regression vectors |
| Condition 3: adversarial schema `1` numbers | The release plan says only that legacy numeric vectors document existing behavior; the Go-verifier design says to preserve literals | Python parsing can normalize spellings that Go can retain, producing implementation-dependent verification | Python-emitted rendering remains the producer baseline; externally supplied valid JSON numbers are verified using their preserved token lexemes; inability to preserve a required lexeme fails closed as `unsupported_legacy_representation`; invalid JSON number forms fail in parsing | RFC 001, RFC 003, RFC 007, RFC 008, result-schema draft, schema-1 release plan, resolved decisions, freeze matrix/candidate, senior-review amendment, Go-verifier design, known-divergence record | No existing producer output or signature changes; the rule constrains future verifier/vector work only | Planned exponent/sign/zero/large-integer/invalid-form vectors plus semantic searches and focused compatibility tests |
| Accepted clarification: future signature framing | Candidate proposes Ed25519 over SHA-256 of the future frame and requires general review | The pre-hash composition and lost direct-message collision resilience are not explicit | Record the trade-off and require specialist cryptographic review before any future signed schema or suite is approved or emitted; do not redesign the suite here | RFC 003, ADR 0010, resolved/open decisions, freeze matrix/candidate | No schema `1` effect; future suite remains unapproved | Search all approval/authorization claims and confirm v2 remains blocked |
| Accepted clarification: publisher namespace | Candidate says opaque namespaces carry no inherent trust | The copy/squatting and attribution consequence is only implied | State that namespace is an identifier, not a credential; possession/use proves no authority; attribution requires separate attestation plus verifier trust binding; no registry or Connected dependency is added | RFC 002, ADR 0011, resolved decisions, freeze matrix/candidate, glossary | No identity tuple or signed bytes change; clarification prevents trust overclaim | Search namespace/identity/trust claims for consistent non-claim |

## Condition 1 — verification-result vocabulary

Selected resolution:

1. `unsupported_event_type` is removed from the portable registry. For a
   supported closed schema, an unregistered `event_type` is an invalid field:
   `schema=invalid`, issue `invalid_field`, summary `invalid`. An unknown schema
   remains `unsupported_schema`; implementations must not guess an event
   layout.
2. `outside_binding_interval` means a trustworthy time basis establishes that
   the artifact is outside an applicable binding interval.
   `binding_interval_indeterminate` means such an interval applies but no
   trustworthy time basis can place the artifact inside or outside it. The
   states are mutually exclusive.
3. The normative `time_confidence` values use `unavailable`, not `unknown`, for
   the absence of usable time evidence. `claimed` and `inferred` are not
   registered values. The registered values describe the strongest time basis
   actually evaluated, not identity facts or authorization labels.
4. A required top-level `specification` dimension reports `consistent`,
   `conflict`, or `not_evaluated`. A relevant normative conflict produces
   `specification=conflict`, issue `specification_conflict`, summary
   `indeterminate`, and terminates affected verification before artifact
   interpretation. It never selects an implementation as implicit precedence.
5. The result draft defines one deterministic severity, dimension effect, and
   minimum summary consequence for every registered issue code.

This changes only an unratified result-schema draft and its documentation. It
does not reinterpret a schema `1` signature or alter an artifact.

Future work after Clock 2B GO: produce and independently review the
machine-readable result schema and exact expected-result vectors. The
standalone Go verifier remains blocked until those artifacts and the schema `1`
candidate suite are frozen.

## Condition 2 — schema `1` U+2028/U+2029

Selected resolution:

- Python 0.1.0a2-emitted schema `1` bytes are the historical normative producer
  baseline.
- U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR are emitted as raw UTF-8
  in that profile.
- Current Go production re-encoding escapes both characters even when HTML
  escaping is disabled. That is a known non-conforming implementation defect,
  not an alternate schema `1` encoding.
- A verifier must implement the schema `1` profile and match normative bytes;
  blindly using a host-language default JSON serializer is non-conforming.
- Additive vectors will pin raw UTF-8 for each character in all applicable
  schema `1` string positions.

No existing fixture or signed byte changes. The separate future production
task is **Fix Go schema-1 U+2028/U+2029 canonical verification**: use the frozen
vectors, add Go regressions, and prove Connected ingest accepts genuine
Python-signed artifacts containing both characters. This task does not perform
that fix.

## Condition 3 — schema `1` numeric-literal semantics

Selected resolution:

- Python-produced artifacts keep the historical Python number rendering.
- Valid JSON and Python schema `1` producer output are not synonymous.
- For externally supplied schema `1` JSON, a verifier preserves every accepted
  number token's original lexeme and uses that lexeme when reconstructing the
  schema `1` signed/hash input. Numerically equivalent spellings are distinct
  byte representations.
- A verifier must not parse an untrusted number, normalize it, and claim the
  normalized bytes were signed.
- If an accepted number token requires lexical preservation and the verifier
  cannot preserve it, canonicalization is `unsupported`, issue
  `unsupported_legacy_representation`, and summary `unsupported`. Signature and
  dependent checks are `not_evaluated`.
- Number spellings outside the JSON grammar fail during parsing and are never
  signature candidates.

Planned vectors cover `1E+2`, `1e2`, `100`, `-0`, `0`, `0.0`, finite
Python-emitted float boundaries, large integers near and beyond host limits,
spellings Python and Go otherwise normalize differently, and invalid JSON
forms. This task changes no verifier implementation.

The separate future production task is **Implement schema-1 numeric lexical
preservation** with Python and Go regression vectors and fail-closed behavior.

## Accepted cryptographic framing clarification

`igris-ed25519-sha256-1` is a proposed future suite, not an approved
construction. Signing `SHA-256(frame)` makes security depend on SHA-256
collision resistance and does not retain pure Ed25519's direct-message
collision-resilience property. Specialist cryptographic review of the suite,
domain separation, collision properties, and substitution properties is a
mandatory pre-v2 gate. Evidence v2 and ActionContract v2 remain blocked.

## Accepted publisher-namespace clarification

`publisher_namespace` supplies probabilistic uniqueness, not identity,
ownership, authorization, or trust. Anyone can copy or squat a namespace value;
use or possession alone proves no organizational authority. Semantic contract
identity remains signer-independent. Publisher attribution requires a separate
signed attestation and an explicit verifier trust binding. No global registry,
PKI, or Connected dependency is introduced.

## Documents updated

- `docs/adr/0010-future-signed-objects-use-canonical-framed-domains.md`
- `docs/adr/0011-action-and-evidence-identities-are-opaque-and-language-neutral.md`
- `docs/rfcs/000-igris-protocol-program-charter.md`
- `docs/rfcs/001-igris-protocol-v1.md`
- `docs/rfcs/002-igris-action-model.md`
- `docs/rfcs/003-igris-evidence-envelope.md`
- `docs/rfcs/004-igris-identity-and-trust.md`
- `docs/rfcs/007-igris-conformance-and-test-vectors.md`
- `docs/rfcs/008-igris-language-binding-guidelines.md`
- `docs/rfcs/README.md`
- `docs/rfcs/glossary.md`
- `docs/rfcs/protocol-design-freeze-candidate.md`
- `docs/rfcs/protocol-design-freeze-matrix.md`
- `docs/rfcs/protocol-foundation-senior-review.md`
- `docs/rfcs/protocol-gap-analysis.md`
- `docs/rfcs/protocol-next-implementation-sequence.md`
- `docs/rfcs/protocol-open-decisions.md`
- `docs/rfcs/protocol-resolved-decisions.md`
- `docs/rfcs/schema-1-known-implementation-divergences.md`
- `docs/rfcs/standalone-go-verifier-design.md`
- `spec/test-vectors/README.md`
- `spec/test-vectors/schema-1-release-plan.md`
- `spec/verification-result-schema-draft.md`
- this condition-resolution record.

## Validation record

Validation completed on the assembled documentation delta:

| Check | Result |
| --- | --- |
| Required deliverable headings | PASS |
| Relative Markdown links and anchors across `docs/adr`, `docs/rfcs`, and `spec` | PASS: 37 files, 66 relative links, 3 anchors |
| Issue-registry uniqueness/shape | PASS: 39 unique codes, one dimension/effect per code |
| Glossary uniqueness/required terms | PASS: 34 unique terms |
| Freeze-matrix column shape | PASS: 51 table rows |
| Unresolved draft-marker inventory | PASS: 0 |
| Verification-vocabulary semantic searches | PASS |
| Python focused schema `1` compatibility suite | PASS: 49 tests |
| Go `./conformance/contractv1/...` | PASS |
| Go `./igris-overture/internal/canonicaljson/...` | PASS |
| Go Evidence verification-focused API tests | PASS |
| `git diff --check` | PASS |
| Documentation-only path allowlist | PASS |
| Production source, fixture, conformance, and migration diff | PASS: none |

Tree identities against candidate
`41879dcfb971dcad0bfa254dab83b0a6d738dcbf` are unchanged:

| Tree | Git tree object |
| --- | --- |
| `testdata/igris-contract-v1` | `8f47a81a8fcc48e5c96080bcb3b0f50a9df38bbe` |
| `sdk/python` | `e8a13aa09db701201561437563bce194b6de1ae9` |
| `igris-overture` | `0ac81da30757547f663d55d7e4ed3d12efecf088` |
| `conformance` | `9d24e7b35e0cd2f7ada4223d608784065a66634b` |

The focused Go suites pass because current fixtures do not contain U+2028 or
U+2029. Their green result does not fix or disprove DIV-001; the required new
regression vectors and production remediation remain future work.

## Clock 2B disposition

Clock 2A does not self-ratify this remediation. Clock 2B must review only the
delta from `41879dcfb971dcad0bfa254dab83b0a6d738dcbf` to the final remediation
tip, verify the three conditions and two clarifications, verify that OD-01
through OD-12 did not change unexpectedly, and verify that the delta contains
no production code or signed-byte changes.

After an independent **GO**, only additive schema `1` vector implementation and
machine-readable verification-result schema freeze are eligible to proceed.
Standalone Go verifier implementation remains blocked until those artifacts
are frozen. Evidence v2, ActionContract v2, TypeScript producer/SDK, full Go
SDK, Rust/WASM, Connected work, deployment, publication, and merge to main
remain blocked or deferred.
