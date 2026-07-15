# Igris verification-result schema draft

Status: **Design-freeze candidate; schema identifier
`igris:protocol:verification-result:1`**

Scope: language-neutral verifier output for ActionContract, Evidence, trust,
and checkpoint verification. This is a result data model, not an Evidence
object and not a policy authorization.

## Design rules

- Cryptographic facts, schema validity, chain state, trust, and policy are
  separate dimensions.
- A later failure never rewrites an earlier fact. A valid signature can coexist
  with revoked trust or policy rejection.
- A dimension that cannot safely be evaluated is `not_evaluated`, not false.
- Unsupported schema or algorithm is not invalid signature.
- Issues may be errors, warnings, or informational diagnostics.
- Payload values, secrets, private paths, private keys, and untrusted remote
  messages must not be copied into results.

## Result object

The language-neutral shape is:

```json
{
  "schema_id": "igris:protocol:verification-result:1",
  "artifact": {
    "object_schema_id": "1",
    "object_type": "evidence-chain",
    "artifact_id": null
  },
  "parse": "valid",
  "schema": "supported",
  "canonicalization": "valid",
  "algorithm": "supported",
  "object_hash": "valid",
  "signature": "valid",
  "key_resolution": "resolved",
  "continuity": "valid_genesis",
  "completeness": "completeness_unknown",
  "semantics": "valid",
  "trust": "unknown",
  "time_confidence": "producer_asserted",
  "summary": "valid_but_trust_unknown",
  "policy": null,
  "events_verified": 2,
  "issues": [
    {
      "severity": "warning",
      "code": "completeness_unknown",
      "event_index": null,
      "path": null
    }
  ]
}
```

All fields shown above are required. A non-applicable field uses the declared
`not_applicable` value where available; a check prevented by an earlier phase
uses `not_evaluated`. Optional details are represented only by fields the
schema explicitly declares nullable.

## Field definitions

### `artifact`

| Field | Type | Meaning |
| --- | --- | --- |
| `object_schema_id` | string or null | Exact submitted schema identifier when safely parsed; schema `1` uses legacy value `"1"` |
| `object_type` | enum | `action-contract`, `evidence-event`, `evidence-chain`, `trust-artifact`, `checkpoint`, or `unknown` |
| `artifact_id` | string or null | Non-secret stable identifier when the object schema defines one |

### Phase dimensions

| Field | Allowed values | Meaning |
| --- | --- | --- |
| `parse` | `valid`, `malformed`, `resource_limit` | UTF-8/JSON/framing and bounded parse result |
| `schema` | `supported`, `unsupported`, `invalid`, `not_evaluated` | Schema dispatch and declared-field validity |
| `canonicalization` | `valid`, `invalid`, `not_evaluated` | Canonical data-domain and encoding result |
| `algorithm` | `supported`, `unsupported`, `not_evaluated` | Signature/hash suite support |
| `object_hash` | `valid`, `mismatch`, `not_present`, `not_evaluated` | Submitted versus recomputed object hash |
| `signature` | `valid`, `invalid`, `not_present`, `not_evaluated` | Mathematical signature result under the resolved key |
| `key_resolution` | `resolved`, `unknown`, `ambiguous`, `not_required`, `not_evaluated` | Whether one verification key was selected without ambiguity |
| `continuity` | `valid_genesis`, `valid_anchored`, `valid_unanchored`, `discontinuous`, `not_applicable`, `not_evaluated` | Hash/sequence continuity relative to the supplied start |
| `completeness` | `complete_to_checkpoint`, `incomplete`, `completeness_unknown`, `not_applicable`, `not_evaluated` | Whether a trusted required head is reached |
| `semantics` | `valid`, `invalid`, `unresolved`, `not_applicable`, `not_evaluated` | Known field meaning and lifecycle transition result |
| `trust` | `trusted`, `unknown`, `untrusted`, `revoked`, `outside_binding_interval`, `not_evaluated` | Relying-policy evaluation of the resolved key/binding |
| `time_confidence` | `producer_asserted`, `receipt_bounded`, `checkpoint_bounded`, `trusted`, `unknown`, `not_applicable`, `not_evaluated` | Strongest time basis actually evaluated |

`incomplete` is used only when a supplied trusted anchor/checkpoint or manifest
proves a required event/head is missing. Absence of such proof is
`completeness_unknown`.

### `events_verified`

`events_verified` is a non-negative safe-range integer. For an Evidence chain,
it counts events whose required parse, schema, canonicalization, algorithm,
hash, signature, and local continuity checks completed successfully. It is `1`
for a successfully checked single artifact and `0` when no artifact/event
completed those checks. It is diagnostic coverage, not a sequence number or a
completeness claim.

## Summary classification

`summary` is descriptive and deterministic. It is not authorization.

