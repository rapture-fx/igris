# ADR 0012: Verification, trust, and checkpoints remain decomposed

Status: **Proposed**
Date: 2026-07-15

## Context

A valid signature, a trusted signer, an authorized action, a complete chain,
and a true external side effect are different claims. A single pass/fail value
would obscure security-relevant distinctions and make offline verification
depend on an identity service.

## Decision

Portable verification reports parsing, schema, canonicalization, algorithm,
object hash, signature, key resolution, continuity, completeness, semantics,
trust, and time confidence separately. Trust policy consumes explicit scoped
key bindings and may return trusted, unknown, untrusted, revoked, or
interval-indeterminate conclusions without changing signature validity.

No global PKI, Igris cloud, certificate authority, transparency log, or trusted
clock is mandatory. TOFU is a named local policy. Connected organization
bindings are scoped, not universal identities.

Checkpoints are optional external signed objects in their own signature domain.
They are not required Evidence events and do not prove external side effects.

## Consequences

- Offline content verification remains possible with evidence and public keys.
- Historical trust evaluation requires retained binding/revocation inputs.
- Tail completeness remains unknown without an appropriate witness or closure
  claim.
- Connected can provide commercial trust lifecycle and witness services without
  becoming a protocol dependency.

## Rejected alternatives

Signature-valid-equals-trusted, mandatory cloud key lookup, producer timestamps
as trusted time, and mandatory checkpoints in every evidence stream are
rejected.
