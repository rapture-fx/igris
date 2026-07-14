# Igris protocol current-to-proposed gap analysis

Status: **Draft analysis for senior review**
Baseline: `origin/main` at `1ef093a96dc8ae55c317266aa9b0dc94e5b08579`

## Classification

- **Implemented:** current source and tests cover the invariant.
- **Partially implemented:** useful behavior exists, but the portable invariant
  or cross-path semantics are incomplete.
- **Proposed:** draft normative direction with no production implementation.
- **Rejected v1:** deliberately excluded.
- **Unknown:** decision or evidence is insufficient.

## Current implementation inventory

| Capability | Current evidence |
| --- | --- |
| Package/version | `sdk/python/pyproject.toml`, version `0.1.0a2` |
| Ordinary sync guard | `sdk/python/src/igris/guard.py`; `tests/test_guard.py` |
| Existing callable sync/async adapters | `sdk/python/src/igris/wrap_tool.py`; `tests/test_wrap_tool.py` |
| ActionContract v1 | `sdk/python/src/igris/contracts.py`; `tests/test_contracts.py`; `testdata/igris-contract-v1/action_contract*.json` |
| Evidence v1 | `sdk/python/src/igris/journal.py`, `guard.py`; `tests/test_journal.py`, `test_verification.py` |
| Canonicalization | `sdk/python/src/igris/canonical.py`; `igris-overture/internal/canonicaljson/` |
| Cross-language proof | `conformance/contractv1/canonical_conformance_test.go` verifies exact bytes, hashes, Ed25519 signatures, chain, and contract hash |
| Local identity | `sdk/python/src/igris/identity.py`; `tests/test_identity.py` |
| Connected contract sync | `sdk/python/src/igris/connected.py`; `igris-overture/api/routes_contracts.go`; both test suites |
| Explicit evidence sync | `sdk/python/src/igris/evidence_sync.py`; `igris-overture/api/routes_evidence.go`, `evidence_verify.go`; Python/Go tests |
| Privacy preflight | `sdk/python/src/igris/evidence_privacy.py`; `tests/test_evidence_privacy.py` |
| Security characterization | `docs/security/igris-connected-evidence-ingestion-threat-model.md`; `igris-evidence-privacy-preflight-release-gate.md`; `igris-existing-tool-wrapper-release-gate.md` |

## Gap matrix

| Area/invariant | Status | Current behavior | Draft direction / gap |
| --- | --- | --- | --- |
| Exact Evidence v1 hash/signature | Implemented | Python emits; Python and Go verify same fixture | Freeze bytes and publish broader vectors |
| Exact ActionContract v1 hash | Implemented | Python emits; Go recomputes fixture hash | Freeze schema `1`; clarify language-specific fields |
| Language-neutral Action concept | Proposed | Public model is expressed through Python callables | Static Action distinct from adapters and invocation |
| Stable logical action name | Partially implemented | Validated `action_name`; tenant scopes Connected | Global/publisher namespace unresolved |
| Portable input descriptors | Proposed | Python parameter kind/annotation strings | Define only with ActionContract v2 after real second binding |
| Inspectable descriptor | Implemented in Python | `__igris_contract__` attached to callable | Standardize capability, not Python attribute spelling |
| Ordinary callable ergonomics | Implemented in Python | Sync decorator; sync/async wrapper | Binding requirement; lazy object optional only |
| Action instance identity | Proposed | Decision event ID is de facto attempt anchor | Explicit signed ID requires Evidence v2 |
| Decision before execution | Implemented | Durable decision append precedes call/await | Make normative across bindings |
| Denial terminal | Implemented | Python prevents call; Go rejects denied outcome | Add portable transition vectors |
| One outcome per decision | Partially implemented | Producer emits one; Go rejects duplicates | Python verifier does not enforce semantic transition |
| Executed/evidence-incomplete error | Implemented in Python | Structured non-retryable error | Standard binding taxonomy; no v1 byte change |
| Cancellation/expiry | Unknown/proposed | BaseException can leave no outcome; no expiry | Evidence v2 if signed states are required |
| Crash ambiguity | Partially implemented | Documented allowed decision without outcome | Normative unresolved result; optional future repair/witness |
| Execution idempotency | Rejected v1 | SDK explicitly invokes once per call, no dedupe | Application/provider concern; no exactly-once claim |
| Evidence chain continuity | Implemented | Previous hash; Go cross-batch continuation | Add partial/completeness result and fork vectors |
| Chain completeness | Partially implemented | Tail deletion limitation documented; Connected head can witness submitted tail | No signed stream ID; trusted checkpoint model future |
| General correlation/causation | Proposed | Only outcome to decision link | Evidence v2; do not infer nesting from adjacency |
| Signature content integrity | Implemented | Ed25519 over recomputed SHA-256 digest | Separate from key trust in result model |
| Human/organization attribution | Partially implemented | Connected tenant binds public key on verified first use | Trust store, rotation, revocation, authority model proposed |
| Environment trust | Rejected v1 | Embedded is explicitly untrusted local execution | Future attestation/Managed profile only |
| External-side-effect truth | Rejected v1 | Outcome is SDK observation | Require external receipts/reconciliation for stronger claim |
| Offline verification | Implemented | Journal plus public key; no network | Keep mandatory and decompose trust result |
| Zero-network Embedded | Implemented | Socket-guarded Python tests | Normative binding requirement |
| Connected optionality | Implemented | Explicit config; explicit evidence sync | Connected never owns execution/provenance |
| Provider interfaces | Partially implemented | Approval/signing/journal/contract sync seams exist | Clock/ID seams and portable failure contract proposed |
| Verification taxonomy | Partially implemented | Python/Go codes differ; trust not modeled | Common decomposed result/vector vocabulary |
| Unknown fields | Partially implemented | Included in hash; generally accepted; tenant/provenance prohibited on ingest | Diagnostic-only unknowns; semantic extensions versioned |
| Number canonicalization | Unknown | Existing fixtures emphasize strings/integers; Go preserves literals | Define portable ranges/lexical rules before stability |
| Privacy/disclosure contract | Partially implemented | Redaction and preflight are SDK policy, not contract | ActionContract v2 if portable requirements are needed |
| Deterministic execution | Rejected claim | External call behavior is uncontrolled | Claim only deterministic construction/verification inputs |
| Managed execution | Rejected v1 | Existing core has separate managed paths; no SDK adapter | Future profile; never inferred from Embedded evidence |
| Workflow composition | Rejected v1 | No action graph/correlation semantics | Separate future RFC only after single-action stability |
| Shared Rust core | Rejected for now | None selected | Evidence-based decision after two independent SDKs/drift |

