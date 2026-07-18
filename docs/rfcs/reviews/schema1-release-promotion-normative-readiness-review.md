# Clock 2F — Schema-1 release promotion and normative readiness review

Status: **Independent review record — CONDITIONAL GO**
Reviewed executable tree: `12f8532d5770077b1a7b1ed4c905c2ce6c7b2ae0`
(tree `fc8d36caebec20cc1883a340310db9e4251eb57c`)
Ratified implementation lineage: `85e716f044505d4e9ff9bfbb3d31de2763c8bc11`
(executable subtrees `conformance/`, `spec/`, `sdk/`, `igris-overture/`
verified hash-identical between the two commits)
Hosted CI proof reviewed: run `29630815953` — all four schema-1 jobs green
Frozen manifest: `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`,
321/321 tracked-file integrity re-verified in this review's fresh worktree
Review date: 2026-07-18

## Verdict

**CONDITIONAL GO.** Interoperability, implementation quality, reproducibility,
claim honesty, and threat-model candor are release-ready. Three narrow
documentation/packaging gaps must close before publication (Clock 2F.1). None
of them changes a frozen byte, vector, signature, or semantic.

### Direct answer to the critical release question

Schema-1 today is **mostly protocol-defined with one implementation-defined
remnant**. The object model, hash construction, signature input, key-identifier
derivation, chain semantics, unknown-field rule, numeric-lexeme preservation,
U+2028/U+2029 handling, result vocabulary (39 codes), and fail-closed rules are
written down in language-neutral normative text (RFC 001/003/008, RD-11,
`spec/verification-result-schema-draft.md`, `verification-result-1.schema.json`).
The remnant: the exact **string-serialization last mile** of the legacy
canonical profile — the escape table and the key-sort comparison unit — is
normatively defined only by reference ("the bytes Python 0.1.0a2 emitted",
"keys sorted lexicographically") plus frozen vectors. The complete, correct
prose statement of those facts exists in the repository today, but in
`conformance/go-verifier/IMPLEMENTATION.md`, an explicitly informative
implementation record. Promoting those already-frozen facts into normative text
is condition C1 and requires no byte change.

## Fresh-environment verification performed

From a clean worktree at `12f8532d5…` (nothing reused from prior sessions):

- manifest SHA-256 exact; `check_manifest_git_completeness` 321/321 PASS;
- Python conformance tests 53/53 PASS under the frozen uv environment;
- Python runner 120/120 PASS; `uv lock --check` clean;
- standalone Go verifier `vectors` 120/120 PASS (std-lib-only build);
- hosted run `29630815953` independently confirmed `completed success` at head
  `12f8532d5…` with all four jobs (Python/manifest/determinism, existing Go
  paths, standalone verifier + independence + fuzz + clean tree, three-way
  differential `python 120/120, production-go 120/120, standalone 120/120`).

The release surface reconstructs from Git alone; no untracked state was needed.

## Release-surface classification

**Normative** (define Schema-1):
- `docs/rfcs/001-igris-protocol-v1.md` — object model, versioning, baseline rule
- `docs/rfcs/003-igris-evidence-envelope.md` — fields, canonical encoding rules
  as written, hash calculation, signature input, key IDs, unknown fields,
  chain/partial-chain semantics, lifecycle
- `docs/rfcs/002` (ActionContract), `007` (conformance levels/runner contract),
  `008` (binding obligations)
- `docs/rfcs/protocol-resolved-decisions.md` RD-11 (permanent schema-1
  profile), RD-02/RD-03 (future profiles, explicitly not schema-1)
- `spec/verification-result-schema-draft.md` + `spec/schemas/verification-result-1.schema.json`
  — dimensions, 39-issue registry, summary precedence (registry enum verified
  = 39 codes)
- `docs/rfcs/schema-1-known-implementation-divergences.md` — DIV-001/DIV-002
  compatibility rulings (both remediated; frozen proof vectors present)
- `spec/test-vectors/suite-schema-1/**` — 120 frozen conformance vectors
  (ac1=21, can1=46, ev1=52, spec1=1) + manifest: normative conformance
  artifacts, not merely examples; expected `bytes_base64` authoritative

**Informative:** `spec/test-vectors/README.md` (format/governance),
`schema-1-release-plan.md` (plan), `standalone-go-verifier-design.md`,
`conformance/go-verifier/IMPLEMENTATION.md` (implementation record — currently
holds normative-quality serialization facts; see C1), ADRs, review records.

