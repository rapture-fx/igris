# RFC 001: Igris protocol model and schema `1` compatibility profile

Status: **Draft**
Protocol maturity: proposed model around a permanent schema `1` compatibility profile
Compatibility rule: no redefinition of current signed bytes

## Normative terminology

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**,
and **MAY** mark candidate requirements throughout RFCs 000–008. “Current”
describes Alpha.2 and is not retroactive protocol approval. “Open question,”
“draft option,” and “rejected” text are non-normative. Candidate requirements
become normative only when a release manifest records ratification under RFC
000's artifact-precedence rule.

ActionContract schema `1` and Evidence event schema `1` form the **schema `1`
compatibility profile**. This name does not imply the proposed logical model is
already a ratified Protocol v1. Logical objects below that lack schema `1`
fields are not silently serialized into either artifact.

## Protocol objects

**Draft invariant:** The protocol model contains:

- an **ActionContract**, the static declaration;
- an **Action instance**, one attempted invocation of that declaration;
- a **Decision**, an authorization/policy observation for that instance;
- an **Outcome**, an adapter observation after an allowed decision and
  attempted execution;
- an **Evidence event**, one signed lifecycle assertion;
- an **Evidence chain**, an ordered integrity-linked event stream;
- a **Signing identity reference**, the key/algorithm lookup handle;
- a **Verification result**, typed facts and failures, separate from trust
  policy.

Objects are conceptual unless a schema defines their serialized fields.

## ActionContract

**Current:** ActionContract v1 contains `schema_version`, `action_name`,
`module`, `qualified_name`, `risk`, `approval_mode`, `execution_mode`, ordered
`parameter_descriptors`, nullable `code_fingerprint`, and `contract_hash`.
`sdk/python/src/igris/contracts.py::_build_contract_unchecked` is the emitter;
`testdata/igris-contract-v1/action_contract.json` is the fixture. The Go route
recomputes its hash in
`igris-overture/internal/canonicaljson/canonicaljson.go::ContractHash`.

**Draft invariant:** A contract describes requirements and inspectable shape;
it does not grant execution permission and does not represent an invocation.
Within schema `1`, `action_name` is the logical name and `module` plus
`qualified_name` is a Python-origin code-location descriptor. Language-neutral
replacement descriptors require ActionContract v2.

The v2 semantic descriptor remains content-addressed. A separate signed
attestation may bind its schema-qualified hash to a publisher; signer keys do
not enter semantic contract identity.

## Action instance

An Action instance is one binding of inputs and execution context to an
ActionContract. It has a distinct identity from the Action and contract.

**Current:** Evidence v1 has no explicit `action_instance_id`. A decision
`event_id` acts as the only per-attempt anchor; an outcome refers to it through
`decision_event_id`.

**Draft invariant:** Protocol consumers MUST NOT infer that repeated
`action_id`, `action_name`, `contract_hash`, or `input_hash` values represent
one invocation. A durable explicit Action instance identifier is a v2 field.

## Decision

**Current:** A `decision` event records `allowed` or `denied`, risk, approval
mode, redacted input summary, and input hash. Provider reason is not recorded.
`sdk/python/tests/test_guard.py::TestApproval` proves denial prevents execution
and still writes a signed decision.

**Draft invariant:** A Decision records what the producing runtime/provider
decided. It is not proof that a named human approved unless independently
bound identity and approval evidence say so. Denied is terminal for the action
instance. Allowed permits execution to begin; it does not prove that it did.

## Outcome

**Current:** An `outcome` is `succeeded` or `failed` and references the
authorizing decision. It is an SDK observation. A success may carry result type
and redacted output hash; a failure carries exception type and sanitized error
summary. `igris-overture/api/evidence_verify.go` rejects an outcome after a
denial or a second outcome for one decision.

**Draft invariant:** Outcome means the adapter observed the callable return or
raise. It MUST NOT be interpreted as independent proof of an external effect.
An absent outcome after an allowed decision is unresolved, not success.

## Evidence event

An Evidence event is a typed, schema-versioned, signed assertion. Evidence v1
has exactly two registered types: `decision` and `outcome`. Its exact current
fields and signing rules are specified in RFC 003.

## Evidence chain

**Current:** Each event commits to `previous_event_hash`; the first event uses
JSON `null`. Middle deletion, insertion, reordering, and modification are
detectable. Tail deletion is not detectable without an external checkpoint.
See `sdk/python/tests/test_verification.py::test_tail_deletion_not_detectable_documented_limitation`.

**Draft invariant:** Chain validity proves internal continuity for the provided
segment relative to a declared starting point. It MUST NOT imply completeness
without a trusted head/checkpoint. Evidence v1 has no signed stream identifier,
so one-key/multiple-journal ambiguity remains a known limitation.

## Signing identity reference

**Current:** `key_id` is `ed25519:` plus the first 16 hex characters of the
SHA-256 fingerprint of the raw public key. The full fingerprint is not in the
signed event. See `sdk/python/src/igris/identity.py` and
`sdk/python/tests/test_identity.py::test_key_id_stable_across_loads`.

