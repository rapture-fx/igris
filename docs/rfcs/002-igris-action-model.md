# RFC 002: Igris Action model

Status: **Draft**
Primary constraint: language-neutral model with ordinary callable ergonomics

## What an Action is

**Draft invariant:** An Action is a stable, inspectable declaration of a
consequential capability that can be invoked under explicit decision,
execution, and evidence requirements. It is not a function, decorator, HTTP
route, workflow node, queued job, or completed invocation, although any of
those may adapt to or refer to an Action.

The protocol separates the static ActionContract from an Action instance. The
former is reviewable before execution; the latter represents one attempt.

## Action identity

**Current:** `action_name` is the logical name. When omitted in Python it is
derived from module and qualified function name. `action_id` is
`module.qualified_name`, which may differ from an explicitly supplied
`action_name`. Names match `^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$`. See
`sdk/python/src/igris/contracts.py::validate_action_name` and
`sdk/python/tests/test_contracts.py::TestActionIdentity`.

**Draft invariant:** Current Evidence schema `1` `action_id` is a code-location
hint and MUST NOT be treated as global or semantic identity. Future semantic
Action identity is exactly `(publisher_namespace, action_name)`.

`publisher_namespace` is `igris-publisher:` plus the lowercase unpadded RFC
4648 base32 encoding of 32 cryptographically random bytes. It is opaque,
collision-resistant, and signed into ActionContract v2, but it carries no
inherent person/organization trust. Local self-asserted namespaces are valid;
trust metadata may bind one to an organization. The Action-name grammar remains
`^[A-Za-z][A-Za-z0-9_.:-]{0,127}$`.

## Intent

Intent is the human-reviewable description of what an Action is expected to
do and the boundary of its consequential effect.

**Current:** ActionContract v1 has no intent field. Function names, annotations,
or source MUST NOT be treated as a signed intent statement.

**Deferred:** Human-facing intent remains external metadata and does not affect
minimum semantic contract identity. A future typed signed intent claim would
require a new schema and privacy/compatibility review.

## Input descriptors

**Current:** v1 records ordered Python parameter descriptors: name, Python
parameter kind, presence of default, and an annotation string. It does not
record default values, validation schemas, secrecy classification, or full
cross-language types.

**Draft invariant:** An input descriptor describes invocation shape, not
validated business semantics. Language bindings MUST NOT claim that current
annotation strings are a language-neutral type system. A future portable
descriptor vocabulary must define nullability, numbers, records, arrays,
opaque values, and evolution rules and therefore requires ActionContract v2.

## Risk declaration

**Current:** `risk` is one of `low`, `medium`, `high`, `critical`; it is a
caller declaration included in `contract_hash`.

**Draft invariant:** Risk is asserted metadata for policy input, not an
objective measurement. A verifier confirms integrity of the declaration, not
its correctness. Changing it creates a different v1 contract hash.

## Approval requirement

**Current:** `approval_mode` is `required` or `never`. Required uses a provider;
the terminal default denies without explicit `y`/`yes` and fails closed when
no TTY is available. `never` records an allowed decision without prompting.

**Draft invariant:** The contract states a minimum decision requirement. A
provider MAY impose stronger policy. `never` means the Action declaration does
not demand interactive approval; it does not bypass external authorization.
Quorum, role, expiry, or organization approval requirements require
ActionContract v2.

## Redaction requirements

**Current:** redaction configuration is adapter configuration, not a field in
ActionContract v1. Decision evidence contains a bounded redacted summary and a
hash over the redacted canonical input. Built-in secret-like names and explicit
caller names are redacted. Alpha.2 privacy preflight classifies existing
summaries without changing signed bytes.

**Draft invariant:** An Action descriptor SHOULD be inspectable for its
evidence disclosure policy before invocation. Because v1 does not commit to
redaction requirements, a verifier MUST NOT infer them from a contract.
Portable redaction requirements require ActionContract v2; local adapter
configuration may remain SDK-only in the meantime.

## Execution contract

**Current:** v1 carries `execution_mode="embedded"`. It does not specify
timeouts, retries, idempotency, cancellation, sandboxing, or external-effect
guarantees.

**Draft invariant:** The Action describes requirements; a runtime declares
whether it can satisfy them. The contract MUST NOT imply that Igris owns the
execution merely because Connected synchronization occurred. Managed
execution requirements are excluded from v1.

## Evidence requirements

