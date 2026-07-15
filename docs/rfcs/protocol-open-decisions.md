# Igris protocol open senior decisions

Status: **Blocking decision register**

This is the short list of choices that must not be made implicitly in
implementation code. “Recommended resolution” is the senior-review candidate,
not an approved standard. Owners are roles; the protocol owner records the
final decision and required approvals.

## Blocking before any v2 implementation

### OD-01 — Normative grammar, document precedence, and release naming

- **Decision:** Which text is normative, how RFC/registry/vector conflicts are
  resolved, and whether current artifacts are called Protocol v1.
- **Recommended resolution:** use “schema `1` compatibility profile” for
  Evidence v1/ActionContract v1; reserve a protocol release number for an
  approved suite. RFC 2119 terms are normative only in a clearly marked
  Normative Requirements section in every RFC. Released golden bytes decide
  byte conformance; RFC errata decide prose without rewriting history.
- **Owner/approval:** protocol owner + SDK maintainers.
- **Blocks:** all formal conformance and all v2 work.

### OD-02 — Canonical JSON data model

- **Decision:** number domain/bounds, Unicode scalar validity, normalization,
  object-name ordering, escaping, duplicate keys, null/absent, trailing data,
  and parser limits.
- **Recommended resolution:** v2 signed core accepts valid UTF-8 scalar strings
  without normalization, rejects duplicate keys before map construction,
  permits null only where declared, orders keys by one explicitly vector-pinned
  scalar/UTF-8 rule, uses fixed minimal escaping, accepts one top-level value,
  and permits bounded decimal integers only. Arbitrary application numbers are
  outside the core envelope.
- **Still requires choice:** exact integer range and exact key comparator.
- **Owner/approval:** protocol owner + cryptography/security reviewer + Python,
  Go, and TypeScript implementability reviewers.
- **Blocks:** Evidence v2, ActionContract v2, C1 vectors, TypeScript producer.

### OD-03 — Signature suite and domain-separated framing

- **Decision:** first suite identifier, signature preimage, domain tags, length
  framing, hash/signature algorithms, key encoding, and registry evolution.
- **Recommended resolution:** one signed suite ID selects the complete
  construction; the signature preimage is unambiguously length-framed and
  binds object domain, schema ID, suite ID, and canonical-payload digest. The
  first suite remains SHA-256 + Ed25519 unless a security review finds a reason
  to change. No independent mix-and-match algorithm defaults.
- **Owner/approval:** cryptography/security owner + protocol owner.
- **Blocks:** Evidence v2 and any other new signed object.

### OD-04 — Schema identifiers, field closure, and extension registry

- **Decision:** identifier syntax, dispatch order, required/optional fields,
  unknown-field semantics, and extension namespace.
- **Recommended resolution:** globally unambiguous object/schema IDs; dispatch
  before field interpretation or crypto; closed core schemas; explicitly named
  extension containers; unsupported schema distinct from invalid signature.
  v1 keeps hashing every field except hash/signature.
- **Owner/approval:** protocol owner + conformance owner.
- **Blocks:** all v2 schemas and result vectors.

### OD-05 — Semantic Action identity and publisher namespace

- **Decision:** how a language-neutral Action is scoped and whether namespace
  is signed or only registry context.
- **Recommended resolution:** Action identity is signed
  `(publisher_namespace, action_name)`. The namespace is an opaque identifier
  whose attribution comes from external trust binding; it is not a global PKI
  claim. Local self-asserted namespaces remain valid with trust unknown.
- **Still requires choice:** namespace syntax, normalization, transfer, and
  collision policy.
- **Owner/approval:** protocol owner + product/identity owner.
- **Blocks:** ActionContract v2 and TypeScript producer.

### OD-06 — Semantic contract hash and implementation binding

- **Decision:** exact fields in semantic contract identity and the format, if
  any, for binding a contract to implementation artifacts.
- **Recommended resolution:** the semantic hash includes namespace/name,
  portable input shape, risk/decision requirement, evidence/disclosure
  requirement profile, and declared execution capabilities. It excludes
  module names, source text, package locations, provider instances, and human
  descriptions. Implementation artifact digest/reference is separate and may
  be deferred.
- **Owner/approval:** protocol owner + SDK architects + security reviewer.
- **Blocks:** ActionContract v2.

### OD-07 — Evidence stream, sequence, event, and Action-instance identity

