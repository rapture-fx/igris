# Standalone Go verifier design

Status: **Design complete; implementation blocked until schema `1` candidate
vectors and the result schema are frozen**

Purpose: the smallest independent implementation that proves an engineer can
verify Igris protocol artifacts from specifications and public vectors without
Python, Connected, a database, or production coordinator code.

## Non-goals

- No Action producer or Go SDK.
- No signing/private-key support.
- No database, migration, tenant, authentication, HTTP, telemetry, or network.
- No Connected client/server behavior.
- No policy administration, key registration, or revocation distribution.
- No Evidence v2 or ActionContract v2 implementation in the first milestone.
- No reuse of `igris-overture/api`, coordinator, storage, route, or service
  packages.

## Proposed location and package boundary

```text
conformance/go-verifier/
  cmd/igris-verify/main.go
  verifier/
    input.go
    legacyjson.go
    contract1.go
    evidence1.go
    chain1.go
    trust.go
    result.go
    limits.go
  runner/
    manifest.go
    runner.go
```

The module uses Go standard-library Ed25519, X.509, and PEM support. Any
additional dependency requires explicit review. It must not import
the production Go canonicalizer or API verifier. Intentional independent code
is the point of this implementation; differential tests compare results.

## Inputs

The CLI accepts exactly one operation:

```text
igris-verify artifact --input <path|-> [--public-key <path>] [--trust <path>] [--anchor <path>]
igris-verify vectors --manifest <path> [--capability canonical|verify]
```

`-` means stdin. All paths are local. The process performs no DNS, socket,
update, telemetry, discovery, or background operation.
`--public-key` is required for signed Evidence and is not required for an
ActionContract hash-only check.

### Artifact bundle

The first milestone accepts an explicit local bundle descriptor containing:

- artifact type: ActionContract schema `1`, Evidence event schema `1`, or
  Evidence JSONL chain schema `1`;
- artifact bytes or local relative path;
- public verification key where required;
- optional expected preceding hash/anchor;
- optional trust overlay in the vector/result model; and
- verifier profile ID.

The descriptor is test/CLI framing, not a signed protocol object. Raw Evidence
JSONL remains unmodified.

## Output

Stdout contains exactly one UTF-8 JSON object conforming to
`igris:protocol:verification-result:1`, compact by default. Human-readable
explanation, when requested, goes to stderr and must not echo payload values,
credentials, private paths, keys, or untrusted error text.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Verification completed and result was emitted, regardless of trust/policy summary |
| `1` | Conformance-vector mismatch in `vectors` mode |
| `2` | Invalid CLI invocation or corrupt vector suite |
| `3` | Requested artifact capability/schema unsupported by this build |
| `4` | Local resource/I/O failure prevented a result from being produced |

Artifact invalidity is data in the result and is not an exceptional exit.

## Verification pipeline

The pipeline is phase-ordered and never calls a later phase when its inputs are
unsafe:

1. select the manifest-pinned specifications and fail closed with
   `specification_conflict` if applicable normative artifacts disagree;
2. bounded local read;
3. UTF-8/JSON/JSONL parsing with duplicate detection and trailing-content
   checks;
4. object/schema dispatch;
5. schema `1` required-field and type validation;
6. legacy canonical reconstruction;
7. contract/event hash recomputation;
8. key resolution and key-ID comparison;
9. Ed25519 signature verification over the recomputed raw digest;
10. previous-hash chain and optional anchor validation;
11. known schema `1` decision/Outcome semantics;
12. optional trust/time overlay evaluation; and
13. deterministic result aggregation and issue ordering.

Unknown schema returns `unsupported_schema` before schema-specific canonical or
signature evaluation. An unknown event type in supported schema `1` returns
`invalid_field`, not `unsupported_event_type`. Unknown/ambiguous keys leave
signature `not_evaluated`.
Trust evaluation never changes hash/signature facts.

## Schema `1` implementation requirements

### ActionContract

- Require the frozen schema `1` field set and current field types.
- Reconstruct legacy canonical bytes excluding only `contract_hash`.
- Recompute SHA-256 and compare lowercase hexadecimal hash.
- Report Python-origin module/descriptor/fingerprint fields without assigning
  language-neutral identity meaning.

### Evidence event