**Draft invariant:** A signing reference identifies key material for
cryptographic verification; it does not itself establish person,
organization, workload, or environment identity. Collision handling and
full-fingerprint binding are verifier/trust-store duties for v1. A generalized
algorithm-qualified identity requires versioned design. Future signed objects
use the full `ed25519-sha256:<64 hex>` reference selected by their registered
signature suite; this rule is not backported to schema `1`.

## Verification result

**Current:** Python returns `valid`, `events_verified`, and issues including
`unknown_schema`, `unknown_event_type`, `missing_fields`, `chain_break`,
`hash_mismatch`, `unknown_key`, and `bad_signature`. The Go verifier adds
field, timestamp, and transition checks.

**Draft invariant:** Verification MUST use the decomposed, language-neutral
model in
[`../../spec/verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md).
Specification consistency, parse, schema, canonicalization, algorithm, hash,
signature, key resolution, continuity, completeness, semantics, trust, time
confidence, and named policy are distinct. A cryptographically valid artifact may be trust-unknown,
untrusted, revoked, outside a binding interval, or policy-rejected.

The descriptive `summary` MUST NOT be treated as universal authorization.
Unsupported schema/algorithm and unknown key leave dependent checks
`not_evaluated`; they are not invalid signatures. A conflict among applicable
normative artifacts sets `specification=conflict`, stops the affected
verification, and returns summary `indeterminate` rather than selecting a
preferred implementation.

## Correlation and causation

**Current:** `decision_event_id` expresses one causal edge from outcome to
decision. No general `correlation_id`, `causation_id`, parent action, trace, or
stream identifier exists.

**Draft invariant:** Implementations MAY correlate events out of band, but
unsigned transport metadata MUST NOT be represented as signed causation.
General signed correlation/causation requires Evidence v2. Nested actions may
produce independent v1 decisions/outcomes; their relationship is unknown.

## Deployment-mode independence

The protocol distinguishes execution provenance from participation mode.
Embedded and Connected describe product/provider topology. They MUST NOT
change the meaning of the same valid Evidence v1 bytes. Managed execution is
outside Protocol v1.

## Embedded and Connected behavior

**Current Embedded:** ordinary callables execute locally; approval and evidence
are local; no Connected configuration means no network. Socket-blocking tests
exist in `sdk/python/tests/test_no_network.py` and
`test_wrap_tool.py::test_no_hidden_network_without_connected_config`.

**Current Connected:** contract synchronization occurs only when explicitly
configured and before execution. Evidence synchronization is a separate
explicit operation, locally verifies first, and applies privacy preflight
before configuration/network. Connected stores centrally verified Embedded
evidence; it does not become the executor. See
`sdk/python/tests/test_connected.py::TestGuardSynchronization`,
`test_evidence_sync.py::TestLocalValidationBeforeNetwork`, and
`igris-overture/api/routes_evidence_test.go::TestEvidenceSourceNeverTouchesManagedReceiptStorage`.

**Draft invariant:** Connected MUST NOT be required for local construction or
verification and MUST NOT upgrade `embedded` execution provenance to
`managed`.

## Protocol versioning

Envelope schemas are versioned independently. Existing schema `1` bytes are
immutable and retain dedicated legacy dispatch. Future schema IDs use
`igris:protocol:<object-name>:<major>`, are signed, and are dispatched after
bounded syntactic parsing but before schema-specific canonicalization,
cryptography, or semantics.

The historical schema `1` producer baseline is the byte representation emitted
by Python 0.1.0a2. Current Go re-encoding is known non-conforming for U+2028 and
U+2029; that defect does not redefine the profile. Externally supplied schema
`1` number tokens are verified using preserved original lexemes, not
host-language numeric normalization. These compatibility rules change no
existing artifact.

Future signed schemas are closed. Unknown fields invalidate a known schema;
unknown schemas return `unsupported_schema`. No downgrade or best-effort
reinterpretation is permitted. Writers MUST NOT emit a changed field or meaning
under the same schema.

Additive documentation, new SDK adapters, or richer out-of-band trust policy
do not require a signed-object schema version when they preserve every existing
byte/result/meaning. Any changed signed field set, requiredness, type, canonical
encoding, signature input, identity reference, unknown-field rule, or existing
field meaning requires a new schema ID and vectors.

## Capability negotiation

Protocol v1 has no on-wire capability-negotiation object. Draft behavior is
therefore conservative:

- a writer emits only a schema it explicitly supports;
- a verifier reports an unknown schema as `unsupported_schema`;
- an unregistered `event_type` within a supported closed schema is
  `schema=invalid` with `invalid_field`, not a second unsupported alias;
- a Connected transport MAY advertise accepted schema versions and limits;
- absence of a capability means unsupported, not silently downgraded;
- downgrading MUST NOT discard a required security property.

A standardized negotiation document remains deferred and MUST remain outside
Evidence schema `1` signed bytes. Transport capability advertisement never
authorizes silent downgrade.

## Non-goals

- Workflow/action composition, retries, queues, or scheduling.
- Durable remote approval or suspended execution.
- Containment, trusted clocks, host attestation, or exactly-once effects.
- A universal payload type system.
- A required cloud service, PKI, Rust core, WASM module, or sidecar.
- Treating observability telemetry as protocol evidence.
