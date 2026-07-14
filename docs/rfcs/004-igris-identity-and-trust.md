# RFC 004: Igris identity and trust

Status: **Draft**
Security posture: local verification without global PKI or cloud dependency

## Integrity versus attribution versus environment trust

These conclusions are independent:

| Property | Question |
| --- | --- |
| Integrity | Do bytes and signature match this public key? |
| Continuity | Does this segment link to the supplied/trusted chain state? |
| Attribution | Which person, organization, workload, or device controls the key? |
| Authorization | Was that attributed principal permitted to decide or act? |
| Environment trust | Was the signer running approved, uncompromised code in an acceptable environment? |
| External-side-effect truth | Did the claimed real-world effect occur? |

A valid Evidence v1 signature answers only the first question relative to a
key, plus continuity when chain inputs are present. It does not automatically
answer the others.

## Signing identity

A signing identity is a key plus the context needed to use and evaluate it.
It is not synonymous with a human identity.

**Current:** `LocalSigningIdentity` creates or loads one file-backed Ed25519
private key under `IGRIS_HOME`, writes the private key with user-only
permissions where supported, derives a public key, and exposes a truncated
`key_id`. Tests in `sdk/python/tests/test_identity.py` cover creation,
permissions, stability, corruption failure, round-trip signing, and private-key
non-exposure.

**Draft invariant:** Signing providers MUST keep private material out of
evidence, logs, error messages, synchronization payloads, and repositories.

## Key fingerprint

The v1 full fingerprint is lowercase SHA-256 of the raw 32-byte Ed25519 public
key. The event carries only the first 16 hex characters after `ed25519:`.

A trust store MUST bind a v1 key identifier to the full fingerprint/public key
and reject collisions. Display surfaces SHOULD show enough fingerprint to let
an operator compare keys without representing a truncated ID as globally
unique.

## Self-asserted local identity

The first-use local key is self-asserted. Offline verification with its public
key proves integrity relative to that key. It does not prove who created or
controlled it. This mode MUST remain supported without an account, network, or
Igris service.

## Trust-on-first-use

TOFU records the first observed full fingerprint for a local trust scope and
warns or fails on unexpected change. It can detect later substitution but
cannot prove the first key was authentic.

**Draft proposal:** TOFU MAY be an Embedded trust policy. Pin stores should be
scope-qualified, atomic, inspectable, and explicit about reset. TOFU state is
not Evidence v1 and can be added without changing event bytes.

## Bring-your-own-key

**Draft proposal:** A binding MAY accept a caller-managed Ed25519 signer or
key-management provider while preserving the exact v1 signature operation.
Key provenance and storage policy remain outside the event unless separately
attested. Support for different algorithms requires Evidence v2.

BYOK integrations SHOULD prefer non-exportable signing interfaces, least
privilege, auditable key use, and explicit failure behavior. They MUST NOT
silently fall back to an untrusted local key.

## Connected organization binding

**Current:** Evidence upload is authenticated to a tenant; the server derives
`key_id` from the submitted public key and registers the public key within that
tenant after a verified first batch. Tenant identity comes from authentication,
not request data. `routes_evidence_test.go::TestEvidenceTenantComesFromAuthContext`
and `TestEvidenceSubmitBodyTenantAndProvenanceFieldsRejected` enforce this.

This is an organization binding observed by the Connected service. It does not
retroactively prove who controlled the key before registration and does not
turn Embedded execution into Managed execution.

## Verifier trust store

**Draft invariant:** Trust evaluation consumes a trust store containing, at
minimum, scope, full public key/fingerprint, key status, validity observations,
and provenance of the binding. It SHOULD support:

- self-asserted/explicitly supplied keys;
- TOFU pins;
- organization-administered registrations;
- revoked/compromised intervals;
- policy version and evaluation time.

Cryptographic verification MUST remain possible without a trust store; its
result is then integrity-valid with trust unknown/untrusted.

## Key registration

Registration binds a full key to a trust scope. It MUST authenticate the
binding authority, derive rather than trust the v1 key ID, reject ambiguous
reuse, and record when/how the binding was established. Registration grants no
execution permission by itself.

