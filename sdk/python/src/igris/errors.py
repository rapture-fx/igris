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
    """The guarded function ALREADY EXECUTED but outcome evidence could not be
    persisted.

    This error is deliberately distinct from every pre-execution failure: it
    must never be read as "the action did not run". The external side effect
    (refund, deletion, message, ...) may have occurred. Igris does not retry
    the guarded function.

    Attributes:
        executed: Always ``True``; the guarded function was invoked.
        function_outcome: ``"succeeded"`` or ``"failed"`` — what the guarded
            function did before evidence persistence failed.
        result: The guarded function's return value when it succeeded, so a
            caller that chooses to handle this error can still recover the
            result. Not included in ``str(error)``.
    """

    def __init__(
        self,
        message: str,
        *,
        function_outcome: str,
        result: object = None,
    ) -> None:
        super().__init__(message)
        self.executed = True
        self.function_outcome = function_outcome
        self.result = result


class VerificationError(IgrisError):
    """A journal failed verification (corruption, tampering, bad signature)."""
