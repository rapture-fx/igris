# Clock 2E — Standalone Go verifier implementation self-review

Status: **implementation-complete; awaiting a separate independent Clock 2E
review. This record is a self-review and is not independent ratification.**

- Base commit: `132dee62ba488f5f58d652de899a9e8fbce1474b`
- Branch: `feat/igris-standalone-go-verifier`
- Frozen manifest SHA-256:
  `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`
  (unchanged; 321/321 entries intact; zero vector, canonical-byte,
  expected-result, signature, or fixture changes)

## Scope of the delta

New, fully additive:

- `conformance/go-verifier/` — standalone verifier module (core, CLI, runner,
  tests) with a standard-library-only build graph;
- `conformance/schema1/three_way_differential.sh` — three-implementation
  differential harness;
- two appended CI jobs plus path triggers in
  `.github/workflows/schema1-conformance-candidate.yml`
  (`standalone-verifier`, `three-way-differential`); the existing
  `python-candidate` and `existing-go-path` jobs are untouched;
- this record and the updated `conformance/go-verifier/IMPLEMENTATION.md`.

No maintained production source file, vector file, or Python file changed.

## Validation results at review time

| Check | Result |
| --- | --- |
| Standalone verifier, frozen suite | **120/120** (families 47/21/22/18/12) |
| Maintained Python runner | **120/120** |
| Maintained production Go path | **PASS, 120 vectors consumed** |
| Three-way differential | **zero differentials** |
| U+2028/U+2029 vectors (4) | pass, raw UTF-8 reconstruction |
| Numeric-lexical vectors | pass, exact lexeme preservation |
| DIV-001 / DIV-002 exemptions honored | **0 / 0** (labels ignored; every vector exact) |
| `go test ./...` (unit, adversarial, CLI) | pass |
| Fuzz smoke (2 targets × 30 s, ~216 k execs) | no panic, determinism + fixed point hold |
| Independence guard (`go list -deps`) | Go standard library only; no `net`, `net/http`, `os/exec`, `database/sql`, no `igris-overture/...` |
| No-network/no-database run (dead proxies, `GOPROXY=off`, stripped env) | 120/120 + all tests pass |
| `gofmt`, `go vet`, `go build`, YAML parse | clean |

## Defects found and fixed during implementation review

1. **Runner over-comparison of provenance hashes (2 fixes).** The expected
   files' top-level `event_hash`/`object_hash` record the artifact's
   *submitted* hash as vector provenance. The first runner draft compared the
   verifier's recomputed hash against them unconditionally, failing 7 negative
   vectors where verification correctly stops before hashing, then 1 more
   where the recomputed hash legitimately differs (tampered payload). The
   comparison now applies only when the result's `object_hash` dimension is
   `valid`; a wrongly skipped or wrongly passing computation still fails the
   exact verification-result comparison. Runner semantics only — no verifier
   or vector change.
2. **Parser surrogate-pair off-by-one.** In the high-surrogate lookahead the
   position advanced past `\u` before calling the hex reader, which consumes
   one more byte itself, so every `\uXXXX\uXXXX` sequence (valid pairs and
   lone-surrogate sequences alike) failed to parse. Found by the new
   adversarial tests; the frozen suite has no escaped-surrogate-pair vector,
   so 120/120 had masked it. Fixed and pinned by
   `TestCanonicalStringEscapes` and
   `TestLoneSurrogateFailsCanonicalizationNotParse`.
3. **`LoadPublicKey` encoding-order bug.** A 64-character hex key is
   alphabet-valid base64 of the wrong decoded length; the base64 branch
   errored before the hex branch ran. Each encoding is now accepted only when
   it yields exactly 32 bytes. Found by the CLI stdin integration test.
4. **`crypto/x509` pulled `net` into the build graph.** PEM key parsing now
   uses a focused RFC 8410 SubjectPublicKeyInfo decoder over `encoding/asn1`,
   making the no-network property statically provable
   (`net` absent from `go list -deps`). Verified against the frozen
   `alpha2-historical.public.pem` vector key.

## Mandatory review questions

