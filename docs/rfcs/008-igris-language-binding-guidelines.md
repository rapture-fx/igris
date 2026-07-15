# RFC 008: Igris language-binding guidelines

Status: **Draft**
Scope: idiomatic independent bindings over shared protocol invariants

**Current:** Python 0.1.0a2 is the only SDK implementing this Action/Evidence
surface. Go independently canonicalizes and verifies the artifacts but is not a
full Action SDK.

**Candidate invariant:** Future bindings are idiomatic independent implementations
whose interoperability is judged by protocol semantics and conformance vectors.

## Protocol invariants

Every binding claiming a relevant conformance level MUST preserve:

- exact canonical bytes, hashes, signatures, and version dispatch;
- ActionContract and Evidence field meanings;
- decision-before-execution and fail-closed pre-execution behavior;
- explicit post-execution evidence-incomplete behavior;
- typed separation of integrity, trust, chain, and semantic results;
- zero-network Embedded construction/execution/verification by default;
- Connected/Managed provenance boundaries;
- private-key and sensitive-data handling requirements.

Bindings need not share implementation code or public API spelling.

## Idiomatic callable integration

The primary adoption surface should preserve ordinary host-language invocation:
a function remains callable, an async function remains awaitable, and return
values/application errors retain normal semantics when evidence persistence is
complete. Static inspection must remain possible without invocation.

Lazy Action objects MAY be offered for advanced use, but MUST NOT be required
as the public default. Retrofitting existing tool registries should not require
rewriting application functions.

## Error taxonomy

Bindings SHOULD expose structured errors that map to:

- invalid Action/contract declaration;
- input binding/canonicalization/redaction failure;
- provider configuration/unavailability/failure;
- denied decision;
- signing/identity failure;
- pre-execution evidence persistence failure;
- application failure (preserved as the host-language error);
- execution completed but evidence incomplete (`retry_safe=false`);
- verification/schema/trust failures;
- explicit synchronization/transport failures.

Errors must expose whether execution occurred and whether retry is safe when
known. Messages MUST avoid credentials, private paths where unnecessary, raw
arguments, untrusted remote detail, and application results.

## Sync and async expectations

Bindings SHOULD support the language's ordinary synchronous and asynchronous
callable forms without changing evidence semantics. Pre-execution ordering is
identical. Cancellation must follow host runtime behavior and be reported as
unresolved/incomplete when the evidence schema cannot represent it.

Blocking a host event loop for a remote provider is an implementation-quality
concern; it is not a reason to embed fibers into the protocol.

## Public API freedom

Bindings may choose decorators, annotations, higher-order functions,
interfaces, structs, middleware, macros, or builder APIs. They may use native
configuration and packaging conventions. API differences are acceptable when
the resulting protocol objects and failure semantics conform.

Product conveniences that do not affect signed bytes can evolve under normal
semantic versioning. A public API change and a protocol schema change are
separate release dimensions.

## Canonicalization obligations

A binding MUST implement canonicalization independently or use a narrowly
reviewed library that matches every vector. It MUST compare exact bytes, not
decoded JSON equality. It must reject or explicitly mark values outside the
schema's portable domain rather than depend on runtime-specific rendering.

For schema 1, the binding MUST use the immutable legacy canonicalization
profile and its historical vectors. Future signed schemas use
`igris-canonical-json-1`: duplicate names are rejected before object mapping;
only safe-range integers are numbers; non-integer numbers are prohibited;
Unicode scalar values are preserved without normalization; keys are ordered by
Unicode scalar value; and escaping is fixed by
[`protocol-resolved-decisions.md`](protocol-resolved-decisions.md). A binding
MUST NOT silently share an encoder between the legacy and future profiles
unless it proves byte identity for the selected schema.

Host objects, exceptions, functions, dates, large integers, floating point,
Unicode normalization, map key types, and cycles require explicit policies.
Python's unsupported-type markers are current reference behavior for input
summaries, not automatically a universal type system.

## Verification obligations

A verifier MUST recompute hashes from canonical unsigned payloads, verify the
signature over the recomputed digest, check chain linkage, validate the known
schema/transition profile, and return decomposed results. It must operate
offline with supplied evidence/key and use bounded resources.

Unknown schema, unknown key, untrusted key, revoked key, incomplete chain, and
invalid signature must remain distinguishable. An unknown `event_type` within
a supported closed schema maps to `invalid_field`; bindings must not emit the
non-registry alias `unsupported_event_type`. A binding interval proven out of
range and one that cannot be evaluated for lack of trustworthy time map to
`outside_binding_interval` and `binding_interval_indeterminate`, respectively.
Specification conflict terminates affected verification as `indeterminate`.
Portable results MUST map to
[`verification-result-schema-draft.md`](../../spec/verification-result-schema-draft.md);
language-native errors may contain more detail but may not collapse a valid
signature and a rejected trust policy into the same status.