- Require the current shared and event-specific fields.
- Reconstruct the unsigned payload excluding only `event_hash` and
  `signature`, including unknown fields for the cryptographic profile.
- Recompute SHA-256 and verify Ed25519 over the raw digest.
- Resolve the supplied Ed25519 key and compare the legacy truncated key ID;
  reject ambiguity when a trust input supplies colliding keys.
- Keep unknown-field cryptographic inclusion separate from semantic/ingest
  acceptance.

### Chain

- Preserve JSONL event order.
- Validate null genesis or an explicitly supplied preceding anchor.
- Follow submitted hashes for diagnostic isolation while retaining an invalid
  chain result after any adverse event.
- Check denial terminality, Outcome decision reference, and at-most-one Outcome
  in the versioned schema `1` semantic profile.
- Report a locally valid unwitnessed tail as completeness unknown.

## Legacy canonicalizer independence

`legacyjson.go` is implemented from the schema `1` specification and released
vectors, not copied from Python or
`igris-overture/internal/canonicaljson`. It must preserve numeric literals and
reproduce the exact historical cases. Python-emitted bytes are the historical
producer baseline, including raw UTF-8 for U+2028/U+2029. The implementation
must not use Go's default escaped output for those scalars. For external JSON it
preserves every accepted number token lexeme, including exponent case/sign and
negative zero; if the parser loses a required lexeme it emits
`unsupported_legacy_representation` and does not evaluate hash/signature.
Boundary vectors determine whether the
specification is complete; implementation code must not consult Python at
runtime or generation time.

## Resource and parser safety

Minimum defaults:

- 1 MiB total input bundle;
- 64 KiB per Evidence event;
- 500 events per chain operation;
- 64 nested containers;
- 4 KiB public-key material;
- 20 issues retained, with a truncated-issues diagnostic;
- no unbounded recursive descent, allocation from claimed sizes, or payload
  echo; and
- no symlink/path traversal from a vector manifest.

Limits are CLI/conformance profile behavior, not a reinterpretation of signed
bytes. A limit hit returns `resource_limit` where a result can be safely
constructed.

## Trust input

The initial verifier supports three local trust sources:

1. explicitly supplied key with trust unknown;
2. explicit local fingerprint pin marked trusted/untrusted; and
3. vector trust overlay for active/revoked/outside-interval results.

It does not implement a CA, online revocation, TOFU persistence, or Connected
binding. Trust input names its scope, provenance, policy version, evaluation
time, and time confidence. Producer time alone cannot establish a safe
pre-revocation interval.

## Vector runner

`vectors` mode:

- reads the released manifest and verifies every referenced file hash;
- rejects absolute paths, `..`, symlink escape, duplicate vector IDs, unknown
  manifest versions, and undeclared files;
- writes no suite file;
- performs no network access;
- compares exact canonical bytes and complete result objects;
- permits only declared secondary issues; and
- emits deterministic machine-readable mismatch records.

The runner never calls Python or the current production Go verifier.

## Testing strategy

Required before implementation acceptance:

- all schema `1` positive and negative vectors pass;
- historical Alpha.2 bytes/hashes/signatures match;
- parser differential tests cover duplicate keys, Unicode, numbers, and
  trailing content;
- mutation/property tests cover payload, hash, signature, chain, and key
  changes;
- offline/no-socket tests prove zero networking;
- dependency and binary scans prove no DB/API/coordinator imports;
- race tests cover parallel independent verification;
- fuzzing is bounded and seeded from every vector family; and
- output scans prove no input values/private material are echoed.

## Independence gate

The implementation is independent only when:

- it was built from the RFCs, result schema, and released vectors;
- it imports no production verifier/canonicalizer or Python bridge;
- it can be reviewed and run outside the Igris service tree;
- it produces identical exact results for every vector; and
- a divergence is resolved by correcting the specification/vector or the
  implementation through the normative dispute process, never by copying the
  reference behavior blindly.

## Authorization status

Design is complete. Implementation is **not yet authorized**. Authorization
requires:

1. independent Clock 2B GO on the corrected design-freeze delta;
2. freeze of the schema `1` candidate vector suite;
3. freeze of `igris:protocol:verification-result:1`; and
4. a focused implementation task with an exact review range.
