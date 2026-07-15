# Igris verification-result schema draft

Status: **Ratified data model; machine-readable frozen candidate implemented
as [`schemas/verification-result-1.schema.json`](schemas/verification-result-1.schema.json);
schema identifier `igris:protocol:verification-result:1`; not released**

Scope: language-neutral verifier output for ActionContract, Evidence, trust,
and checkpoint verification. This is a result data model, not an Evidence
object and not a policy authorization.

## Design rules

- Specification consistency, cryptographic facts, schema validity, chain
  state, trust, time evidence, and policy are separate dimensions.
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
  "specification": "consistent",
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
| `specification` | `consistent`, `conflict`, `not_evaluated` | Whether the manifest-selected normative artifacts give one applicable interpretation |
| `parse` | `valid`, `malformed`, `resource_limit` | UTF-8/JSON/framing and bounded parse result |
| `schema` | `supported`, `unsupported`, `invalid`, `not_evaluated` | Schema dispatch and declared-field validity |
| `canonicalization` | `valid`, `invalid`, `unsupported`, `not_evaluated` | Canonical data-domain, representation support, and encoding result |
| `algorithm` | `supported`, `unsupported`, `not_evaluated` | Signature/hash suite support |
| `object_hash` | `valid`, `mismatch`, `not_present`, `not_evaluated` | Submitted versus recomputed object hash |
| `signature` | `valid`, `invalid`, `not_present`, `not_evaluated` | Mathematical signature result under the resolved key |
| `key_resolution` | `resolved`, `unknown`, `ambiguous`, `not_required`, `not_evaluated` | Whether one verification key was selected without ambiguity |
| `continuity` | `valid_genesis`, `valid_anchored`, `valid_unanchored`, `discontinuous`, `not_applicable`, `not_evaluated` | Hash/sequence continuity relative to the supplied start |
| `completeness` | `complete_to_checkpoint`, `incomplete`, `completeness_unknown`, `not_applicable`, `not_evaluated` | Whether a trusted required head is reached |
| `semantics` | `valid`, `invalid`, `unresolved`, `not_applicable`, `not_evaluated` | Known field meaning and lifecycle transition result |
| `trust` | `trusted`, `unknown`, `untrusted`, `revoked`, `outside_binding_interval`, `binding_interval_indeterminate`, `not_evaluated` | Relying-policy evaluation of the resolved key/binding |
| `time_confidence` | `producer_asserted`, `receipt_bounded`, `checkpoint_bounded`, `trusted`, `unavailable`, `not_applicable`, `not_evaluated` | Strongest time basis actually evaluated |

`specification=conflict` means two or more manifest-selected normative
artifacts give incompatible instructions that affect this verification. The
verifier MUST emit `specification_conflict`, set every affected artifact phase
to `not_evaluated`, return summary `indeterminate`, and stop the affected
verification. It MUST NOT choose an implementation, a permissive reading, or a
document-precedence shortcut. `not_evaluated` is used only when specification
selection itself could not safely complete.

`outside_binding_interval` and `binding_interval_indeterminate` are mutually
exclusive. The former requires an applicable binding plus trustworthy time
evidence that places the artifact outside the interval. The latter requires an
applicable binding interval but insufficient trustworthy time evidence to
place the artifact inside or outside it; its summary is `indeterminate`, not
`invalid` or `valid_but_untrusted`.

The `time_confidence` enum records the strongest time-evidence basis actually
evaluated. `producer_asserted`, `receipt_bounded`, `checkpoint_bounded`, and
`trusted` are evidence-basis classifications, not identity facts or
authorization labels. `unavailable` means no usable time basis was available.
`unknown`, `claimed`, and `inferred` are not registered `time_confidence`
values. A producer assertion is explicitly non-trusted even though the
producer's claim is known.

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

`summary` is descriptive and deterministic. It is not authorization. Apply the
rows in order; the first matching row wins. A named policy result never changes
cryptographic dimensions or turns a valid signature into an invalid one.

