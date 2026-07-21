"""Exception hierarchy for the Embedded Igris SDK.

Every error raised by the SDK derives from :class:`IgrisError` so callers can
distinguish guard-layer failures from failures raised by the guarded function
itself (which are always re-raised unwrapped).
"""

from __future__ import annotations


class IgrisError(Exception):
    """Base class for all errors raised by the Igris SDK."""


class ContractError(IgrisError):
    """The action contract could not be built or is invalid.

    Raised at decoration time (e.g. invalid explicit action name) so mistakes
    fail at import time, not at call time.
    """


class UnsupportedFunctionError(ContractError):
    """The decorated callable cannot be guarded in this SDK version.

    Embedded Igris v0 supports synchronous callables only. Decorating a
    coroutine function raises this error at decoration time rather than
    silently producing incorrect pre-execution semantics.
    """


class ToolWrapError(ContractError):
    """``wrap_tool`` or ``wrap_tools`` could not wrap the callable safely.

    Raised when a callable is already guarded, is not callable, is an
    unsupported callable category (generator, async generator), or when
    a collection helper receives duplicate action names or missing
    configuration.
    """


class CanonicalizationError(IgrisError):
    """A value could not be converted to the canonical evidence representation.

    Raised before the guarded function executes (fail closed). Typical causes:
    NaN or infinite floats, cyclic containers, or excessive nesting depth.
    """


class RedactionError(IgrisError):
    """Input redaction failed. The guarded function is not executed."""


class ApprovalError(IgrisError):
    """The approval provider failed to produce a decision.

    This is distinct from :class:`ActionDenied`: the provider errored (or was
    unavailable), so Igris fails closed and the guarded function does not run.
    """


class ApprovalUnavailableError(ApprovalError):
    """Approval is required but no interactive terminal (or provider) exists.

    Raised, for example, when ``approval="required"`` and stdin is not a TTY
    and no explicit approval provider was configured. Fails closed.
    """


class ActionDenied(IgrisError):
    """The approval decision was *denied*; the guarded function did not run.

    A signed ``decision`` event with ``decision="denied"`` has been appended to
    the journal before this exception is raised.
    """

    def __init__(self, action_name: str, message: str | None = None) -> None:
        self.action_name = action_name
        super().__init__(message or f"action denied: {action_name}")


class IdentityError(IgrisError):
    """The local signing identity could not be created or loaded."""


class SigningError(IgrisError):
    """Signing an event failed. Pre-execution signing failures fail closed."""


class JournalError(IgrisError):
    """The journal could not be read or durably appended.

    When raised *before* execution, the guarded function has NOT run.
    Post-execution journal failures are reported as
    :class:`EvidencePersistenceError` instead.
    """


class EvidencePersistenceError(IgrisError):
    """Base class for evidence persistence failures.

    Not every evidence persistence error means the guarded function ran. Use
    :class:`ExecutionCompletedEvidenceError` for the explicit post-execution
    case. This base class is retained as the stable public name for callers
    that already catch post-execution evidence errors.
    """

    def __init__(
        self,
        message: str,
        *,
        function_outcome: str | None = None,
        result: object = None,
    ) -> None:
        super().__init__(message)
        if function_outcome is not None:
            self.executed = True
            self.function_outcome = function_outcome
            self.result = result


class ExecutionCompletedEvidenceError(EvidencePersistenceError):
    """The guarded function ALREADY EXECUTED but outcome evidence is incomplete.

    This error is deliberately distinct from every pre-execution failure: it
    must never be read as "the action did not run". The external side effect
    (refund, deletion, message, ...) may have occurred. Igris does not retry
    the guarded function.

    Attributes:
        execution_occurred: Always ``True``; the guarded function was invoked.
        executed: Compatibility alias for ``execution_occurred``.
        execution_state: ``"completed"`` when the function returned normally,
            or ``"failed"`` when it raised.
        evidence_state: Always ``"incomplete"``.
        retry_safe: Always ``False``. Automatic retry is unsafe because the
            action may have already produced an external side effect.
        action_id: Stable action identifier when available.
        decision_event_id: Event id of the persisted decision when available.
        function_outcome: Existing structured outcome string:
            ``"succeeded"`` or ``"failed"``.
        result: The guarded function's return value when it succeeded, so a
            caller that chooses to handle this error can still recover the
            result. Not included in ``str(error)``.
    """

    def __init__(
        self,
        message: str,
        *,
        action_id: str | None,
        decision_event_id: str | None,
        function_outcome: str,
        result: object = None,
    ) -> None:
        super().__init__(message)
        self.execution_occurred = True
        self.executed = True
        self.execution_state = "completed" if function_outcome == "succeeded" else "failed"
        self.evidence_state = "incomplete"
        self.retry_safe = False
        self.action_id = action_id
        self.decision_event_id = decision_event_id
        self.function_outcome = function_outcome
        self.result = result