**Current:** A call may fail before any decision during binding, explicit
Connected configuration/synchronization, redaction/canonicalization, identity,
provider evaluation, or decision persistence. When a valid provider decision
is obtained, the adapter attempts to write it durably; application execution is
forbidden until an allowed decision is durable. Allowed executions attempt one
outcome. The requirements themselves are not contract fields.

**Draft invariant:** Required event classes and failure handling should be
inspectable. Adding a signed evidence policy to the ActionContract requires
v2. Until then, conforming v1 adapters follow RFC 005 and report evidence
incompleteness explicitly.

## Action instance identity

An Action instance identifies one attempted invocation independently of the
static Action and contract version.

**Current:** the decision `event_id` is the de facto attempt anchor but is not
named as an action instance. Reusing `input_hash` or `contract_hash` as an
instance ID is forbidden: equal inputs may be invoked more than once.

**Draft invariant:** Evidence v2 uses
`action_instance_id = "igris-instance:" + base32lower(random_32_bytes)` with
no padding. It is opaque,
collision-resistant, created once per attempted invocation, and signed into
every Decision/Outcome for that instance. Equal input/contract values never
reuse an instance ID. The identifier has no time, authorization, identity, or
idempotency meaning and does not belong in ActionContract identity.

## Static description versus invocation

Static inspection MUST NOT execute application code or require network access.
Invocation MAY bind runtime inputs and providers. Contract construction,
invocation, and verification are separate operations even when an ergonomic
SDK wrapper exposes them through one callable.

## Decorator and wrapper as adapters

**Current:** `@igris.guard` supports synchronous Python functions.
`igris.wrap_tool` supports synchronous and asynchronous existing callables and
produces equivalent contracts/evidence. Tests include
`test_wrap_tool.py::TestDecoratorEquivalence` and `TestCallableCategories`.

**Draft invariant:** Decorators, wrappers, annotations, middleware, and client
objects are language-binding adapters. None defines the Action model. A binding
MUST preserve the original callable's ordinary call/await ergonomics where the
host language permits it.

## Inspectability

An adapter MUST expose the resolved static descriptor without invoking the
Action. It SHOULD make risk, approval requirement, input descriptors, contract
version/hash, and local disclosure configuration reviewable. Python currently
attaches `__igris_contract__` to guarded/wrapped callables.

## Immutability expectations

A resolved contract version is immutable. Any change to a field committed by
`contract_hash` creates a new version. An adapter MUST NOT mutate an existing
callable supplied to a retrofit wrapper; Alpha.2 proves this in
`test_wrap_tool.py::test_original_callable_unchanged`.

Runtime provider instances and local configuration may change without changing
the contract only when they do not alter signed contract fields.

For ActionContract v2, `contract_hash` identifies one immutable version of an
Action, not the Action itself. Its semantic body includes namespace/name,
portable input shape, risk, decision requirement, evidence/disclosure
requirement profile, and declared execution capability requirements. Changes to
those fields create a new contract version for the same Action. Module/source,
artifact digest, provider instances, transport, invocation inputs, trace,
caller/session, and human description are excluded. Any later implementation
binding is a separate versioned object.

ActionContract v2 is content-addressed by this semantic hash; a signer key is
not part of the contract body. Publisher attribution, when required, is a
separate signed ActionContract attestation that references the schema-qualified
contract hash under the `igris.action-contract` domain. Rotating a signer
therefore does not create a new semantic contract version.

## Nested actions and correlation

Nested calls are ordinary independent Action instances in v1. Each performs
its own decision and evidence lifecycle. Evidence v1 contains no parent or
causation fields, so a verifier MUST NOT infer nesting from adjacency in a
journal. Thread-local or tracing correlation may be SDK-only observability but
is not signed protocol evidence.

## Why workflow composition is excluded from v1

Composition introduces scheduling, durable state, compensation, retries,
fan-out, secrets propagation, partial failure, and ownership questions that
are not necessary to make one Action interoperable. Treating nested Actions as
a workflow would also overstate v1 correlation and crash semantics.

Protocol v1 therefore defines one Action instance at a time. DAGs, pipelines,
fibers, transactions across Actions, and compensating actions are rejected for
v1.

## Resolved and remaining questions

Resolved by the first design-freeze candidate: publisher namespace is signed
but externally trusted; implementation identity is separate; intent is
deferred; Action-instance IDs are opaque random 256-bit values; provider
instances are invocation context.

Still blocking ActionContract v2 implementation: the exact portable input
descriptor vocabulary, evidence/disclosure profile registry, execution
capability registry, machine schema, and golden vectors. These are specification
work and MUST NOT be chosen by an SDK implementation.
