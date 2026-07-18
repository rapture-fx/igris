# Clock 2F.2 — Independent confirmation of Schema-1 release conditions

Status: **Independent confirmation record — RELEASE GO**
Remediation range reviewed:
`12f8532d5770077b1a7b1ed4c905c2ce6c7b2ae0..ddbb05c17a786cea15ea1936af87606cf9757e9e`
(C1 commit `fe128fbfec4105bed84c06d5481ca9926978f622`, C2+C3 commit
`ddbb05c17a786cea15ea1936af87606cf9757e9e`; tip verified a descendant of the
hosted-green base; original conditions re-read from review commit
`1710ffcc64c357cd5dec7651f21a03816284938a`)
Review date: 2026-07-18

## Verdict

**RELEASE GO.** All three Clock 2F conditions are independently CLOSED. The
delta is exactly the four reported documentation files; no executable, schema,
vector, workflow, key, or manifest byte changed. Clock 2F is complete and
Schema-1 is authorized to proceed to Clock 2G — Release Execution. Nothing was
released, tagged, published, or merged during this review.

## Scope and integrity verification (observed)

- Changed files in the range: `docs/rfcs/003-igris-evidence-envelope.md` (M),
  `spec/test-vectors/suite-schema-1/RELEASE.md` (A),
  `spec/test-vectors/suite-schema-1/CANDIDATE.md` (M),
  `conformance/go-verifier/README.md` (A) — and nothing else. A pathspec diff
  over `*.go *.py *.yml *.yaml *.json *.b64 *.pem *.jsonl` across the range is
  empty.
- Frozen manifest SHA-256 exact
  (`864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`);
  completeness 321/321 PASS; neither `CANDIDATE.md` nor `RELEASE.md` is
  manifest-listed (verified from `manifest.json` directly), so both edits are
  outside the frozen bundle.
- Targeted reproducibility at the tip: standalone Go test suite green,
  standalone runner 120/120, three-way differential
  `python 120/120, production-go 120/120, standalone 120/120`,
  `git diff --check` clean.

## C1 — CLOSED

Every new normative statement in RFC 003 §Canonical encoding was re-derived
from the oracle in this review, not accepted from the remediation report:

- **Key ordering** — the frozen expected bytes of
  `can1-valid-unicode-supplementary-keys-001` place U+FFFF (`EF BF BF`)
  before U+1F600 (`F0 9F 98 80`): scalar/UTF-8-byte order, contradicting
  UTF-16 code-unit order exactly as the new text states, and the text's
  MUST-NOT for UTF-16 defaults makes the divergence unmistakable for
  JavaScript/Java implementers.
- **Escape table** — `can1-valid-control-characters-001` expected bytes show
  the five short escapes plus the lowercase-hex forms backslash-u0000 and
  backslash-u001f; the standalone writer (`appendCanonicalString`)
  implements the identical table with
  `const hexDigits = "0123456789abcdef"` and a `c < 0x20` boundary, and
  Python `json.dumps` emits lowercase backslash-u escapes. U+007F verified
  emitted raw by both (outside the `< 0x20` range), matching the text.
- **Solidus, uppercase-escape acceptance, surrogate pairs** — verified
  empirically against the Python conformance parser at the reviewed tip:
  an escaped solidus decodes to `/`; an uppercase-hex backslash-uFFFF
  escape is accepted and re-emitted as raw UTF-8 (`EF BF BF`); the escaped
  high/low surrogate pair for U+1F600 decodes to the single scalar and
  re-emits as raw `F0 9F 98 80`; the standalone parser's pair handling was
  previously confirmed to accept the same input as `canonicalization=valid`.
  Where the behavior is not vector-pinned (pairs), implementation agreement
  was checked rather than assumed.
- **Classifications** — expected results confirm: lone surrogate
  `parse=valid`/`canonicalization=invalid`/`invalid_unicode_scalar`;
  duplicate member, trailing content, invalid UTF-8 all `parse=malformed`
  with the exact registry codes the text cites; resource limits stated as
  implementation-declared with summary `indeterminate`, never a signature
  failure — consistent with the result registry, no new codes introduced.
- **Numeric semantics** — the numeric-lexeme paragraphs of RFC 003 are
  untouched by the delta; the new text explicitly firewalls string rules
  from number-token rules.