Current Connected first-use registration is acceptable for private-alpha
coordination but leaves rotation/revocation policy open. A future registration
protocol is not part of Evidence v1.

## Key rotation

Rotation introduces a new key and a temporal or signed relationship to the old
key. It MUST NOT rewrite historical evidence or reuse an identifier for
different key material.

**Draft options:** administrator-authorized rotation; old-key-signed successor;
or both. Recovery when the old key is unavailable requires an independently
authenticated authority. Rotation links may be trust-store records rather than
evidence events.

## Key revocation

Revocation is a trust-policy statement that a key should not be trusted for a
scope after a time or for all time. It is not cryptographic erasure and does
not make old signatures mathematically invalid.

Revocation records SHOULD include key fingerprint, scope, effective time,
recorded time, reason category, authority, and status of timestamp confidence.
Offline verifiers may have stale revocation information and MUST report that
limitation.

## Compromise time

When compromise time is known with defensible confidence, trust policy may
distinguish signatures before and after that time. Producer timestamps alone
are not sufficient because they are untrusted. A trusted checkpoint, receipt
time, or transparency inclusion can bound when evidence existed.

If compromise time is unknown, policy may mark all evidence under that key as
indeterminate or untrusted; it MUST NOT fabricate a precise safe interval.

## Historical evidence after revocation

A verifier should return both:

- cryptographic result: signature valid/invalid under the historical key;
- trust result: trusted at claimed/observed time, revoked, compromise-affected,
  or unknown.

Historical evidence remains parseable and verifiable indefinitely when its
schema, algorithm, key, and bytes remain available. Retention of trust metadata
is a separate operational obligation.

## Cross-organization verification

Cross-organization evidence requires the relying party to decide which foreign
binding authorities it trusts. Matching an Igris Connected tenant registration
is not universal federation. Exported trust bundles, bilateral pins, or
federated assertions are future options and MUST preserve the organization
scope of key bindings.

## Offline verification

Offline verification MUST require only evidence, the schema/algorithm
implementation, and the public key for content integrity. Optional trust
bundles, revocation snapshots, and checkpoints may strengthen the report.
Network failure MUST NOT turn a locally checkable signature into invalid; it
may make current trust status unavailable.

## Transparency-log option

A transparency log could witness key registrations, rotations, revocations,
or chain checkpoints. It may improve equivocation and tail-truncation detection
but introduces availability, privacy, gossip, and operator-trust questions.

This is optional and future. Protocol v1 does not require a log, and log
inclusion MUST NOT be confused with truth of external side effects.

## Hardware and workload identity future options

Hardware-backed keys, platform attestation, SPIFFE-like workload identities,
and confidential-compute reports may supply stronger environment attribution.
They require verifier profiles, freshness/replay analysis, endorsement roots,
privacy review, and downgrade rules. None is selected for v1.

## Threat model

| Threat | v1 control | Residual |
| --- | --- | --- |
| Event modification | Hash plus Ed25519 signature | Compromised key can sign false content |
| Reorder/middle deletion | Previous-hash chain | Tail deletion without checkpoint |
| Wrong public key | Key ID derivation/full-key comparison | Truncated-ID collision if trust store is careless |
| Tenant spoofing on upload | Auth-derived tenant, body fields rejected | Compromised tenant credential |
| Key substitution | Tenant-scoped binding/conflict | First-use authenticity; admin compromise |
| False human attribution | Explicit non-claim | Requires independent identity binding |
| False environment claim | Managed provenance separation | Embedded host may be compromised |
| Stale revocation | Optional trust metadata | Offline verifier may not know latest status |
| Secret leakage | Redaction/privacy preflight | Undeclared or low-entropy sensitive data |
| Signature replay | Event IDs/chain context | No signed audience/stream/domain separation in v1 |

## Explicit non-goals for v1

- A global PKI, certificate authority, or mandatory Igris cloud root.
- Proving human presence or organization approval from a signature alone.
- Remote attestation, hardware identity, trusted time, or transparency logs.
- Automated key escrow or recovery.
- A new signature algorithm or change to v1 key IDs.
- Making a compromised Embedded host trustworthy.
- Proving external side effects.