**Implementation-specific:** `sdk/python` reference producer, production Go
paths, standalone Go verifier, Python candidate runner. **Test-only:**
deterministic fixture key (`*.TEST-ONLY.*`, labeled, metadata-bound, correctly
quarantined by policy and CI). **Release tooling:** workflow, differential
script, generators.

## Specification assessment by area

- **Hash/signature construction: sufficient.** Exact unsigned-payload rule,
  SHA-256/hex, Ed25519-over-raw-digest, base64 form, key_id derivation are
  unambiguous in RFC 003 §Hash/§Signature/§Key identifiers.
- **Numbers/lexeme preservation: sufficient.** RFC 003/RD-11/DIV-002 define
  producer-baseline vs external-input rules, the mandatory
  `unsupported_legacy_representation` fail-closed path, and vectors pin
  `1E+2`/`1e2`/`100`/`-0`/`0`/`0.0`/large-integer cases.
- **U+2028/U+2029: sufficient.** Raw UTF-8 required; Go-escape ruled
  non-conforming; four frozen proof vectors.
- **Unicode/string serialization: GAP (C1).** Normative text says "keys sorted
  lexicographically", "non-ASCII raw UTF-8, no `\u` escapes", "`<>&`
  unescaped" — but does not state: the sort comparison unit (Unicode scalar /
  UTF-8 byte order; a UTF-16-code-unit sort in JS/Java diverges on
  supplementary-plane keys), the exact escape table (`\"`, `\\`, `\b \t \n \f
  \r` short escapes, other controls as lowercase `\u00xx`), input `\uXXXX`
  acceptance (valid surrogate pairs decode; lone surrogates parse but fail
  canonicalization as `invalid_unicode_scalar`), or that duplicate members are
  `parse=malformed` *for schema-1* (stated in the result registry and release
  plan, not the canonical-encoding section). All of these behaviors are frozen
  and vector-pinned (`can1-valid-unicode-supplementary-keys-001`,
  `can1-valid-control-characters-001`, `can1-invalid-surrogate-001`,
  `can1-invalid-duplicate-member-001`, `can1-invalid-utf8-001`); only the
  prose is missing from the normative tier.
- **Malformed input/limits: sufficient with C1 cross-reference.** Result
  registry normatively maps `invalid_utf8`/`duplicate_member`/
  `trailing_content`/`resource_limit`; RFC 003 correctly classifies size/depth
  limits as implementation-declared bounded-work, summary `indeterminate`.
- **Evidence lifecycle/chain: sufficient.** Ordered 8-step verification,
  genesis/anchor/partial/completeness vocabulary, denial-terminal rule,
  single-outcome rule, tail-truncation limitation all explicit.
- **Verification-result vocabulary: sufficient.** 39 codes with
  dimension/severity/summary mapping and deterministic ordering; machine
  schema matches the draft registry.

### Third-party implementer thought experiment (TypeScript verifier, no Python access)

Determinable from normative text + vectors: bytes to hash, signed message,
chain semantics, lifecycle, result construction, invalid/unsupported/
indeterminate distinctions, trust/time meaning. Requires vectors or the
informative implementation record rather than normative text: control-character
escape forms, supplementary-plane key ordering, surrogate-escape handling
(exactly the C1 list). The 2E.1 independent review's REV-001 finding and the
suite-passing-but-defective surrogate lookahead found in self-review both
demonstrate that "the suite passes" under-constrains implementations at the
margins the prose doesn't cover. Verdict: feasible today only if the vectors
are treated as the spec of last resort; C1 removes that dependency.

## Vectors vs specification

The 120-vector corpus is adequate as a **first** release corpus: it pins every
DIV ruling, the number-lexical families, Unicode families including
supplementary keys and controls, parser negatives, tamper/chain/lifecycle/
trust/time families, and one specification-conflict case. Known thin areas
(non-blocking, additive under the existing immutability governance): only one
surrogate vector (invalid lone-surrogate; no valid escaped-pair vector — the
historical masked parser defect area), single invalid-UTF-8 case, no malformed
SPKI/key-format negatives, no deep-nesting-at-limit boundary pair. Suite
governance (release plan §Breaking changes) already provides the additive
path: new vectors = new suite revision, never in-place edits, no protocol
version change required.

## Release identity and versioning (recommendation)

- Release the **unchanged frozen bytes** identified by manifest SHA-256
  `864e8043…`. Do **not** edit `manifest.json` (its `protocol_status:
  "frozen-candidate"` and `suite_revision: "1.0.0-candidate.1"` are inside the
  frozen hash); the promotion act is an external release record, exactly as
  `schema-1-release-plan.md` step 7 prescribes (`RELEASE.md`) and as RFC 000's
  artifact-precedence rule requires (a release manifest records ratification —
  this is also what flips RFC "candidate requirements" to normative).