- **Release condition test** — an unrelated TypeScript/Rust/Java/Go
  implementer can now determine the serialization behavior from RFC 003
  alone: sort unit, escape forms and casing, U+007F, solidus, normalization
  stance, escape-acceptance grammar, surrogate rules, and malformed-input
  classifications are all in normative text with their pinning vectors
  cited. Reading `IMPLEMENTATION.md` is no longer required. The
  implementation-defined serialization remnant identified by Clock 2F is
  closed.

## C2 — CLOSED

- Exact manifest SHA, 321-artifact count, and 120-vector count (family
  split ac1=21/can1=46/ev1=52/spec1=1 re-checked against `manifest.json`)
  are recorded; `ratification_commit` cited matches the manifest field
  (`938c8c27b96d38cd1819eb881d5fe57a197ddaa1`).
- The internal `suite_revision`/`protocol_status` are quoted unchanged, and
  the record explains explicitly why they intentionally still read
  "candidate" and why editing them is prohibited — the v1.0.0-label vs
  candidate-revision relationship is unambiguous; a reader cannot mistake
  the external identity for an in-place manifest mutation.
- Version axes are kept separate in a table; the record states RFCs remain
  Draft ("Not 'Protocol v1 ratified'"), disclaims external certification
  explicitly, describes hosted-CI provenance accurately (run `29630815953`
  at `12f8532d5…`, matching the observed run), and states future additive
  vectors create new revisions without touching this bundle.
- Status language correctly defers effectiveness to the release-execution
  gate; Schema-1 is not declared released.
- `CANDIDATE.md`: confirmed non-manifest-listed before accepting the edit;
  the banner supersedes operationally while every freeze-time statement
  remains intact below it. RELEASE.md, not history-editing, is the
  promotion mechanism.
- **OBS-1 (non-blocking):** RELEASE.md cites
  `docs/rfcs/reviews/schema1-release-promotion-normative-readiness-review.md`,
  which exists on the separate review branch (commit `1710ffcc6…`), not in
  this lineage's tree. The citation is factually accurate but a consumer of
  the released tree will not find the file at that path. Recommended for
  Clock 2G: either land the 2F/2F.2 review artifacts in the release lineage
  or qualify the citation with its branch/commit. Not a condition failure.

## C3 — CLOSED

Every claim checked against source at the reviewed tip: Go `1.24.0` in
`go.mod`; three subcommands and flags match `usage()` verbatim; stdin `-`,
`--type` forcing, structural detection, `--human`-on-stderr, and
result-on-stdout match `main.go`; exit codes 0–4 match the package comment
exactly, and the README's caveat that **exit 0 means a result was emitted
with any summary** — instructing machine consumers to branch on the JSON —
is the single most important consumer fact and is stated prominently. The
vectors-mode 321/321 hash pre-check claim is real (`runner/manifest.go`
recomputes SHA-256 and fails as suite corruption, exit 2). Offline claims
match the enforced dependency guard (no net/http/os-exec/database imports).
The security section correctly separates producer attestation, trust-unknown
vs invalid, continuity vs completeness (checkpoints absent from Schema-1),
and outcome vs external effect. No private key, seed, or secret material
appears; the single key mention is the public-key format list.

## Precedence and claims

The new RFC 003 text closes with an explicit statement that it documents
frozen behavior pinned by cited vectors and the Python 0.1.0a2 baseline —
normative text now defines the serialization rules; vectors pin them;
`IMPLEMENTATION.md` remains an informative implementation record with no
overriding force. No new claim of absolute immutability, signer identity,
authorization, host integrity, completeness, external effects, regulatory
compliance, or external certification was introduced anywhere in the delta;
"tamper-evident relative to a key" is the operative framing in RELEASE.md.

## Condition closure matrix

| Condition | Verdict | Evidence |
| --- | --- | --- |
| C1 normative serialization | **CLOSED** | RFC 003 delta re-derived against vectors + three implementations above |
| C2 release record | **CLOSED** | RELEASE.md immutable-promotion-by-reference verified field-by-field; manifest untouched |
| C3 verifier README | **CLOSED** | Every claim source-checked incl. exit-code semantics |

## Consequence

Clock 2F is **complete**. Schema-1 (still an unreleased frozen candidate) is
authorized to proceed to **Clock 2G — Schema-1 Public Release Execution**
using the release identity in RELEASE.md. OBS-1 should be resolved during
Clock 2G. No further broad Schema-1 engineering review is required before
release unless release execution reveals a new integrity defect.