class ConnectedConfigurationError(IgrisError):
    """Connected mode configuration is incomplete or invalid.

    Raised BEFORE anything else happens on a guarded call: the consequential
    function did NOT execute, no approval was requested, and no event was
    recorded. Partial configuration (endpoint without credential, or
    credential without endpoint) never silently falls back to Embedded-only
    behavior — fix or remove the configuration.

    Attributes:
        execution_occurred: Always ``False``.
        retry_safe: Always ``False`` — retrying without fixing the
            configuration cannot succeed.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.execution_occurred = False
        self.retry_safe = False


class ContractSyncError(IgrisError):
    """Contract synchronization with the Connected endpoint failed.

    Synchronization runs before local approval and before execution, so this
    error ALWAYS means the consequential function did NOT execute. While
    Connected mode is explicitly enabled, a sync failure prevents execution —
    there is no silent downgrade to Embedded-only execution.

    This is deliberately distinct from
    :class:`ExecutionCompletedEvidenceError`, which is a post-execution
    condition and is never raised by synchronization.

    Attributes:
        execution_occurred: Always ``False``.
        retry_safe: ``True`` when retrying the identical request is safe
            (timeouts, transport failures, 429, 5xx — sync is a content-keyed
            registration, so a retry cannot double-create), ``False`` when the
            request or credentials must change first, ``None`` when unknown.
        status_code: HTTP status returned by the endpoint, when one exists.
        error_code: The endpoint's snake_case error code, when one exists.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        error_code: str | None = None,
        retry_safe: bool | None = None,
    ) -> None:
        super().__init__(message)
        self.execution_occurred = False
        self.status_code = status_code
        self.error_code = error_code
        self.retry_safe = retry_safe


class ContractSyncConflictError(ContractSyncError):
    """The Idempotency-Key was already used with a different contract.

    The endpoint refused the request (409 idempotency_key_conflict) because
    the same key was bound to a different request fingerprint. The
    consequential function did NOT execute. Not retry-safe with the same key.
    """

    def __init__(self, message: str, *, status_code: int | None = 409) -> None:
        super().__init__(
            message,
            status_code=status_code,
            error_code="idempotency_key_conflict",
            retry_safe=False,
        )


class VerificationError(IgrisError):
    """A journal failed verification (corruption, tampering, bad signature)."""


class EvidenceSyncError(IgrisError):
    """Explicit evidence synchronization (``igris evidence sync``) failed.

    Raised ONLY by the explicit evidence-sync flow, which reads, locally
    verifies, and uploads already-recorded journal evidence. The flow never
    executes a guarded action, so this hierarchy is deliberately distinct
    from :class:`ExecutionCompletedEvidenceError` (a post-execution guarded
    call condition that evidence sync can never raise).

    Credentials and private-key material never appear in these messages.

    Attributes:
        status_code: HTTP status returned by the endpoint, when one exists.
        error_code: The endpoint's snake_case error code, when one exists.
        retry_safe: ``True`` when re-running the identical command is safe
            (transport failures, 429, 5xx — ingestion is content-keyed, so a
            retry cannot double-store evidence), ``False`` when the
            configuration, journal, or request must change first, ``None``
            when unknown.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        error_code: str | None = None,
        retry_safe: bool | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.retry_safe = retry_safe


class EvidenceSyncConfigurationError(EvidenceSyncError):
    """Evidence sync was invoked without complete Connected configuration.

    The explicit command requires BOTH ``IGRIS_API_URL`` and
    ``IGRIS_API_KEY`` (same rules as Connected contract sync, including
    https enforcement). Nothing was read from the network and nothing was
    uploaded. Not retry-safe until the configuration is fixed.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message, retry_safe=False)


class EvidenceSyncAuthenticationError(EvidenceSyncError):
    """The endpoint rejected the credential (401/403). Nothing was stored."""

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class EvidenceSyncValidationError(EvidenceSyncError):
    """The journal failed LOCAL verification, or the endpoint refused it.

    When raised before any network activity (malformed JSONL, broken chain,
    hash mismatch, bad local signature), the message says so explicitly and
    nothing was uploaded. The journal is never rewritten or repaired.
    """

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class EvidencePrivacyInspectionError(IgrisError):
    """A local evidence privacy inspection could not be completed safely."""

    execution_occurred = False
    retry_safe = False
    error_code = "evidence_privacy_inspection_failed"


class EvidencePrivacyPreflightError(EvidenceSyncError):
    """Evidence sync needs a per-invocation privacy acknowledgement."""

    execution_occurred = False

    def __init__(self, message: str) -> None:
        super().__init__(
            message,
            error_code="evidence_privacy_acknowledgement_required",
            retry_safe=True,
        )


