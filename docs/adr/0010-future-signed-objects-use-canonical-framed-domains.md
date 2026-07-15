# ADR 0010: Future signed objects use canonical framed domains

Status: **Proposed**
Date: 2026-07-15

## Context

Schema 1 signs its historical digest convention without object-type or version
domain separation. Changing those bytes would invalidate existing evidence,
but copying that convention into future schemas would permit avoidable
cross-object and downgrade ambiguity.

## Decision

Schema 1 is a permanent legacy profile. Future signed schemas use
`igris-canonical-json-1` and the length-prefixed signature frame defined in
`docs/rfcs/protocol-resolved-decisions.md`. The frame binds a fixed magic,
frame version, object domain, schema identifier, signature-suite identifier,
and canonical unsigned payload. Ed25519 signs SHA-256 of the complete frame for
suite `igris-ed25519-sha256-1`.

This is a proposed pre-hash construction, not a cryptographically approved
suite. Its security depends on SHA-256 collision resistance and does not retain
pure Ed25519's direct-message collision-resilience property. Specialist
cryptographic review of the composition, domain separation, collision
properties, and substitution properties is required before any new signed
schema using it is approved or emitted.

ActionContract attestation, Evidence, trust artifact, and checkpoint signatures
use different domains. The semantic ActionContract remains content-addressed;
publisher attribution is a separate signed attestation so signer rotation does
not alter contract identity. Algorithm or suite substitution is never
automatic.

## Consequences

- Existing schema-1 bytes and signatures remain permanently unchanged.
- Future verification dispatches schema and suite before cryptography.
- Canonicalization, framing, and negative cross-domain vectors are release
  prerequisites for every new signed schema.
- Specialist cryptographic approval is a release prerequisite; this ADR does
  not authorize Evidence v2 or ActionContract v2.
- Algorithm agility occurs through a new registered suite, not fallback.

## Rejected alternatives

Changing schema 1, signing ambiguous concatenations, signing bare canonical
bytes, and runtime-library algorithm names are rejected.
