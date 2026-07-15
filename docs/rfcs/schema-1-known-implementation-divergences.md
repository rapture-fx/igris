# Schema `1` known implementation divergences

Status: **Documentation-only compatibility record; production behavior
unchanged**

This record distinguishes the normative historical schema `1` profile from
current implementation conformance. It does not change or regenerate a signed
artifact, fixture, canonical byte, hash, or signature.

## DIV-001 — Go U+2028/U+2029 re-encoding

| Field | Record |
| --- | --- |
| Affected characters | U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR in any schema `1` string value |
| Normative producer baseline | Python 0.1.0a2 schema `1` canonicalization emits each scalar as raw UTF-8 (`E2 80 A8` and `E2 80 A9`) |
| Conforming implementation behavior | Reconstruct schema `1` canonical bytes with those raw UTF-8 sequences and verify the submitted hash/signature against them |
| Affected current implementation | Production Go canonical re-encoding used by Connected ingest |
| Current incorrect behavior | Go `encoding/json` escapes U+2028/U+2029 even when HTML escaping is disabled, producing different bytes and potentially `hash_mismatch`/signature rejection for a valid Python-signed artifact |
| Current Python behavior | Conforming for its own emitted schema `1` values; emits raw UTF-8 |
| Risk classification | Production interoperability defect; valid Python-signed evidence can be rejected by current Go Connected ingest |
| Existing coverage gap | Historical fixtures do not contain either scalar, so current green suites do not exercise the divergence |
| Required regression vectors | Separate raw-byte U+2028 and U+2029 cases, plus applicable ActionContract/Evidence string positions and mixed surrounding text |
| Required future production remediation | Implement schema-profile-aware Go reconstruction, add Go regression tests, and prove Connected ingest accepts valid Python-signed artifacts containing both characters |

Python-emitted bytes are authoritative for this historical producer case. The
Go escaped form is not an alternate canonical spelling. Verifiers must follow
the schema `1` profile and vectors rather than blindly reserialize through a
host-language default encoder.

## DIV-002 — Numeric-token normalization capability

| Field | Record |
| --- | --- |
| Affected inputs | Externally supplied schema `1` JSON containing valid number spellings not emitted identically by the Python reference producer, such as `1E+2` |
| Normative producer baseline | Python-emitted schema `1` artifacts retain the historical Python 0.1.0a2 number rendering |
| Verification compatibility rule | Preserve each accepted original JSON number-token lexeme and use that lexeme in schema `1` canonical reconstruction |
| Current divergence risk | Go can retain `json.Number` spelling while Python parsing/re-rendering can normalize it, so hostile/non-reference inputs can receive different results |
| Fail-closed result | If the verifier did not preserve a required lexeme: `canonicalization=unsupported`, issue `unsupported_legacy_representation`, summary `unsupported`, dependent checks `not_evaluated` |
| Risk classification | Cross-language verification hardening gap; not evidence that existing Python-produced fixtures differ |
| Required regression vectors | `1E+2`, `1e2`, `100`, `-0`, `0`, `0.0`, Python float boundaries, large integers near/beyond host limits, normalization differentials, and invalid JSON number forms |
| Required future production remediation | Implement schema `1` number-token preservation in affected verification paths and add identical Python/Go expected-result coverage |

Valid JSON is broader than Python schema `1` producer output. Numerically equal
tokens are not interchangeable signed representations. A verifier must never
normalize an untrusted token and then claim the normalized bytes were signed.

## Production follow-up gates

The following work is recorded but not authorized or implemented here:

1. **Fix Go schema-1 U+2028/U+2029 canonical verification** — production
   interoperability defect; use frozen vectors, retain Python bytes, add Go
   regressions, and verify Connected ingest.
2. **Implement schema-1 numeric lexical preservation** — cross-language
   verification hardening; preserve number tokens and fail closed when exact
   verification is unavailable.
3. **Specialist review of the future signature suite** — pre-v2 cryptographic
   gate covering Ed25519-over-SHA-256 framing, domain separation, collision
   properties, and substitution properties.

None may change historical schema `1` signed bytes. Items 1 and 2 require
separate production tasks after normative vectors exist. Item 3 must complete
before any new signed schema version is approved or emitted.
