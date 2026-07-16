# Schema `1` known implementation divergences

Status: **Historical compatibility record; DIV-001 and DIV-002 remediated in
maintained production verification paths; frozen candidate not released**

This record distinguishes the normative historical schema `1` profile from
current implementation conformance. It does not change or regenerate a signed
artifact, fixture, canonical byte, hash, or signature.

## DIV-001 — Go U+2028/U+2029 re-encoding

| Field | Record |
| --- | --- |
| Affected characters | U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR in any schema `1` string value |
| Normative producer baseline | Python 0.1.0a2 schema `1` canonicalization emits each scalar as raw UTF-8 (`E2 80 A8` and `E2 80 A9`) |
| Conforming implementation behavior | Reconstruct schema `1` canonical bytes with those raw UTF-8 sequences and verify the submitted hash/signature against them |
| Originally affected implementation | Production Go canonical re-encoding used by Connected ingest |
| Original incorrect behavior | Go `encoding/json` escaped U+2028/U+2029 even when HTML escaping was disabled, producing different bytes and potentially `hash_mismatch`/signature rejection for a valid Python-signed artifact |
| Current Python behavior | Conforming for its own emitted schema `1` values; emits raw UTF-8 |
| Risk classification | Production interoperability defect; valid Python-signed evidence can be rejected by current Go Connected ingest |
| Existing coverage gap | Historical fixtures do not contain either scalar, so current green suites do not exercise the divergence |
| Required regression vectors | Separate raw-byte U+2028 and U+2029 cases, plus applicable ActionContract/Evidence string positions and mixed surrounding text |
| Remediation status | Remediated by `c4f2eba2f3e3c84b6835dfb70c27e06c24cbbf92`; the shared schema-1 compatibility encoder emits raw UTF-8 and is used by Go Evidence verification, Connected ingest, and ActionContract verification |
| Frozen proof vectors | `can1-valid-u2028-raw-001`, `can1-valid-u2029-raw-001`, `ev1-valid-u2028-signed-001`, `ev1-valid-u2029-signed-001` |

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
| Original divergence risk | Go could retain `json.Number` spelling while Python parsing/re-rendering normalized it, so hostile/non-reference inputs could receive different results |
| Fail-closed result | If the verifier did not preserve a required lexeme: `canonicalization=unsupported`, issue `unsupported_legacy_representation`, summary `unsupported`, dependent checks `not_evaluated` |
| Risk classification | Cross-language verification hardening gap; not evidence that existing Python-produced fixtures differ |
| Required regression vectors | `1E+2`, `1e2`, `100`, `-0`, `0`, `0.0`, Python float boundaries, large integers near/beyond host limits, normalization differentials, and invalid JSON number forms |
| Remediation status | Remediated by `c4f2eba2f3e3c84b6835dfb70c27e06c24cbbf92` (Go/Connected) and `9a3023c2df702e9fbe7abc1a922323bc449a4a31` (Python verification/sync); raw token lexemes are retained and coerced host numbers fail closed |
| Frozen proof vectors | `can1-unsupported-number-lexeme-lost-001`, `can1-valid-large-integer-001`, `can1-valid-number-1Eplus2-001`, `can1-valid-number-1e2-001`, `can1-valid-number-beyond-safe-001`, `can1-valid-number-negative-zero-001`, `can1-valid-number-zero-point-zero-001` |

Valid JSON is broader than Python schema `1` producer output. Numerically equal
tokens are not interchangeable signed representations. A verifier must never
normalize an untrusted token and then claim the normalized bytes were signed.

## Production remediation result and remaining gate

Clock 2D completed the two production interoperability remediations without
changing the frozen candidate:

1. **Go schema-1 U+2028/U+2029 canonical verification** — remediated across
   maintained Go verification and Connected ingest with the unchanged frozen
   vectors.
2. **Schema-1 numeric lexical preservation** — remediated across maintained
   Python and Go raw-input paths; unavailable lexemes fail closed.

The following separate future gate remains:

3. **Specialist review of the future signature suite** — pre-v2 cryptographic
   gate covering Ed25519-over-SHA-256 framing, domain separation, collision
   properties, and substitution properties.

No remediation changed historical schema `1` signed bytes, and this record does
not promote the frozen candidate to released status. Item 3 must complete
before any new signed schema version is approved or emitted.
