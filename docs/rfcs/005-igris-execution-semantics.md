# RFC 005: Igris execution semantics

Status: **Draft**
Scope: one Action instance; independent of Python topology

## Lifecycle state machine

The proposed state model is semantic, not a claim that every state is emitted
in Evidence v1. Execution state and evidence state are orthogonal.

```text
Declared -> Prepared -> Decision pending -> Allowed -> Executing
                         |                 |             |-> Succeeded
                         |                 |             |-> Failed
                         |                 |             |-> Cancelled
                         |                 |             `-> unknown after crash
                         |                 `-> Expired (future)
                         `-> Denied

Any point that required a durable event may additionally report
evidence incomplete. Evidence incomplete does not erase the execution state.
```

**Current mapping:** contract construction corresponds to Declared; successful
argument binding/provider resolution/redaction corresponds approximately to
Prepared; approval occurs during Decision pending; signed decision events
represent Allowed/Denied; execution after an allowed event is inferred as
Executing; outcome events represent Succeeded/Failed. Cancelled and Expired
are not Evidence v1 event states.

## Declared

The ActionContract has been resolved and is inspectable. No invocation inputs
are bound and no execution permission exists. Contract synchronization records
a declaration only.

## Prepared

Invocation shape is valid and the runtime has resolved the prerequisites it
requires before asking for a decision: contract version, canonicalizable
redacted inputs, signing identity, evidence store, and explicit provider
configuration.

**Draft invariant:** failure while preparing MUST occur before application
execution and MUST NOT emit an allowed decision.

## Decision pending

A decision provider is evaluating the prepared request. No execution is
authorized yet. A non-interactive environment with a required terminal
approval currently fails closed rather than remaining durably pending.

## Allowed

The provider returned allow and the allowed decision evidence was durably
written. Allowed is authorization observed by this provider under its policy;
it is not proof of execution, organizational approval, or external effect.

## Denied

The provider returned deny and the denied decision evidence was durably
written. Denied is terminal for this Action instance. Application code MUST
NOT execute and no outcome is valid for that decision.

## Executing

Application execution has begun after an allowed decision. Evidence v1 has no
explicit executing event, so an allowed decision without outcome is ambiguous:
the process may have crashed before invocation, during execution, or before
outcome persistence.

## Succeeded

The adapter observed a normal return. It does not prove an external side effect
succeeded. When outcome persistence succeeds, a `succeeded` outcome is present.
When persistence fails, execution remains succeeded from the adapter's local
observation while evidence becomes incomplete.

## Failed

The adapter observed an ordinary application exception/failure. It attempts to
persist a failed outcome, then re-raises the original exception. Failure does
not imply rollback of external effects.

## Cancelled

Cancellation means an execution was asked to stop and the adapter observed the
cancellation boundary. It does not prove application work or effects ceased.

**Current:** synchronous guarding has no cancellation model. Python async
wrapping allows runtime cancellation to propagate as a `BaseException`; no
outcome is emitted. Evidence v1 has no cancelled status. A portable signed
cancelled outcome requires Evidence v2.

## Expired

Expiration means an authorization or prepared request became invalid before
execution began. Current approval decisions have no signed expiry and v1 has no
expired event. Time-bound decisions require trustworthy policy-time semantics
and a future schema.

## Evidence incomplete

Evidence incomplete is an evidence condition, not a substitute for execution
state. It means a required event could not be durably recorded or the verifier
has an unresolved gap.

**Current:** `ExecutionCompletedEvidenceError` states that execution already
occurred, gives the observed function outcome, sets `retry_safe=False`, and
does not expose results/secrets in its message. Tests are
`sdk/python/tests/test_guard.py::test_outcome_write_failure_reports_execution_and_never_retries`
and `test_outcome_write_failure_after_function_exception`.

## Legal transitions

| From | To | v1 status |
| --- | --- | --- |
| Declared | Prepared | Logical/current adapter behavior |
| Prepared | Decision pending | Logical/current adapter behavior |
| Decision pending | Allowed | Current signed decision |
| Decision pending | Denied | Current signed decision; terminal |
| Allowed | Executing | Logical, not separately emitted |
| Executing | Succeeded | Current signed outcome when persisted |
| Executing | Failed | Current signed outcome when persisted |
| Executing | Cancelled | Future signed state |
| Allowed | Expired | Future only |

An outcome after Denied is invalid. More than one outcome for the same decision
is invalid. A missing outcome is unresolved, not an implicit terminal state.

## Sync execution

A synchronous adapter MUST complete pre-execution checks and persist the
decision before invoking the callable. It MUST invoke at most once per adapter
call and MUST NOT automatically retry. It SHOULD preserve the original return
value or application exception unless an evidence failure makes the honest
result necessarily a distinct error.

## Async execution

An async adapter SHOULD return a native awaitable and apply the same ordering.
The decision/provider step may be synchronous in the current Python reference;
the protocol does not require that topology. Cancellation and task-local
context must be tested independently. Async support does not justify fibers or
a workflow runtime.

Alpha.2 async behavior is implemented only by `wrap_tool`, proven in
`sdk/python/tests/test_wrap_tool.py::test_async_function`, denial, and failure
tests. `@igris.guard` currently rejects coroutine functions.

## Cancellation

A cancellation request SHOULD be idempotent and MUST NOT be reported as
completed cancellation until the executor observes its boundary. If execution
may have produced effects, retry remains unsafe. Because v1 cannot encode
cancellation, bindings should expose it as host-language behavior and report
the missing evidence honestly.

## BaseException and process termination

**Current Python:** wrappers catch `Exception`, not `BaseException`.
`KeyboardInterrupt`, `SystemExit`, async cancellation, forced termination,
segmentation fault, power loss, or `os._exit` can leave an allowed decision
without outcome. This is documented in `sdk/python/src/igris/guard.py`.

**Draft invariant:** a verifier MUST interpret this pattern as unresolved.
Implementations MUST NOT synthesize success or failure after restart without a
separately trustworthy observation.

## Approval provider behavior

Providers receive only the prepared, redacted decision request. They MUST
return an explicit allowed/denied result or fail closed. Provider exceptions,
malformed decisions, missing required interactivity, timeouts, and
configuration failures MUST prevent execution.

An allowed provider response is not sufficient until required decision
evidence is durably written. Provider identity/reason is not signed in v1 and
must not be inferred.

## Evidence-write failure before execution

If the decision event cannot be signed or durably appended, application code
MUST NOT execute. The error MUST communicate `execution_occurred=false` where
the binding exposes structured metadata. Current tests cover identity,
canonicalization, and decision-journal failures in
`sdk/python/tests/test_guard.py::TestFailClosed`.

## Evidence-write failure after execution

If outcome evidence cannot be persisted, the adapter MUST NOT retry and MUST
not return ordinary success as though evidence were complete. It should expose
the observed outcome and `retry_safe=false` without logging sensitive results.
This distinction is a binding-level error model today; adding a repair event
or signed evidence-state field requires Evidence v2.

## Execution completed but evidence incomplete

Callers must treat this as a reconciliation incident. An external side effect
may have occurred. Safe responses include querying an application-level
idempotency key, reconciling with the target system, and preserving the last
known decision event. Blind replay is prohibited.

## Crash boundaries

| Last durable fact | Safe conclusion |
| --- | --- |
| No decision | No protocol evidence that execution was authorized; local implementation may know it did not invoke |
| Denied decision | This instance must not execute |
| Allowed decision, no outcome | Execution occurrence/result unknown |
| Failed outcome | Adapter observed an ordinary failure; effects may remain |
| Succeeded outcome | Adapter observed return; external truth still separate |
| Broken/partial chain | Content beyond trusted continuity is unresolved |

## Idempotency

Evidence event and batch identifiers support duplicate detection in storage,
but Embedded execution is not idempotent and is not deduplicated. Application
idempotency keys, if used, remain application inputs/policy. Protocol v1 MUST
NOT promise exactly-once execution. A future action-instance ID also would not
make the external effect idempotent by itself.

## Timeouts

Current callable execution has no protocol timeout. Connected HTTP operations
have client timeouts, but those are provider/transport behavior. A timeout
before execution can be retryable if no decision/execution occurred; a timeout
during or after execution is outcome-unknown and not automatically retryable.
Signed deadlines/expiry require a future schema.

## Future durable suspension

Durably suspending at Decision pending would require persistent Action
instances, authenticated resumptions, expiry, cancellation, replay protection,
and recovery semantics. It may be valuable for remote approval but is excluded
from v1 and must not be implied by the current synchronous provider interface.

## Why fibers, sidecars, queues, and workflow engines are excluded from v1

Those mechanisms are deployment choices with substantial failure and trust
models. None is necessary to define signed evidence for one ordinary callable.
Selecting one now would couple the protocol to a runtime architecture before
multiple independent bindings demonstrate the need. Protocol v1 standardizes
observable invariants, not scheduler internals.