## Provider interfaces

Provider APIs should be small, explicit, injectable, and idiomatic. Bindings
must document dependency precedence and no-network defaults. Provider
implementations may differ, but failure timing relative to application
execution must match RFC 005 and RFC 006.

No binding is required to reproduce an Effect-style environment type. Python
should use normal callable/configuration patterns; Go can use interfaces and
context; TypeScript can use interfaces and promises.

## Private-key handling

Private keys must never enter evidence, synchronization payloads, logs,
exceptions, package artifacts, or vector outputs. Local keys should use
platform-appropriate restrictive storage. External signer/HSM providers should
avoid export. Tests must use unmistakable fixture keys and isolated homes.

Bindings must not ship a shared default private key or silently substitute a
new key when an explicitly configured signer fails.

## Packaging

Bindings should have an independent package lifecycle, minimal required
dependencies, offline core verification, and inspectable version metadata.
Protocol vectors and schemas should be consumable without installing the
Python SDK. Packages must exclude journals, credentials, local keys, and
generated secret-bearing test state.

## Version mapping

SDK versions and protocol schema versions are independent. A binding release
MUST publish a support matrix:

| Binding version | ActionContract schemas | Evidence schemas | Conformance suite | Provider/API notes |
| --- | --- | --- | --- | --- |

A binding may support multiple read schemas while emitting one configured
write schema. Upgrading the package must not silently switch emitted schema or
canonical bytes without an explicit compatibility release decision.
Unsupported schemas and algorithms fail closed with typed results; a binding
MUST NOT guess a compatible parser or signature suite.

## Conformance requirements

Before claiming production support, a binding must pass the claimed level in
RFC 007 on maintained runtime versions. Producer claims require independent
verification of emitted output. CI should run historical vectors, negative
vectors, zero-network tests, provider failure injection, and artifact scans.

Conformance is based on outputs and semantics, not use of shared code.

## Python reference implementation

Python 0.1.0a2 is the current reference. Its strengths include ordinary
synchronous guard ergonomics, retrofit sync/async wrappers, redaction-first
evidence, local Ed25519 keys, durable JSONL append, explicit Connected sync,
privacy preflight, and offline verification.

Reference limitations that must not become universal protocol requirements:

- Python module/qualified names and `inspect.signature` parameter kinds in
  ActionContract v1;
- source-text `code_fingerprint` inside `contract_hash`;
- decorator-only sync support while `wrap_tool` supports async;
- file/PEM key storage and JSONL journal topology;
- synchronous approval provider interface;
- wall-clock/UUID functions without public provider seams;
- Python verifier's currently narrower semantic checks than Go ingest.

Exact sources/tests are indexed in `docs/rfcs/README.md`.

## Future TypeScript and Go considerations

TypeScript should preserve Promise behavior, explicitly define number/bigint
boundaries, avoid object-property-order assumptions, and distinguish thrown
application errors from protocol errors. Decorator syntax must not be required,
given ecosystem/compiler variance.

Go should use explicit contexts/interfaces, preserve integer literals during
verification, disable HTML escaping for v1 canonical bytes, and avoid making
goroutines or channels visible protocol concepts. A Go verifier already exists;
that does not constitute a full Go SDK.

Both should begin as independent implementations against vectors, not ports
that call Python or a premature native core.

The next protocol-validation implementation is the narrow offline verifier in
[`standalone-go-verifier-design.md`](standalone-go-verifier-design.md), after
the schema-1 vector/result contracts are frozen. This is a cleaner independence
test than beginning a producer SDK. A TypeScript producer remains blocked until
the ActionContract v2 and Evidence v2 closed schemas and vectors are approved;
its later value is adoption and binding ergonomics, not initial validation of
schema-1 verification.

## Criteria for considering a shared Rust core

Rust extraction may be considered only when all of these are true:

1. Protocol v1 is stable through explicit governance, not merely shipped.
2. At least two independent SDK implementations exist.
3. Conformance drift has been demonstrated with concrete defects or sustained
   maintenance cost.
4. A clear performance, security, or portability requirement exists.
5. A narrow shared-core scope is preferred over a full execution engine.

Candidate narrow scopes could include canonical encoding or verification after
FFI/WASM error, memory, packaging, and platform costs are measured. Rust is not
selected by this RFC. A sidecar, WASM dependency, shared scheduler, or complete
execution engine is not the default outcome.