| Summary | Required condition |
| --- | --- |
| `invalid` | Malformed/schema-invalid/canonical-invalid/hash-mismatch/signature-invalid/discontinuous/semantic-invalid |
| `unsupported` | Schema, canonical representation, or algorithm is unsupported and prevents required verification, with no stronger invalid fact |
| `indeterminate` | Specification conflict, resource limit, unknown/ambiguous key, `binding_interval_indeterminate`, proven incomplete required chain, unresolved required semantics, or another required check is not evaluable, with no stronger invalid/unsupported fact |
| `valid_but_untrusted` | Required content checks are valid and trust is `untrusted`, `revoked`, or `outside_binding_interval` |
| `valid_and_trusted` | Required content checks are valid and trust is `trusted` |
| `valid_but_trust_unknown` | Required content checks are valid and trust is `unknown` or `not_evaluated` |

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

## Required issue-code registry

Each code has exactly one meaning and one owning dimension. Severity is fixed
for portable conformance output: `error` is fatal for the affected requested
verification; `warning` preserves the stated phase fact but may still make a
requested conclusion indeterminate. “No forced change” means the issue alone
does not select a summary.

| Code | Dimension effect | Severity | Minimum summary consequence | Exact meaning |
| --- | --- | --- | --- | --- |
| `specification_conflict` | `specification=conflict`; affected phases `not_evaluated` | error | `indeterminate` | Applicable normative artifacts conflict; affected verification stops |
| `malformed` | `parse=malformed` | error | `invalid` | Input is not one permitted top-level syntactic form |
| `invalid_utf8` | `parse=malformed` | error | `invalid` | Input is not valid UTF-8 |
| `duplicate_member` | `parse=malformed` | error | `invalid` | One object contains duplicate decoded member names |
| `trailing_content` | `parse=malformed` | error | `invalid` | Non-whitespace content follows the permitted top-level value |
| `resource_limit` | `parse=resource_limit` | error | `indeterminate` | A declared bounded-work limit prevented safe parsing or verification |
| `unsupported_schema` | `schema=unsupported` | error | `unsupported` | The declared object schema is not supported; no downgrade is attempted |
| `unknown_field` | `schema=invalid` | error | `invalid` | A supported closed schema contains an undeclared field |
| `missing_field` | `schema=invalid` | error | `invalid` | A supported schema omits a required field |
| `invalid_field` | `schema=invalid` | error | `invalid` | A declared field has an unregistered value, including an unknown `event_type`, or violates its type/constraint |
| `invalid_null` | `schema=invalid` | error | `invalid` | A field is null where its schema is not nullable |
| `canonicalization_failed` | `canonicalization=invalid` | error | `invalid` | An accepted parsed value violates the selected canonical data profile |
| `unsupported_legacy_representation` | `canonicalization=unsupported` | error | `unsupported` | Exact schema `1` verification requires an original number lexeme the verifier did not preserve |
| `integer_out_of_range` | `canonicalization=invalid` | error | `invalid` | A future-profile integer is outside its registered safe range |
| `invalid_unicode_scalar` | `canonicalization=invalid` | error | `invalid` | A value contains a code point excluded by the selected canonical profile |
| `unsupported_algorithm` | `algorithm=unsupported` | error | `unsupported` | A selected hash/signature suite is not supported; no substitution occurs |
| `hash_mismatch` | `object_hash=mismatch` | error | `invalid` | Submitted and recomputed object hashes differ |
| `invalid_signature` | `signature=invalid` | error | `invalid` | Mathematical signature verification failed under the resolved key |
| `missing_signature` | `signature=not_present` | error | `invalid` | The selected signed schema requires a signature and none is present |
| `unknown_key` | `key_resolution=unknown` | error | `indeterminate` | No supplied trust/key input resolves the signing reference |
| `ambiguous_key` | `key_resolution=ambiguous` | error | `indeterminate` | More than one distinct key matches the submitted lookup reference |
| `chain_discontinuity` | `continuity=discontinuous` | error | `invalid` | Sequence or previous-hash linkage fails relative to supplied input/anchor |
| `partial_chain` | `continuity=valid_unanchored` | warning | no forced change | Submitted events link locally but their non-genesis start is not anchored |
| `incomplete_chain` | `completeness=incomplete` | error | `indeterminate` | A trusted required head/manifest proves one or more required events missing |
| `completeness_unknown` | `completeness=completeness_unknown` | warning | no forced change | No trusted required head establishes tail completeness |
| `fork_detected` | `continuity=discontinuous` | error | `invalid` | Distinct hashes occupy the same signed stream/sequence identity |
| `invalid_transition` | `semantics=invalid` | error | `invalid` | A known lifecycle transition violates the selected schema profile |
| `unknown_decision_reference` | `semantics=invalid` | error | `invalid` | An Outcome references no applicable Decision in the evaluated context |
| `duplicate_outcome` | `semantics=invalid` | error | `invalid` | More than one Outcome exists for one Decision where at most one is allowed |
| `unresolved_execution` | `semantics=unresolved` | warning | `indeterminate` when execution occurrence/result is requested | Evidence cannot establish whether execution occurred or its result |
| `unknown_fields_present` | `semantics=valid` for registered fields | warning | no forced change | Schema `1` cryptographically includes fields whose additional semantics are not registered |
| `untrusted_key` | `trust=untrusted` | warning | `valid_but_untrusted` when content checks are valid | Applicable trust input explicitly distrusts the key in scope |
| `revoked_key` | `trust=revoked` | warning | `valid_but_untrusted` when content checks are valid | Applicable trust input records the key revoked for the evaluation context |
| `outside_binding_interval` | `trust=outside_binding_interval` | warning | `valid_but_untrusted` when content checks are valid | Trustworthy time evidence places the artifact outside an applicable interval |
| `binding_interval_indeterminate` | `trust=binding_interval_indeterminate` | warning | `indeterminate` | An interval applies but trustworthy time is insufficient to evaluate it |
| `stale_trust_snapshot` | `trust=unknown` | warning | `valid_but_trust_unknown` when content checks are valid | Available trust status is too stale for the requested evaluation |
| `trust_unknown` | `trust=unknown` | warning | `valid_but_trust_unknown` when content checks are valid | No applicable authoritative trust conclusion is available |
| `producer_time_only` | `time_confidence=producer_asserted` | warning | no forced change | Only the signed producer assertion supplies time information |
| `time_confidence_unavailable` | `time_confidence=unavailable` | warning | no forced change | No usable time-evidence basis is available |