## Evidence v2 implications

Each item below changes signed payload or meaning and therefore cannot be
retrofitted into schema `1`:

| Proposal | Reason v2 is required |
| --- | --- |
| `action_instance_id` | New signed identity shared by lifecycle events |
| `stream_id` and `sequence` | Changes chain identity/order commitments |
| General `correlation_id` / `causation_id` / parent | Adds signed relationships |
| Explicit hash/signature/canonicalization algorithm IDs | Changes verification dispatch and signing input |
| Signature domain separation | Every existing signature would differ |
| Full signed key fingerprint/richer signer reference | Changes identity commitment |
| Cancellation, expiration, preparation, execution-start, repair events | New lifecycle event semantics |
| Trusted-time/checkpoint/log inclusion | New signed/externally bound claim |
| Environment/workload attestation reference | New trust claim and verifier profile |
| Changed canonical number/Unicode rules | Changes canonical bytes |
| Strict unknown-field rejection under the same validity meaning | Could invalidate already valid signed extensions |

Evidence v2 should use an explicit domain-separation design, but v1 must remain
verified with its existing undomained Ed25519-over-digest rule.

## ActionContract v2 implications

| Proposal | Reason v2 is required |
| --- | --- |
| Language-neutral input descriptors | Replaces/augments Python parameter kinds and annotations |
| Stable publisher/organization namespace | Changes Action identity commitment |
| Signed intent description | Adds contract semantics/hash input |
| Redaction/disclosure requirements | Makes current SDK-only policy portable |
| Rich approval policy (roles, quorum, expiry) | Changes approval contract |
| Execution/evidence requirement profiles | Adds required provider capabilities |
| Semantic hash split from implementation fingerprint | Changes contract version identity |
| Portable implementation artifact reference | Replaces source-text fingerprint assumptions |

The current `code_fingerprint` remains inside v1 `contract_hash`; formatting or
decorator-source changes may over-version. It cannot be removed retroactively.

## SDK-only changes without protocol impact

- Additional decorator/wrapper/builder ergonomics that emit the same objects.
- Clock and identifier injection for tests, while emitted values keep v1 shape.
- A runtime-environment configuration object and explicit provider precedence.
- Expanded structured exceptions and a common error-code mapping.
- TOFU/trust-store/revocation policy outside signed evidence.
- Privacy inspection, safer defaults, and bounded diagnostics.
- Additional static contract inspection APIs.
- More semantic checks reported separately from cryptographic validity.
- Packaging, documentation, and no-network tests.

## Compatibility risks for existing Alpha.2 journals

| Risk | Required mitigation |
| --- | --- |
| Reinterpreting `key_id` as verified human/org identity | Preserve self-asserted meaning; apply trust context separately |
| Treating Connected upload as Managed provenance | Keep server-assigned `embedded`; never accept client managed claim |
| Adding signature domain separation to v1 verifier | Version dispatch; retain legacy v1 algorithm forever |
| Changing unknown-field behavior | Hash all fields; report diagnostics separately; use v2 for required semantics |
| Tightening Python semantic validation to Go behavior | Separate integrity from semantic status; document historical status effects |
| Assuming complete chains | Report valid-unwitnessed/partial; retain tail-truncation limitation |
| Treating timestamps as trusted | Keep producer-asserted time separate from receipt/checkpoint time |
| Recomputing contracts with semantic-only hash | Retain exact v1 contract hash; introduce v2 hash under new schema |
| Cross-language numeric rendering | Limit claims to pinned vectors; define portable numeric profile before new adoption |
| Losing public keys/revocation history | Establish retention/export policy before relying on long-term third-party verification |

