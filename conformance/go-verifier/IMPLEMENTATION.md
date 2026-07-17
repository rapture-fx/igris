# Standalone Go verifier — Clock 2E implementation plan and independence boundary

Status: **Clock 2E implementation record; written before code, kept current
with the implementation**

Base commit: `132dee62ba488f5f58d652de899a9e8fbce1474b`
Frozen candidate manifest SHA-256:
`864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`

## Purpose

Implement the offline C2 verifier specified in
[`docs/rfcs/standalone-go-verifier-design.md`](../../docs/rfcs/standalone-go-verifier-design.md)
directly from the frozen normative artifacts, without importing, copying, or
mechanically translating any maintained production verification code.

## Normative inputs actually used

- `docs/rfcs/protocol-design-freeze-candidate.md` (frozen invariants 56–65)
- `docs/rfcs/protocol-resolved-decisions.md` (RD-11 legacy profile; RD-02 for
  contrast only — the future profile is deliberately NOT implemented here)
- `docs/rfcs/001..008` (schema `1` object fields, hash and signature inputs,
  chain semantics, conformance runner contract)
- `spec/verification-result-schema-draft.md` (dimensions, 39-code registry,
  summary precedence, issue ordering)
- `spec/schemas/verification-result-1.schema.json` (machine shape)
- `spec/test-vectors/schema-1-release-plan.md` (families, expected-result rules,
  runner comparison rules, mutation format)
- `spec/test-vectors/suite-schema-1/**` — the frozen candidate bytes and the
  120 expected results (executable protocol truth)
- `docs/rfcs/schema-1-known-implementation-divergences.md` (DIV-001/DIV-002)

Production sources were consulted only for integration-boundary discovery:
`conformance/schema1/python/runner.py` (candidate-runner invocation contract:
per-family vector→invocation mapping, mutation directive operations,
key-reference loading, expected-result comparison rule). The maintained
verification implementations — `sdk/python/src/igris/legacy_schema1.py`,
`sdk/python/src/igris/verification.py`, `igris-overture/internal/schema1json`,
`igris-overture/internal/canonicaljson`, `igris-overture/api/evidence_verify.go`
— were **not** read, imported, or translated for this implementation.

## Module boundary

`conformance/go-verifier` is a **separate Go module**
(`github.com/Igris-inertial/system/conformance/go-verifier`) so the root
module's packages cannot enter its build graph without an explicit
`require` of the root module, which never exists. Dependencies are the Go
standard library only; `go.sum` stays absent/empty.

```text
conformance/go-verifier/
  go.mod                    — standard library only
  cmd/igris-verify/         — CLI frontend (verify alias + artifact + vectors)
    main.go
    main_test.go            — CLI integration tests (files, stdin, exit codes,
                              secret-free output, frozen-suite vectors mode)
  verifier/                 — reusable verification core (library-first)
    limits.go               — bounded-work profile
    legacyjson.go           — independent bounded schema-1 parser + exact
                              canonical reconstruction (lexeme-preserving)
    result.go               — verification-result-1 model, 39-code registry,
                              deterministic issue ordering, summary rules
    schema1.go              — frozen schema-1 shape rules (closed contract,
                              open evidence) + unsigned-payload extraction
    verify.go               — ActionContract / Evidence-event / legacy-value
                              verification pipelines + trust overlay
    chain1.go               — Evidence chain continuity, fork, lifecycle,
                              anchor, and checkpoint-head verification
    keys.go                 — Ed25519 key loading (PEM SPKI via encoding/asn1,
                              raw base64, hex) and fail-closed resolution
    legacyjson_test.go      — parser/canonicalizer adversarial tests
    verify_test.go          — tampering, key-failure, chain, lifecycle,
                              trust-overlay, and no-leak behavior tests
    independence_test.go    — go list -deps architecture guard
    fuzz_test.go            — parser and verification fuzz targets
  runner/                   — frozen-manifest conformance runner
    manifest.go             — manifest loading, path safety, hash re-checking
    runner.go               — vector evaluation and exact result comparison
    schemacheck.go          — validator driven by the frozen result schema
```