| Summary | Required condition |
| --- | --- |
| `valid_and_trusted` | Parse/schema/canonicalization/algorithm/hash/signature and applicable semantics/continuity are valid; trust is `trusted` |
| `valid_but_trust_unknown` | The same content checks are valid; trust is `unknown` or `not_evaluated` |
| `valid_but_untrusted` | The same content checks are valid; trust is `untrusted`, `revoked`, or `outside_binding_interval` |
| `invalid` | Malformed/schema-invalid/canonical-invalid/hash-mismatch/signature-invalid/discontinuous/semantic-invalid |
| `unsupported` | Schema or algorithm is unsupported and prevents the required verification |
| `indeterminate` | Key is unknown/ambiguous, a required check is not evaluable, or semantics remain unresolved without a stronger invalid fact |

Completeness unknown alone does not make cryptographic content invalid. A named
policy may still reject it.

## Policy result

`policy` is null when no named verifier policy was requested. Otherwise:

```json
{
  "profile_id": "example:relying-policy:7",
  "profile_version": "7",
  "status": "accepted",
  "evaluated_at": "2030-01-01T00:00:00Z"
}
```

`status` is `accepted`, `rejected`, or `indeterminate`. The policy object must
name the exact profile/version and evaluation time. Protocol conformance never
requires one universal policy profile.

## Issues

Each issue contains exactly:

| Field | Type | Meaning |
| --- | --- | --- |
| `severity` | enum | `error`, `warning`, or `info` |
| `code` | string enum | Stable machine-readable issue code |
| `event_index` | non-negative integer or null | Zero-based event index where applicable |
| `path` | JSON Pointer string or null | Schema path only; never the rejected value |

Issues are ordered by event index (null first for artifact-level issues),
verification phase, path, then code. Implementations may log richer local
diagnostics separately, but conformance output must not add unbounded or
sensitive free text.

## Required issue codes

| Phase | Codes |
| --- | --- |
| Parse | `malformed`, `invalid_utf8`, `duplicate_member`, `trailing_content`, `resource_limit` |
| Schema | `unsupported_schema`, `unknown_field`, `missing_field`, `invalid_field`, `invalid_null` |
| Canonicalization | `canonicalization_failed`, `integer_out_of_range`, `invalid_unicode_scalar` |
| Algorithm/integrity | `unsupported_algorithm`, `hash_mismatch`, `invalid_signature`, `missing_signature` |
| Key | `unknown_key`, `ambiguous_key` |
| Chain | `chain_discontinuity`, `partial_chain`, `incomplete_chain`, `completeness_unknown`, `fork_detected` |
| Semantics | `invalid_transition`, `unknown_decision_reference`, `duplicate_outcome`, `unresolved_execution` |
| Trust | `untrusted_key`, `revoked_key`, `outside_binding_interval`, `stale_trust_snapshot`, `trust_unknown` |
| Time | `producer_time_only`, `time_confidence_unknown` |
| Specification | `specification_conflict` |

## Required distinction examples

| Scenario | Key dimensions | Summary |
| --- | --- | --- |
| Valid signature, trusted active binding | `signature=valid`, `trust=trusted` | `valid_and_trusted` |
| Valid signature, supplied self-asserted key | `signature=valid`, `trust=unknown` | `valid_but_trust_unknown` |
| Valid signature, explicitly untrusted key | `signature=valid`, `trust=untrusted` | `valid_but_untrusted` |
| Valid old signature, key now revoked | `signature=valid`, `trust=revoked` | `valid_but_untrusted` |
| Valid historical signature credibly bounded before compromise/revocation | `signature=valid`, `trust=trusted`, defensible non-producer time confidence | `valid_and_trusted` |
| Valid signature outside defensible binding interval | `signature=valid`, `trust=outside_binding_interval` | `valid_but_untrusted` |
| Wrong signature under resolved key | `signature=invalid` | `invalid` |
| Payload differs from submitted hash | `object_hash=mismatch` | `invalid` |
| Broken previous hash/sequence | `continuity=discontinuous` | `invalid` |
| Valid local tail with no witness | `continuity=valid_genesis`, `completeness=completeness_unknown` | Trust-dependent valid summary plus warning |
| Unknown schema | `schema=unsupported`, later checks `not_evaluated` | `unsupported` |
| Unsupported signature suite | `algorithm=unsupported`, signature `not_evaluated` | `unsupported` |
| Invalid JSON/duplicate member | `parse=malformed` | `invalid` |
| Key not found | `key_resolution=unknown`, signature `not_evaluated` | `indeterminate` |

## Aggregation for chains

For a chain, phase dimensions report the strongest adverse result across the
submitted events. `events_verified` counts events whose required parse, schema,
canonicalization, algorithm, hash, signature, and local continuity checks are
valid. Per-event results may be emitted as a separate array only in a later
schema; the draft schema keeps the minimum aggregate surface and indexed
issues.

## Versioning

Changing a field, enum meaning, summary derivation, issue-code meaning, or issue
ordering requires a new verification-result schema ID. Adding an issue code is
compatible only when existing fields and summary remain unchanged and the
release manifest declares the augmented registry revision. Released vector
expected results are immutable.