## Irreversible decisions before broader external evidence generation

These decisions are expensive or impossible to retrofit without parallel
legacy support:

1. schema/version dispatch and object framing;
2. canonical string, Unicode, number, duplicate-key, and depth rules;
3. exact hash and signature input, including domain separation;
4. algorithm identifiers and key-reference collision properties;
5. signed stream/action-instance/correlation identity;
6. unknown-field and event-registry behavior;
7. stable Action identity/namespace and contract hash semantics;
8. verification result taxonomy and integrity-versus-trust separation;
9. historical key, schema, vector, and revocation retention policy.

The immediate safe action is not to add these to production v1. It is to settle
them before emitting a v2 artifact externally.

## Overloaded or misleading terms

| Term | Problem | Preferred meaning |
| --- | --- | --- |
| `valid` | Collapses parsing, crypto, chain, trust, semantics | Qualify dimension; use structured result |
| `verified` | May imply identity/external truth | State exactly what was verified and against which key/trust policy |
| `identity` | Key, human, organization, workload conflated | Signing key reference plus explicit binding type |
| `action_id` | Sounds globally stable; currently Python code location | Code-location hint in Evidence v1 |
| `execution_mode` | May imply Connected executes | Current contract value is `embedded`; participation is separate |
| `Connected` | Sometimes treated as provenance | Coordination/transport mode, never executor identity |
| `outcome` | May imply external side-effect truth | Adapter-observed return/exception |
| `deterministic` | Applied to uncontrollable external execution | Use deterministic canonical construction or verification |
| `immutable` | Local files/admin DB may still be deleted | Append-only/tamper-evident under stated threat boundary |
| `complete chain` | Local valid genesis may be tail-truncated | Internally valid, anchored, witnessed, or complete as separate states |
| `approval` | May imply named human/org decision | Provider decision unless identity/authority evidence exists |

## Review-question answers

| Question | Draft answer |
| --- | --- |
| Can Action be defined without Python? | Yes; RFC 002 defines a static consequential capability plus instances. Python descriptors remain a v1 artifact limitation. |
| Can a third-party verifier avoid importing Igris? | Yes for current fixtures; the Go implementations already do. Full conformance needs published schemas/results/vectors. |
| Can old Evidence v1 remain verifiable indefinitely? | Technically yes if bytes, schema algorithm, public key, and trust metadata are retained. Operational retention governance is not implemented. |
| Can result states be distinguished? | Proposed taxonomy does. Current Python/Go results do not yet distinguish untrusted/revoked keys from crypto validity. |
| Does provider design preserve zero-network Embedded? | Yes, as a normative default and current tested behavior. |
| Does design avoid workflow-engine scope? | Yes; composition/durable suspension/scheduling are excluded. |
| Can Python and TypeScript be independent/interoperable? | Yes for pinned portable values; numeric/type descriptor rules need resolution before a TypeScript producer claim. |
| What cannot be retrofitted cheaply? | Signed identity/ordering fields, canonical rules, domain separation, version semantics, action identity, and result taxonomy. |
| Which proposals are overengineering now? | Global PKI, mandatory transparency, hardware attestation, full portable type system, workflow DSL, durable approvals, Rust engine, sidecar, and WASM core. |

## Rejected alternatives

- Redefining Evidence v1 to include new fields without a schema bump.
- Treating successful signature verification as human identity or authorization.
- Using a server timestamp to overwrite the producer's signed timestamp.
- Making Connected mandatory for verification or the owner of execution.
- Requiring lazy invocation/Action objects for ordinary calls.
- Building a workflow engine to solve single-call lifecycle semantics.
- Selecting a shared Rust core before independent implementations demonstrate
  drift or a measurable requirement.

## Open questions for senior review

1. Is Protocol v1 the existing schema `1` compatibility profile, or should the
   first formally stable protocol be named differently to avoid implying the
   draft logical objects are already serialized?
2. Which exact semantic checks should be required for historical Evidence v1,
   given Python and Go verifier differences?
3. What JSON number and duplicate-key policy should independent verifiers use?
4. Should v1 unknown fields be accepted-with-diagnostic or rejected on
   production ingest while remaining cryptographically verifiable offline?
5. What trust bundle and revocation snapshot format is the minimum useful
   organization-neutral design?
6. Must ActionContract v2 establish a publisher namespace, or should identity
   remain entirely in trust/registry context?
7. Should v2 use a semantic contract hash plus a separate implementation
   artifact digest, and exactly which fields belong in each?
8. What witness/checkpoint is sufficient to claim chain completeness without a
   mandatory global service?
