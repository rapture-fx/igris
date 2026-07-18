# RFC 006: Igris runtime-provider model

Status: **Draft**
Design constraint: explicit dependencies without an Effect-style Python type system

## Runtime environment

A runtime environment is the explicit set of provider capabilities used to
prepare, decide, execute, and record one Action instance. It is not a workflow
runtime, dependency-injection framework, or guarantee of process isolation.

**Candidate invariant:** Protocol requirements describe provider behavior and
failure semantics, not provider implementation classes. A language binding may
use arguments, configuration objects, interfaces, closures, contexts, or host
framework facilities as long as resolution is explicit and testable.

Provider interfaces, dependency-resolution containers, and class names are
implementation-only. They become protocol-visible only through signed objects,
portable result semantics, or required externally observable ordering.

## Approval provider

The provider evaluates a redacted prepared request and returns allowed or
denied. It MUST fail closed on unavailable, malformed, timed-out, or exceptional
responses. It MUST NOT receive raw arguments merely because it is remote.

**Current:** `sdk/python/src/igris/approval.py` defines a small protocol,
terminal implementation, and internal auto-allow implementation. Provider
identity and decision reason are not in Evidence v1.

## Signing identity provider

The provider supplies a stable key reference and signs exactly the digest
required by the selected evidence schema. It MUST NOT export private material
unless explicit key-management policy requires it, and MUST fail before
execution if signing the decision is unavailable.

**Current:** the default is file-backed local Ed25519; callers may inject a
`SigningIdentity` with `key_id` and `sign`. Alternative algorithms are not v1.

## Evidence store

The evidence store atomically resolves the previous chain hash and durably
appends the fully signed event, or returns a failure. It MUST preserve event
bytes/meaning and MUST NOT report durability before its required durability
boundary completes.

**Current:** `JournalStore.append_event(builder)` enables the read-tail,
construct, append, flush, and `fsync` sequence under locks in
`sdk/python/src/igris/journal.py`. The protocol does not assume a filesystem,
but an alternative store must maintain equivalent ordering semantics.

## Contract registry

A contract registry stores or resolves immutable ActionContract versions. It
does not grant execution. Registration MUST be idempotent by content identity,
must preserve history, and must scope organization-owned names by authenticated
context.

**Current:** Embedded requires no registry. Explicitly configured Connected
synchronizes before approval/execution and fails closed on error. Go tests
cover fixture acceptance, hash mismatch, immutability, idempotency, tenant
scope, and non-executability in `igris-overture/api/routes_contracts_test.go`.

## Clock provider

The clock provider supplies producer timestamp claims. In v1 those claims are
not trusted time. A binding SHOULD make the clock injectable for tests, but
MUST NOT silently treat a wall-clock value as authorization expiry or causal
order.

**Current:** `journal.utc_timestamp` uses the host UTC wall clock directly.
There is no public provider seam or trusted-time evidence.

## Identifier provider

The provider supplies schema-qualified identifiers. Schema 1 event identifiers
remain UUIDv4 strings under the permanent legacy profile. Future Evidence uses
opaque random stream and Action-instance identifiers in the formats frozen by
[RFC 002](002-igris-action-model.md) and [RFC 003](003-igris-evidence-envelope.md);
an event is identified by stream, sequence, and event hash rather than a new
event UUID. Uniqueness does not prove authenticity or idempotency.

**Current:** `journal.new_event_id` emits UUIDv4 strings. It is not injectable
through the public Python API.

## Embedded defaults

An Embedded binding SHOULD offer safe local defaults:

- local file-backed signing identity;
- local append-only evidence store;
- terminal approval when approval is required;
- host UTC clock and random identifiers;
- no contract registry and no network unless explicitly configured.

Defaults must remain replaceable for tests and advanced deployments without
changing protocol bytes.

## Deny-by-default behavior

Missing required approval, invalid provider output, unusable signing identity,
failed input canonicalization, and pre-execution evidence failure MUST prevent
execution. A provider failure MUST NOT be translated to allow. Partial remote
configuration MUST NOT silently downgrade to Embedded-only behavior.
Preparation and provider failures before an allowed or denied result are
pre-decision failures; the protocol does not require a synthetic Decision event
for them.