class EvidenceSyncConflictError(EvidenceSyncError):
    """The endpoint reported a conflict.

    Either an ``Idempotency-Key`` was reused with different evidence
    (``idempotency_key_conflict``), the same key identity is registered with
    a different public key (``signing_key_conflict``), or the server's
    stored evidence stream cannot be reconciled with this journal
    (``chain_head_mismatch`` that local resync cannot resolve).
    """

    def __init__(
        self, message: str, *, status_code: int | None = 409, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class EvidenceSyncTransportError(EvidenceSyncError):
    """The endpoint could not be reached (DNS, connect, TLS, timeout, redirect).

    Evidence ingestion is content-keyed on the server, so re-running the
    command after a transport failure is safe and cannot double-store.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message, retry_safe=True)


class EvidenceSyncServerError(EvidenceSyncError):
    """The endpoint failed (5xx) or rate-limited the request (429).

    Retry-safe for the same reason as transport failures.
    """

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=True)


# ---------------------------------------------------------------------------
# Durable client errors (explicit durable execution — never Embedded wrap_tool)
# ---------------------------------------------------------------------------


class DurableError(IgrisError):
    """Base class for explicit durable-client failures.

    Durable APIs never execute local Python callables and never upload source.
    These errors are raised by :class:`~igris.durable.IgrisDurableClient` and
    related helpers only.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        error_code: str | None = None,
        retry_safe: bool | None = None,
        response_body: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.retry_safe = retry_safe
        self.response_body = response_body


class DurableConfigurationError(DurableError):
    """Durable client configuration is missing or invalid.

    Raised when endpoint/api_key are incomplete, the URL scheme is unsafe, or
    required durable parameters (exact ``contract_hash``, business
    ``idempotency_key``) are omitted. Not retry-safe until configuration is
    fixed. Never implies Embedded ``wrap_tool`` became remote.
    """

    def __init__(self, message: str, *, error_code: str | None = "durable_configuration") -> None:
        super().__init__(message, error_code=error_code, retry_safe=False)


class AuthenticationError(DurableError):
    """The durable endpoint rejected the machine-client credential (401/403)."""

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class AuthorizationDenied(DurableError):
    """The durable request was authenticated but denied by policy or grants."""

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class ActionNotRegistered(DurableError):
    """The named Action or contract version was not found for this tenant."""

    def __init__(
        self, message: str, *, status_code: int | None = 404, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class UnboundActionError(DurableError):
    """A durable run was requested for an exact contract that has no binding.

    Binding is never inferred from Action name alone. Create or inspect an
    exact ``contract_hash`` binding before submitting a durable run.
    """

    def __init__(
        self, message: str, *, status_code: int | None = 409, error_code: str = "binding_required"
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class ContractMismatchError(DurableError):
    """Contract identity did not match server recomputation or path identity."""

    def __init__(
        self, message: str, *, status_code: int | None = 422, error_code: str | None = None
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class BindingConflictError(DurableError):
    """An immutable binding already exists for this exact contract version."""

    def __init__(
        self, message: str, *, status_code: int | None = 409, error_code: str = "binding_exists"
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class IdempotencyConflictError(DurableError):
    """The business idempotency key was reused with a different request fingerprint."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = 409,
        error_code: str = "idempotency_key_conflict",
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class ReconciliationRequiredError(DurableError):
    """The run is in an unresolved effect / reconciliation-required state.

    Automatic retry is unsafe. Inspect the run and apply operator
    reconciliation outside the durable client; the SDK does not auto-retry.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        error_code: str = "reconciliation_required",
        run_id: str | None = None,
        recovery_status: str | None = None,
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)
        self.run_id = run_id
        self.recovery_status = recovery_status


class RunNotFoundError(DurableError):
    """The durable run id was not found for this tenant."""

    def __init__(
        self, message: str, *, status_code: int | None = 404, error_code: str = "run_not_found"
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class ProofUnavailableError(DurableError):
    """Igris Run Proof is not available on this run response."""

    def __init__(
        self, message: str, *, status_code: int | None = None, error_code: str = "proof_unavailable"
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class EvidenceNotLinkableError(DurableError):
    """Verified Evidence could not be linked to this run (eligibility failed)."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = 409,
        error_code: str = "evidence_not_linkable",
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, retry_safe=False)


class DurableTimeoutError(DurableError):
    """``DurableRun.wait`` exceeded its bounded timeout without a terminal state."""

    def __init__(self, message: str, *, run_id: str | None = None) -> None:
        super().__init__(message, error_code="wait_timeout", retry_safe=True)
        self.run_id = run_id


class DurableTransportError(DurableError):
    """The durable endpoint could not be reached (DNS, connect, TLS, timeout)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="transport_failure", retry_safe=True)