## Required distinction examples

| Scenario | Key dimensions | Summary |
| --- | --- | --- |
| Valid signature, trusted active binding | `signature=valid`, `trust=trusted` | `valid_and_trusted` |
| Valid signature, supplied self-asserted key | `signature=valid`, `trust=unknown` | `valid_but_trust_unknown` |
| Valid signature, explicitly untrusted key | `signature=valid`, `trust=untrusted` | `valid_but_untrusted` |
| Valid old signature, key now revoked | `signature=valid`, `trust=revoked` | `valid_but_untrusted` |
| Valid historical signature credibly bounded before compromise/revocation | `signature=valid`, `trust=trusted`, defensible non-producer time confidence | `valid_and_trusted` |
| Valid signature outside defensible binding interval | `signature=valid`, `trust=outside_binding_interval` | `valid_but_untrusted` |
| Valid signature outside a named policy | `signature=valid`, `policy.status=rejected` | Content/trust-derived valid summary; never `invalid_signature` |
| Binding interval cannot be evaluated without trustworthy time | `signature=valid`, `trust=binding_interval_indeterminate`, `time_confidence=producer_asserted` or `unavailable` | `indeterminate` |
| Relevant normative artifacts conflict | `specification=conflict`, affected phases `not_evaluated` | `indeterminate` |
| Valid JSON schema `1` number requires a lexeme the verifier did not preserve | `canonicalization=unsupported`, later checks `not_evaluated` | `unsupported` |
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
