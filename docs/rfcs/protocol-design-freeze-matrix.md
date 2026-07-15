# Igris protocol design-freeze matrix

Status: **First design-freeze candidate; human ratification required**

“Freeze now” means the invariant is proposed for ratification, not that a v2
implementation is authorized. Existing schema `1` behavior is permanent even
where the future rule differs.

| Decision | Current RFC | Current implementation | Proposed invariant | Compatibility impact | Signed-byte impact | Freeze now | Defer | Reject | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Normative precedence | RFC 000/001/007 | Prose, code, and fixtures coexist without a release manifest | Manifest pins normative RFCs/canonical specs/schemas/vectors; implementations non-normative | No byte change; future disputes become explicit | No | YES | NO | NO | OD-01 resolved; prerequisite for every other freeze |
| Release naming | RFC 001 | ActionContract/Evidence both use schema `1` | Call current artifacts schema `1` compatibility profile, not ratified Protocol v1 | Prevents logical-model claims from being retroactive | No | YES | NO | NO | OD-01 resolved |
| Future canonical profile | RFC 003/008 | Python and Go cover legacy values | `igris-canonical-json-1` with exact parse/render rules | New schema only; legacy dispatch retained | Yes | YES | NO | NO | OD-02 resolved |
| Duplicate member names | RFC 003 previously unspecified | Host parsers collapse duplicates | Reject before object construction | Safe parser policy may reject adversarial schema `1` input without calling signature invalid | Parsing and future signed domain | YES | NO | NO | Prevent parser differential |
| JSON numbers | RFC 003 open question | Python permits arbitrary ints/finite floats; Go preserves literals | Future signed protocol integers only, safe range ±`9007199254740991`; no floats | Legacy numeric vectors retained separately | Yes | YES | NO | NO | Cross-language exactness over host convenience |
| Unicode | RFC 003 | Raw UTF-8, incomplete edge vectors | Valid scalar values, no normalization, exact preservation | Visually equivalent strings may remain distinct | Yes | YES | NO | NO | Avoid silent identity transformation |
| Object ordering | RFC 003 | Python/Go covered fixtures | Lexicographic Unicode scalar sequence | TypeScript requires custom comparator | Yes | YES | NO | NO | Language-neutral exact order |
| Escaping | RFC 003 | Python/Go legacy encoding | Fixed short/lowercase control escapes; raw solidus/non-ASCII | New-schema bytes pinned; schema `1` unchanged | Yes | YES | NO | NO | OD-02 resolved |
| Missing versus null | RFC 003 | Field-specific legacy behavior | Independent optional/nullable properties; null only when declared | New schema required for changes | Yes when present | YES | NO | NO | OD-02/OD-04 resolved |
| Schema identifiers | RFC 001/003 | Bare `"1"` | `igris:protocol:<object-name>:<major>` in signed payload/frame | New objects cannot be confused with legacy | Yes | YES | NO | NO | OD-04 resolved |
| Closed signed schemas | RFC 003 | v1 hashes unknown fields; Connected rejects some | Known future schema rejects unknown fields; no generic initial extension container | Adding signed field requires new schema | Yes | YES | NO | NO | OD-04 resolved |
| Generic extension container | RFC 003/007 | None | No minimum v2 container | A later mechanism requires new schema and vectors | Yes if later added | NO | YES | NO | Safe to defer; no demonstrated need |
| Unsupported schema | RFC 001/003/007 | Python/Go return unknown schema | Dispatch before schema-specific crypto; return unsupported, never downgrade | Preserves legacy and future isolation | No, result policy | YES | NO | NO | OD-04/OD-09 resolved |
| Signature suite | RFC 003 | Implicit legacy SHA-256/Ed25519 | `igris-ed25519-sha256-1` selects full construction | New suite registry; legacy unchanged | Yes | YES | NO | NO | OD-03 resolved |
| Signature framing | RFC 003 | v1 Ed25519 over raw digest, no domain | Fixed magic/version plus length-framed domain/schema/suite/payload, then SHA-256/Ed25519 | All v2 signatures intentionally differ | Yes | YES | NO | NO | Cross-object/version separation |
| Object domains | RFC 003/004 | None | Separate ActionContract-attestation, Evidence, trust, checkpoint domains | Prevents signature replay across object classes without making signer rotation change contract identity | Yes | YES | NO | NO | OD-03 resolved |
| Algorithm substitution | RFC 003 | No agility fields | Signed suite selects exact algorithm; unsupported means not evaluated, no fallback | New suite requires review/vectors | No fallback bytes; result policy | YES | NO | NO | Fail closed |
| Full signer reference | RFC 003/004 | 64-bit truncated Ed25519 lookup hint | Future objects carry `ed25519-sha256:<full fingerprint>` | v1 ambiguity still handled by trust store | Yes | YES | NO | NO | OD-03/OD-10 resolved |
| Publisher namespace | RFC 002 | Local/tenant-scoped `action_name` | Opaque random 256-bit `igris-publisher:` ID, trust external | Requires ActionContract v2 | Yes | YES | NO | NO | OD-05 resolved |
| Action identity | RFC 002 | Name plus Python-origin hints | `(publisher_namespace, action_name)` only | Same name across publishers is distinct | Yes | YES | NO | NO | Language-neutral identity |
| Contract version identity | RFC 002 | v1 hash includes Python fields/source fingerprint | v2 semantic body includes portable policy requirements and excludes implementation identity | Requires exact v2 schema/vectors; v1 preserved | Yes | YES | NO | NO | OD-06 resolved architecturally |
| Implementation binding | RFC 002/008 | v1 source fingerprint inside hash | Separate future object, not minimum contract | Allows implementation evolution without Action redefinition | Yes if later signed | NO | YES | NO | Safe to defer |
| Signed intent prose | RFC 002 | Absent | Human description outside semantic hash | Avoids localization/copy hash churn | No | NO | YES | NO | Safe to defer |
| Action-instance ID | RFC 001/002 | Decision event ID acts as attempt anchor | Signed random 256-bit `igris-instance:` ID per attempt | Requires Evidence v2 | Yes | YES | NO | NO | OD-07 resolved |
| Stream ID | RFC 001/003 | Key/journal context only | Signed random 256-bit `igris-stream:` ID | Removes one-key/multiple-journal ambiguity | Yes | YES | NO | NO | OD-07 resolved |
| Sequence and previous hash | RFC 003 | JSONL order and previous hash only | Signed sequence starts 0/increments 1; previous hash null only at genesis | New field set requires Evidence v2 | Yes | YES | NO | NO | OD-07 resolved |
| Event ID | RFC 003 | UUIDv4 | No separate minimum v2 ID; identity is stream+sequence+hash | Reduces redundant surface | Field omitted in v2 design | NO | NO | YES | No distinct minimum purpose |
| General correlation/causation | RFC 001/002/003 | Outcome-to-decision only | External/future typed schema | No workflow implication in minimum | Yes if later signed | NO | YES | NO | Safe to defer |
| Pre-decision failures | RFC 002/005/006 | Binding/config/provider/write failures exist | May emit no Decision; must prevent invocation | Corrects prose, no byte change | No | YES | NO | NO | OD-08 source-backed correction |
| Allowed meaning | RFC 005 | Decision persisted before call | Permission observed; execution not established | Corrects overclaim, no byte change | No | YES | NO | NO | OD-08 resolved |
| Denial/Outcome cardinality | RFC 003/005 | Producer plus Go semantic checks | Denial terminal; at most one observed Outcome after Allow | Python verifier may add separate semantic status | Existing values signed; interpretation frozen | YES | NO | NO | OD-08 resolved |
| Execution-start event | RFC 005 | None | Not required in minimum v2 | Allowed/no Outcome remains execution unknown | Yes if later added | NO | YES | NO | Safely deferred |
| Cancellation/expiry/suspension/repair | RFC 003/005 | Not signed | Future lifecycle RFC/schema only | Avoids workflow/runtime expansion | Yes if later added | NO | YES | NO | Safe to defer |
| Verification-result schema | RFC 001/007 | Python/Go issue models differ | `igris:protocol:verification-result:1` decomposes all phases | Existing verifiers need adapters, not byte changes | No signed artifact change | YES | NO | NO | OD-09 resolved as draft |
| Universal validity boolean | RFC 001/007 | Python has `valid`; ingest has acceptance | Descriptive summary plus separate named policy; no universal authorization | Prevents crypto/trust collapse | No | NO | NO | YES | Should not enter core result semantics |
| Trust slots | RFC 004 | Self-asserted local and Connected tenant binding | External scoped key/subject/authority/status/time/policy/history data | Evidence stays offline and service-independent | No Evidence-byte impact | YES | NO | NO | OD-10 semantics resolved |
| Serialized trust bundle | RFC 004 | None | Required only before portable trusted exchange/GA claim | Local integrity verification unaffected | Separate future signed artifacts | NO | YES | NO | Safe to defer current task |
| Historical schema `1` | RFC 000/003/007 | Existing algorithms/fixtures | Permanent legacy dispatch, byte/result retention, no reinterpretation | Permanent dual-version cost | Existing bytes frozen | YES | NO | NO | OD-11 resolved |
| Semantic security tightening | RFC 003/005 | Go stricter than Python | Report separately from legacy crypto facts | Old signature may be valid while policy rejects | No | YES | NO | NO | OD-11 resolved |
| Continuity versus completeness | RFC 001/003 | Tail deletion undetectable | Separate result dimensions and fixed vocabulary | Honest limitation preserved | No | YES | NO | NO | OD-12 resolved |
| Checkpoint mechanism | RFC 004 | None | Optional separate signed object, never minimum Evidence event | No mandatory service; schema deferred | Separate future bytes | NO | YES | NO | Safe to defer implementation |
| Global checkpoint/log/cloud root | RFC 000/004 | None | Never required for local content verification | Preserves offline operation | No | NO | NO | YES | Should not enter minimum protocol |
| Schema `1` vector release | RFC 007/vector design | Historical point-in-time fixtures | Additive released manifest/vectors using common result | No production fixture change | No signed production bytes | YES | NO | NO | May be implemented after ratification |
| Standalone Go verifier | RFC 007/008 | Go verifier coupled to API | Independent offline consumer of frozen candidate spec/vectors | Validates protocol independence and enables vector release | No producer bytes | NO | YES | NO | Implementation waits for candidate vector/result freeze |
| Workflow/Rust/shared engine | RFC 000/002/008 | None | Outside protocol freeze | Avoids premature scope/runtime coupling | No | NO | NO | YES | No interoperability need |

## Authorization result

- Schema `1` vector implementation: **conditionally authorized after human
  ratification**, additive test/spec scope only.
- Standalone Go verifier: **not yet authorized**; wait for frozen candidate
  vectors and result schema.
- ActionContract v2: **not authorized**; exact schema/vectors remain open.
- Evidence v2: **not authorized**; exact schemas/vectors remain open.
- TypeScript producer and Rust core: **deferred**.