- Recommended public label: **"Igris Schema-1 Conformance Suite v1.0.0"**,
  with the release record stating: released bytes = suite revision
  `1.0.0-candidate.1`, manifest `864e8043…`, promoted without modification.
- Keep four version axes explicitly separate (RFC 008 support-matrix rule):
  schema-1 profile (permanent, frozen; not "Protocol v1 ratified" — RFC 001
  remains Draft and the release must not claim otherwise), conformance-suite
  release (v1.0.0), SDK package (0.1.0a2 lineage), verifier binary (unversioned
  today; binary publication is post-release work, not part of this promotion).
- Future additive adversarial vectors: conformance-suite revision only; no new
  protocol version; released revisions immutable.

## Claims, threat model, and limitations (assessed honest)

RFC 003 "Explicit non-claims" is exemplary and covers every mandated
limitation: producer attestation (signer ≠ person/org; host may be
compromised), signature validity ≠ trust, trust ≠ authorization, chain
continuity ≠ completeness (tail-truncation named, with a test reference),
outcome ≠ external side effect, redaction ≠ anonymity, timestamps
producer-asserted, checkpoints future/optional (RD-12 domain reserved),
Connected not required for verification (zero-network invariant + tests), no
mediated-signing claim for Embedded. RFC 004 provides a threat/residual table;
RD-11 lists known limitations. SDK README language sampled: "internal tamper
evidence — the hash chain detects modification", "local developer proof, not a
production guarantee", "does not guarantee anonymity" — no absolute-immutability
or compliance-automation claims found. The pre-v2 specialist cryptographic
review of the *future* `igris-ed25519-sha256-1` suite remains an explicit open
gate; it is **not** a schema-1 release blocker because schema-1 claims nothing
about that suite.

## Developer consumability

Gap (C3): `conformance/go-verifier/` has no consumer-facing README — build/run
instructions, `igris-verify verify|artifact|vectors` usage, stdin vs file
paths, machine-report shape, and the exit-code contract (0 pass / 1 mismatch /
2 invalid invocation / 3 unsupported capability / 4 I/O) live only in the
implementation record and CLI tests. The Python-side `igris verify` UX is
documented in the SDK README. An external evaluator needs the standalone
quickstart plus a "what a result proves / does not prove" pointer.

Additional packaging staleness (C2): `suite-schema-1/CANDIDATE.md` (not
manifest-covered) still says the standalone verifier "is not part of this
candidate" and describes DIV-001 as blocking — both superseded by Clock
2D/2E/2F.0 facts. The release record must supersede it (do not rewrite frozen
history; add the release record and, at most, a forward pointer).

## Conditions (Clock 2F.1 — specification/documentation only, no byte changes)

- **C1 — Normative legacy-serialization completion.** Promote the frozen
  string-serialization facts into normative text (amend RFC 003 §Canonical
  encoding and/or a dedicated schema-1 profile page): exact escape table,
  key-sort comparison unit (Unicode scalar sequence = UTF-8 byte order),
  input `\u`-escape and surrogate rules, schema-1 duplicate-member and
  trailing-content classification, limits-are-implementation-declared. Must
  document existing frozen behavior only; the four pinning vectors are the
  acceptance oracle.
- **C2 — Release record.** Add `RELEASE.md` per plan step 7 (manifest and file
  hashes, release label, promotion statement, supersession of CANDIDATE.md
  status text), satisfying RFC 000's release-manifest ratification rule.
- **C3 — Standalone verifier consumer README** (build, usage, exit codes,
  result meaning, suite invocation).

Post-release (non-blocking, recorded): additive adversarial vectors
(valid surrogate pairs, invalid-UTF-8 variants, malformed SPKI, boundary
depth/size, more numeric variants, denial-family expansion), TypeScript
verifier, trust bundles/rotation/revocation, trusted time, checkpoints,
mediated signing profile, Evidence v2 + ActionContract v2 (both gated on the
specialist signature-suite review), binary publication.

## What this review did not do

No frozen artifact, vector, manifest, schema, workflow, or implementation file
was modified. No release was published, no tag created, no PR merged. Hosted CI
was not re-triggered; the existing green run was independently confirmed. The
verdict authorizes Clock 2F.1 (conditions) followed by release execution; it
does not itself release Schema-1.