- **Coupled to production while passing vectors?** No. The module is a
  separate Go module; `go list -deps` shows only standard-library and
  module-local packages, enforced by `independence_test.go` and the CI guard.
  Production Go/Python sources were consulted only for the runner invocation
  contract (documented in IMPLEMENTATION.md), and the runner consumes the
  frozen manifest directly rather than a derived corpus.
- **Numeric tokens normalized anywhere?** No. The parser records each
  accepted number token's exact lexeme; canonical output re-emits it
  verbatim; a lost lexeme fails closed
  (`unsupported_legacy_representation`). `encoding/json` never touches
  canonical bytes — it encodes only the portable result object (registered
  ASCII enums, hex hashes, integers).
- **U+2028/U+2029 re-escaped by a hidden step?** No. The only canonical-byte
  serializer is `EncodeLegacyCanonical`, which passes all non-ASCII scalars
  through as raw UTF-8; pinned by 4 frozen vectors and unit tests in both
  raw and escaped input forms.
- **Valid signature relabeled invalid by trust/policy?** No. The trust
  overlay runs after cryptographic evaluation and only sets
  `trust`/`time_confidence`; `TestTrustOverlayConclusions` asserts
  `signature` stays `valid` under every overlay, and 12 frozen trust vectors
  pin the split.
- **Panic or exhaustion on malformed input?** Bounded input size, per-event
  size, event count, nesting depth, key size, and issue count; no recursion
  on attacker-controlled depth beyond the bound; fuzz targets assert no
  panic and well-formed results for arbitrary bytes.
- **Unknown schema downgrade?** No. Any `schema_version` other than `"1"`
  (or a non-string) stops before canonical/crypto evaluation with
  `unsupported_schema`; pinned by frozen vectors and
  `TestEvidenceEventUnsupportedSchema`.
- **Indirect network requirement?** No. Statically: no `net` in the build
  graph. Dynamically: full conformance and tests pass with proxies pointed
  at a dead port, `GOPROXY=off`, and database/cloud variables stripped.
- **CLI leakage?** Stdout carries exactly one result object; `--human` prints
  registered enum values and issue codes to stderr only.
  `TestResultNeverEchoesPayloadValues` and `TestCLIHumanModeNeverEchoesPayload`
  assert distinctive payload values never appear in any output.
- **Silent divergence from the 39-code registry?** The registry in
  `result.go` contains exactly the 39 registered codes with fixed severities
  and phase order; `newIssue` panics on an unregistered code (a programming
  error, unreachable from input); the runner validates every emitted result
  against the frozen JSON schema, whose enum closes the code set.
- **Are the three implementations producing equivalent conclusions?** Yes on
  the full frozen surface: each enforces exact equality against the same 120
  expected verification results and all pass; the differential script fails
  on any relaxation of that equivalence.

## Residual risks and known limitations

- Eight registered issue codes (`invalid_null`, `canonicalization_failed`,
  `integer_out_of_range`, `unsupported_algorithm`, `missing_signature`,
  `partial_chain`, `unresolved_execution`, `time_confidence_unavailable`)
  are never emitted by this implementation because no frozen vector reaches
  them; they remain registered for result-schema completeness. An
  independent reviewer should confirm none is required by a vector family
  this implementation routes to a different registered code.
- The chain walk follows submitted hashes after an adverse event for
  diagnostic isolation; the frozen chain vectors pin this, but adversarial
  orderings outside the vector families rely on unit tests only.
- The CLI's structural artifact-type detection (`verify` alias) is
  convenience framing outside the frozen protocol surface; `--type` and the
  explicit `artifact` command bypass it. Detection failure exits 3 and never
  downgrades verification.
- Trust overlays are declarative vector inputs; no key-pinning store, TOFU,
  or revocation source is implemented (by design, out of scope).
- Fuzzing is smoke-depth (bounded seconds per run), not a soak.
- Hosted CI for the new jobs has **not** been observed; the branch is
  unpushed. All validation above is local CI-equivalent.

## Independent-review readiness

Ready. Recommended narrow scope: implementation independence (dependency
graph + source provenance), parser/canonicalizer correctness against RD-11,
cryptographic message construction, the 120-vector run from a fresh
checkout, verification-result mapping, CLI behavior, and the residual-risk
items above. The schema-1 suite remains a frozen candidate; this review does
not self-authorize release promotion.