## Terminal approval

The terminal provider is a convenience implementation, not a protocol
requirement. It SHOULD display only bounded redacted context, default to deny,
accept an unambiguous affirmative response, and fail closed without a trusted
interactive terminal. It does not prove the terminal user is a particular
person.

## Headless and CI behavior

Headless environments MUST NOT hang waiting for terminal input. When approval
is required, they must receive an explicitly configured provider or fail
closed. `approval="never"` is a contract declaration and should not be
dynamically substituted merely because CI is non-interactive.

## Connected providers

Connected providers may synchronize contracts, coordinate decisions, or
upload already produced evidence. Each network dependency must be explicitly
enabled, authenticated, scoped, bounded by time/size, and assigned a clear
pre- or post-execution failure class.

**Current:** contract sync may happen automatically only after explicit
Connected configuration; evidence sync is a separate explicit command. The
guard never uploads evidence. Privacy preflight occurs before constructing an
HTTP request for unsafe journals. These are distinct providers/operations and
MUST remain distinct.

Connected does not own application execution. It must not assign Managed
provenance to Embedded evidence or turn registration into authorization.

## Dependency resolution

**Binding recommendation:**

1. explicit per-Action/per-call provider supplied by the application;
2. explicit runtime-environment configuration;
3. safe Embedded default, if the requirement permits one;
4. fail closed.

A binding MUST document its exact precedence and avoid ambient behavior that
can unexpectedly introduce networking or weaken policy. Tests SHOULD resolve
every provider without real secrets or services.

## Explicit configuration

Configuration that activates networking, changes trust scope, selects a key,
or changes evidence durability MUST be explicit. Partial or contradictory
configuration is an error. Secrets MUST not appear in object representations,
errors, evidence, test vectors, or logs.

Environment variables are one binding choice, not protocol fields. Python
currently uses `IGRIS_API_URL`, `IGRIS_API_KEY`, and `IGRIS_HOME`; other
bindings need not copy those names.

## No hidden networking

Importing a binding, declaring an Action, inspecting a contract, executing in
unconfigured Embedded mode, and verifying with a supplied public key MUST NOT
perform network access. No telemetry, discovery, update check, registration,
or background evidence sync is permitted by default.

Current socket-blocking coverage is in `sdk/python/tests/conftest.py`,
`test_no_network.py`, `test_alpha2_integration.py`, and
`test_wrap_tool.py::TestSecurityInvariants`.

## Provider failure semantics

| Provider failure | Execution fact | Required handling |
| --- | --- | --- |
| Contract registry before decision | Not executed | Typed pre-execution failure; no fallback |
| Clock/ID before signed decision | Not executed | Fail closed |
| Signing decision | Not executed | Fail closed |
| Approval unavailable/error | Not executed | Fail closed |
| Evidence store on decision | Not executed | Fail closed |
| Application execution | Began | Record failure if possible; never assume rollback |
| Evidence store on outcome | Already executed | Evidence-incomplete, retry unsafe |
| Explicit later evidence sync | No action execution in this operation | Typed sync error; journal unchanged |

## Testing providers

Bindings SHOULD provide deterministic, non-production testing providers for
decisions, clocks, IDs, signing keys, evidence stores, and registries. Test
keys MUST be labeled and restricted to fixtures. Failure-injection providers
must cover before/after-execution persistence errors, provider exceptions,
malformed results, cancellation, and timeouts.

Test providers MUST NOT be enabled through an ambiguous production default or
ship a shared production private key.

## Language-binding guidance

Bindings should use the smallest idiomatic provider interfaces. Python should
continue ordinary keyword injection or a simple configuration object; it MUST
NOT introduce an Effect-style environment type system merely to mirror another
language. TypeScript may use interfaces and promises; Go may use explicit
interfaces/context. Equivalent behavior and vectors matter more than identical
API shapes.
