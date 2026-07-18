# Igris Schema-1 Conformance Suite — release record

Status: **Release record prepared under Clock 2F.1; promotion becomes
effective only when the release-execution gate completes after independent
confirmation of the Clock 2F conditions. Until then Schema-1 remains an
unreleased frozen candidate.**

## Release identity

- Public release label: **Igris Schema-1 Conformance Suite v1.0.0**
- Released bytes: the unmodified frozen candidate identified below. This
  record promotes the immutable bundle **by reference**; it does not and must
  not modify the bundle.
- Internal immutable identifiers (inside the frozen manifest, unchanged):
  - `suite_id`: `igris-schema-1-conformance`
  - `suite_revision`: `1.0.0-candidate.1`
  - `protocol_status`: `frozen-candidate`
- `manifest.json` SHA-256:
  `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4`
- Tracked artifacts under the manifest: **321**, each pinned by SHA-256 in
  `manifest.json`; per-file hashes are therefore recorded by reference to the
  manifest rather than duplicated here.
- Conformance vectors: **120** (`ac1`=21, `can1`=46, `ev1`=52, `spec1`=1).

The manifest's internal `protocol_status`/`suite_revision` strings are part of
the frozen bytes and intentionally still read "candidate". This external
record — required by the release plan (step 7) and by RFC 000's
release-manifest ratification rule — is what confers released status; editing
the manifest to say "released" would change the very hash this release is
identified by and is prohibited.

## Version axes (deliberately separate)

| Axis | Value | Notes |
| --- | --- | --- |
| Schema-1 compatibility profile | permanent, frozen | Not "Protocol v1 ratified"; RFCs 000–008 remain Draft |
| Conformance-suite release | v1.0.0 (= frozen bytes of `1.0.0-candidate.1`) | This record |
| Python SDK package | 0.1.0a2 lineage | Reference producer; independent lifecycle |
| Standalone Go verifier | unversioned source, `conformance/go-verifier` | Binary publication is separate future work |

## Provenance

- Frozen-candidate ratification commit (recorded in the manifest):
  `938c8c27b96d38cd1819eb881d5fe57a197ddaa1`
- Independently implemented standalone Go verifier lineage, internally
  independently reviewed (Clock 2E.1 CONDITIONAL GO → REV-001 remediation →
  Clock 2E.3 GO): executable tip
  `85e716f044505d4e9ff9bfbb3d31de2763c8bc11`
- Hosted CI proof: GitHub Actions run `29630815953` at
  `12f8532d5770077b1a7b1ed4c905c2ce6c7b2ae0` (executable tree identical to
  the ratified lineage): Python 120/120, production Go 120/120, standalone
  Go 120/120, three-way differential zero, manifest 321/321, independence
  guard clean.
- Release-readiness review: Clock 2F CONDITIONAL GO,
  `docs/rfcs/reviews/schema1-release-promotion-normative-readiness-review.md`.

"Independently implemented and internally independently reviewed" means
separate implementations and reviewers within this project. It is **not**
external certification, formal standardization, or third-party audit, and no
such claim is made.

## Immutability and future revisions

The released bundle is immutable. Corrections and additive adversarial
vectors (for example escaped-surrogate-pair positives, further invalid-UTF-8
and malformed-key-material negatives, boundary depth/size cases) produce a
**new conformance-suite revision** with its own manifest and record; they
never modify this bundle, and they do not create a new protocol version.
Schema `1` itself is permanent: its canonical bytes, hash and signature
construction, and issue vocabulary do not change (RD-11).

## What this release does and does not claim

Verification against this suite proves byte-exact interoperability with the
frozen schema-1 profile for the behaviors the vectors pin. It does not make
evidence immutable (evidence is tamper-evident relative to a key), does not
establish signer identity, trust, or authorization, does not prove complete
history without an external anchor, does not prove external side effects
occurred, and does not constitute legal or regulatory compliance. See RFC 003
"Explicit non-claims" and RFC 004 for the full limitation set.