## Prohibited imports (mechanically enforced)

- any package under `github.com/Igris-inertial/system/igris-overture/...`
- any package of the root module at all (schema1json, canonicaljson, api,
  billing, database, migrations)
- any Python bridge, subprocess call to Python, or network client
- any third-party module

Enforcement: `verifier/independence_test.go` runs `go list -deps ./...` and
fails on any non-standard-library dependency; CI repeats the same check and
greps the source tree for prohibited import paths. The CLI performs no DNS,
socket, or subprocess operation.

## Verification pipeline (from the design doc)

specification gate → bounded read → UTF-8/JSON/JSONL parse (duplicate member,
trailing content, depth/size limits, lexeme capture) → schema dispatch →
schema `1` shape validation → exact legacy canonical reconstruction → SHA-256
hash comparison → key resolution (declared lookup IDs; ambiguity fails
closed) → Ed25519 over the recomputed raw digest → chain continuity/anchor →
schema `1` decision/outcome lifecycle → declarative trust/time overlay →
deterministic result aggregation.

## Frozen schema-1 profile facts the implementation encodes

- Canonical bytes: sorted keys (Unicode scalar order = UTF-8 byte order),
  `,`/`:` separators, raw UTF-8 non-ASCII including U+2028/U+2029, `<>&/`
  unescaped, `"`→`\"`, `\`→`\\`, `\b \t \n \f \r` short escapes, other
  controls as lowercase `\u00xx`, no trailing newline.
- Every accepted number token's original lexeme is preserved verbatim and
  re-emitted byte-for-byte; a lost lexeme fails closed with
  `unsupported_legacy_representation`.
- Lone surrogate escapes parse syntactically but fail canonicalization with
  `invalid_unicode_scalar` (pinned by `can1-invalid-surrogate-001`).
- Evidence unsigned payload = full event minus `event_hash`+`signature`,
  unknown fields included; `event_hash` = lowercase SHA-256 hex; signature =
  Ed25519 over the recomputed raw 32-byte digest, standard padded base64.
- `key_id = "ed25519:" + SHA-256(raw pubkey).hex()[:16]`; resolution is by
  declared lookup ID; two distinct keys under one ID are `ambiguous_key`.
- ActionContract schema `1` is a closed schema; Evidence schema `1` is open
  with `unknown_fields_present` as a warning diagnostic.
- Chains: JSONL order, null genesis or explicit trusted anchor, submitted
  hashes are followed after an adverse event for diagnostic isolation while
  the chain result stays adverse; `events_verified` counts events whose
  required checks including local continuity all passed.
- Limits (conformance profile, not signed-byte semantics): 1 MiB input,
  64 KiB per chain event, 500 events, 64 nested containers, 4 KiB key
  material, 20 retained issues.

## Runner contract

`igris-verify vectors --manifest <path>`: verifies every manifest file
SHA-256 (321/321) before running, rejects unsafe paths/duplicate IDs/foreign
formats, applies mutation directives (`verify_partial_segment`,
`require_checkpoint_head`, `ambiguous_key_resolution`,
`use_wrong_public_key`, `drop_numeric_lexemes`) as *inputs* to the standalone
verifier, compares exact canonical bytes where declared and the complete
verification-result object structurally, and emits a machine-readable report.
Exit codes: 0 pass, 1 conformance mismatch, 2 invalid invocation/corrupt
suite, 3 unsupported capability, 4 local I/O failure.

The runner never invokes Python, the production Go verifier, or the network.

## Deliberate non-goals

No signing, no private-key handling beyond refusing to load it, no
Evidence v2 / ActionContract v2 / future-suite semantics, no Connected, no
database, no TOFU persistence, no policy engine. `policy` is always `null`.