- **Decision:** identifier formats/scopes, genesis sequence, overflow,
  uniqueness, key rotation within a stream, and outcome-to-decision reference.
- **Recommended resolution:** opaque signed `stream_id`; monotonic signed
  sequence with fixed genesis; opaque signed `action_instance_id` created once
  per attempt; retain an opaque event ID only if it has a distinct replay or
  reference purpose. Equal inputs/contracts never imply the same instance.
- **Owner/approval:** protocol owner + distributed-systems reviewer.
- **Blocks:** Evidence v2.

### OD-08 — Core lifecycle and conditional event fields

- **Decision:** the exact state/event table, required fields per event, and
  verifier conclusions for missing outcomes and crash boundaries.
- **Recommended resolution:** durable allowed/denied decision before
  invocation; denial terminal; at most one terminal observed outcome; allowed
  without outcome means execution occurrence/outcome unknown. Evidence
  completeness is orthogonal. Do not add cancellation, expiry, start, repair,
  or suspension events to minimum v2.
- **Owner/approval:** protocol owner + runtime/SDK owners.
- **Blocks:** Evidence v2, C2/C3 conformance.

### OD-09 — Versioned verification-result schema

- **Decision:** exact fields/enums/issue precedence and whether an overall
  verdict exists.
- **Recommended resolution:** versioned dimensions for parse, schema,
  canonical/integrity, key resolution, continuity, completeness, semantics,
  trust, authorization policy, and time confidence. Use `not_evaluated` where
  dispatch prevents a check. Do not standardize universal `overall_valid`;
  named policy profiles may derive an acceptance decision.
- **Owner/approval:** conformance owner + security reviewer + protocol owner.
- **Blocks:** standalone verifier, v1 suite release, TypeScript work.

## Blocking before externally exchanged Evidence v2 or Connected GA

### OD-10 — Trust bundle and temporal revocation model

- **Decision:** open representation for scoped key bindings, authority,
  rotation, revocation/compromise intervals, evaluation time, and snapshots.
- **Recommended resolution:** define an open exportable trust-bundle schema
  separate from Evidence. A valid signature remains integrity-valid after
  revocation. Producer time alone cannot place evidence before compromise.
  Offline staleness is a first-class result.
- **Owner/approval:** identity/security owner + protocol owner.
- **Blocks:** trusted external v2 claims and Connected GA; does not block
  self-asserted local integrity verification.

### OD-11 — Historical Evidence v1 semantic profile

- **Decision:** whether new verifiers apply Go's stricter field/transition
  checks to old v1 journals and how status changes are reported.
- **Recommended resolution:** retain one immutable v1 cryptographic profile;
  add a separately versioned semantic profile. A journal can remain
  cryptographically valid while failing a newer semantic or ingest policy.
  Never relabel this as invalid signature.
- **Owner/approval:** protocol owner + Python/Go maintainers.
- **Blocks:** released C2 v1 result vectors and migration of verifier behavior.

### OD-12 — Checkpoint and chain-completeness vocabulary

- **Decision:** what anchor/checkpoint evidence supports `partial`, `anchored`,
  `complete_to_checkpoint`, or stronger claims, and how forks are reported.
- **Recommended resolution:** freeze continuity separately from completeness;
  define a minimal portable checkpoint record or bundle reference without
  requiring a global log. Never claim latest-tail completeness without an
  authenticated witness and freshness policy.
- **Owner/approval:** distributed-systems/security reviewer + protocol owner.
- **Blocks:** strong completeness claims and Connected GA audit wording; does
  not block local integrity verification.

## Decisions intentionally not open for Protocol v1

The following are rejected from the current design surface unless a later RFC
reopens them with a new problem statement and threat model:

- mandatory Igris cloud or global PKI;
- signature-as-human/organization identity;
- proof of external side effects from SDK outcome evidence;
- workflow composition, DAGs, fibers, sagas, compensation, or exactly-once;
- required lazy Action API;
- Python decorator, `wrap_tool`, module name, file journal, or environment
  variable as protocol primitive; and
- Rust/WASM/sidecar/shared execution engine selected before independent
  implementations demonstrate a measured need.

## Approval rule

Each blocking decision requires:

1. an RFC edit with current/proposed/rejected sections;
2. compatibility and threat analysis;
3. positive and negative language-neutral vectors where bytes/results change;
4. named protocol and security approval; and
5. a recorded decision without production implementation in the same review.
