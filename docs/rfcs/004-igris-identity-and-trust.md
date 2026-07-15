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

Future signed schemas use the full key reference
`ed25519-sha256:<64-lowercase-hex-digits>`. The reference is an identifier for
the raw Ed25519 public key, not a certificate subject, account, organization,
or authorization grant. Schema 1 retains its existing truncated reference
without reinterpretation.

## Self-asserted local identity

The first-use local key is self-asserted. Offline verification with its public
key proves integrity relative to that key. It does not prove who created or
controlled it. This mode MUST remain supported without an account, network, or
Igris service.

## Trust-on-first-use

TOFU records the first observed full fingerprint for a local trust scope and
warns or fails on unexpected change. It can detect later substitution but
cannot prove the first key was authentic.

**Candidate invariant:** TOFU MAY be an Embedded trust policy. Pin stores should be
scope-qualified, atomic, inspectable, and explicit about reset. TOFU state is
not signed evidence and can be added without changing event bytes. A verifier
MUST report TOFU as the policy that produced a trust conclusion; it MUST NOT
present a first-use pin as independently authenticated identity.

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

**Candidate invariant:** Trust evaluation consumes explicit trust inputs. A
minimum usable trust binding has these logical slots:

| Slot | Required semantics |
| --- | --- |
| signer key or reference | The public key bytes, or an exact reference resolvable from supplied inputs |
| key fingerprint | Full algorithm-qualified fingerprint derived from the public key |
| subject binding | The asserted human, workload, device, organization, or local subject, if any |
| binding authority | Who asserted the subject-to-key relationship; self-asserted is explicit |
| trust scope | The audience, publisher namespace, tenant, application, or other scope in which the binding is evaluated |
| validity interval | Optional start/end bounds and the confidence of the time source |
| revocation status | Good, revoked, unknown, or unavailable, plus effective/observed times when known |
| verification policy | Named/versioned local policy that maps facts and bindings to a trust result |
| historical artifact | Retained binding/revocation material sufficient to reproduce the historical evaluation |

The serialization of a portable trust bundle remains deferred. Implementations
MAY store these slots in any inspectable representation until a signed trust
artifact is standardized. A future signed trust artifact uses the
`igris.trust-artifact` signature domain and a closed, independently versioned
schema.

A trust store SHOULD support:

- self-asserted/explicitly supplied keys;
- TOFU pins;
- organization-administered registrations;
- revoked/compromised intervals;
- policy version and evaluation time.

Cryptographic verification MUST remain possible without a trust store when the
public key is supplied. Its result is then cryptographically valid with trust
unknown; absence of trust data is not itself evidence that a key is malicious.
The portable result vocabulary is defined in
[`verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md).

## Key registration

Registration binds a full key to a trust scope. It MUST authenticate the
binding authority, derive rather than trust the v1 key ID, reject ambiguous
reuse, and record when/how the binding was established. Registration grants no
execution permission by itself.

Current Connected first-use registration is a Connected-local binding for
private-alpha coordination. It is not a protocol-wide identity assertion. A
portable registration or trust-artifact schema is not part of Evidence v1 and
remains a future decision.

## Key rotation

Rotation introduces a new key and a temporal or signed relationship to the old
key. It MUST NOT rewrite historical evidence or reuse an identifier for
different key material.

Rotation MAY be administrator-authorized, old-key-signed, or both, according to
the relying policy. Recovery when the old key is unavailable requires an
independently authenticated authority. Rotation links belong in trust inputs,
not core evidence events. Every evidence event remains verified with the key it
actually references; a rotation never changes historical signed bytes.

## Key revocation

Revocation is a trust-policy statement that a key should not be trusted for a
scope after a time or for all time. It is not cryptographic erasure and does
not make old signatures mathematically invalid.

Revocation records SHOULD include key fingerprint, scope, effective time,
recorded time, reason category, authority, and timestamp confidence. A verifier
MUST NOT turn a cryptographically valid signature into `invalid_signature`
because the key is revoked. It reports the cryptographic fact and the policy
outcome separately. Offline verifiers may have stale revocation information
and MUST report that limitation.

## Compromise time

When compromise time is known with defensible confidence, trust policy MAY
distinguish signatures before and after that time. Producer timestamps alone
are not sufficient because they are untrusted. A trusted checkpoint, receipt
time, or transparency inclusion can bound when evidence existed.

If compromise time is unknown, policy may mark all evidence under that key as
indeterminate or untrusted; it MUST NOT fabricate a precise safe interval.
When trustworthy time is unavailable, the verifier reports
`time_confidence = producer_asserted` when only the producer claim exists, or
`unavailable` when no usable time basis exists. `unknown`, `claimed`, and
`inferred` are not registered `time_confidence` values. These values classify
the strongest time-evidence basis actually evaluated; they are not identity
facts or policy authorization labels.

If an applicable binding interval exists but trustworthy time cannot place the
artifact inside or outside it, trust is `binding_interval_indeterminate`, issue
`binding_interval_indeterminate`, and summary `indeterminate`. If trustworthy
time places the artifact outside the interval, trust is instead
`outside_binding_interval`, with a valid signature retained and summary
`valid_but_untrusted`. The two states are mutually exclusive. Neither state is
`invalid_signature`, and a verifier MUST NOT enforce an interval as a
cryptographic fact.

## Historical evidence after revocation

A verifier MUST return both dimensions:

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

Connected MAY add authenticated organization bindings, operational key
lifecycle, shared trust-policy distribution, retention, and audit views. These
services MUST remain optional to content verification and SHOULD provide
exportable historical public keys and binding artifacts so discontinued service
does not strand historical evidence.

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
