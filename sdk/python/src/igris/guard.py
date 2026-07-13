"""The ``@igris.guard`` decorator.

Guarding a function makes the code declaration itself the action
registration — no registry call, no backend, no account, no network.

Execution flow for every call to a guarded function:

1. Bind call arguments to parameter names (``inspect.signature``), applying
   defaults. A ``TypeError`` from binding propagates unchanged: the call was
   malformed and nothing has executed or been recorded.
1a. If Connected mode is explicitly configured (``IGRIS_API_URL`` +
   ``IGRIS_API_KEY``, or an injected sync client), synchronize the
   ActionContract to the Igris endpoint once per contract version per
   process — before approval and before execution. Only the contract is
   sent (never arguments, events, journals, or keys). A sync failure is a
   typed pre-execution error: the function does not run, and Connected mode
   never silently falls back to Embedded-only execution. With no Connected
   configuration this step performs no work and no network activity occurs.
2. Redact sensitive values, then canonicalize ONLY the redacted structure.
3. Compute the input hash over the redacted canonical representation.
4. Load the local signing identity (fail closed if unusable).
5. Evaluate approval (fail closed on provider failure or missing TTY).
6. Durably append a signed ``decision`` event BEFORE any execution.
   Denied → raise :class:`~igris.errors.ActionDenied`; nothing executes.
7. Execute the original function exactly once (per call — Igris does not
   deduplicate calls and does not make the action idempotent).
8. Durably append a signed ``outcome`` event (succeeded/failed).
9. Return the original result, or re-raise the original exception.

Post-execution evidence failure is reported as
:class:`~igris.errors.ExecutionCompletedEvidenceError` (a subclass of
:class:`~igris.errors.EvidencePersistenceError`) — a distinct error that means
"the function ALREADY ran, but outcome evidence could not be persisted". The
function is never retried.

``KeyboardInterrupt`` / ``SystemExit`` raised by the guarded function
propagate immediately without an outcome event; a decision event with no
following outcome therefore reads as "execution started; the process was
interrupted or died before an outcome was recorded".
"""

from __future__ import annotations

import functools
import inspect
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypeVar, overload

from . import approval as approval_mod
from .approval import (
    ApprovalDecision,
    ApprovalProvider,
    ApprovalRequest,
    AutoAllowProvider,
    TerminalApprovalProvider,
)
from .canonical import canonical_json_bytes, sha256_hex, to_canonical, type_name
from .connected import ContractSyncClient, ensure_contract_synced, resolve_connected_client
from .contracts import ActionContract, build_contract
from .errors import (
    ActionDenied,
    ApprovalError,
    CanonicalizationError,
    ContractError,
    ExecutionCompletedEvidenceError,
    IgrisError,
)
from .identity import LocalSigningIdentity, SigningIdentity, default_journal_path
from .journal import (
    EVENT_SCHEMA_VERSION,
    FileJournal,
    JournalStore,
    finalize_event,
    new_event_id,
    utc_timestamp,
)
from .redaction import (
    SENSITIVE_NAMES,
    bounded_summary,
    build_sensitive_set,
    collect_sensitive_raw_values,
    redact_arguments,
    redact_value,
    scrub_text,
)

F = TypeVar("F", bound=Callable[..., Any])

EVENT_TYPE_DECISION = "decision"
EVENT_TYPE_OUTCOME = "outcome"
STATUS_SUCCEEDED = "succeeded"
STATUS_FAILED = "failed"


@overload
def guard(func: F) -> F: ...


@overload
def guard(
    func: None = None,
    *,
    action: str | None = ...,
    risk: str = ...,
    approval: str = ...,
    journal: str | Path | JournalStore | None = ...,
    redact: list[str] | tuple[str, ...] | None = ...,
    metadata: dict[str, Any] | None = ...,
    approval_provider: ApprovalProvider | None = ...,
    identity: SigningIdentity | None = ...,
    sync_client: ContractSyncClient | None = ...,
) -> Callable[[F], F]: ...


def guard(
    func: F | None = None,
    *,
    action: str | None = None,
    risk: str = "medium",
    approval: str = "required",
    journal: str | Path | JournalStore | None = None,
    redact: list[str] | tuple[str, ...] | None = None,
    metadata: dict[str, Any] | None = None,
    approval_provider: ApprovalProvider | None = None,
    identity: SigningIdentity | None = None,
    sync_client: ContractSyncClient | None = None,
):
    """Guard a consequential synchronous function.

    Usable bare (``@igris.guard``) or with arguments (``@igris.guard(...)``).

    Args:
        action: Stable logical action name. Defaults to a deterministic
            identity derived from the module and qualified function name.
        risk: ``low`` | ``medium`` | ``high`` | ``critical``.
        approval: ``required`` (default; fail-safe) or ``never``.
        journal: Journal path override, or a ``JournalStore`` implementation.
        redact: Additional parameter names to redact (case-insensitive).
        metadata: Small JSON-safe dict recorded on every decision event.
            Passes the same redaction and canonicalization rules as inputs.
        approval_provider: Advanced/testing hook: an injectable
            ``ApprovalProvider``. Defaults to the interactive terminal prompt.
        identity: Advanced/testing hook: an injectable ``SigningIdentity``.
        sync_client: Advanced/testing hook: an injectable
            ``ContractSyncClient``. When omitted, Connected synchronization is
            driven purely by explicit ``IGRIS_API_URL``/``IGRIS_API_KEY``
            configuration and is otherwise disabled (zero network).
    """

    def decorate(target: F) -> F:
        contract = build_contract(target, action=action, risk=risk, approval=approval)
        sensitive = build_sensitive_set(redact)
        canonical_metadata = _prepare_metadata(metadata, sensitive, contract)
        try:
            signature = inspect.signature(target)
        except (TypeError, ValueError) as exc:
            raise ContractError(f"cannot inspect signature of {target!r}: {exc}") from exc

        @functools.wraps(target)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # 1. Bind arguments. A TypeError here means the call itself was
            # malformed; propagate it unchanged (nothing ran, nothing recorded).
            bound = signature.bind(*args, **kwargs)
            bound.apply_defaults()

            # 1a. Connected contract synchronization (explicit opt-in only).
            # Happens before redaction, identity, approval, and execution.
            # Raises typed pre-execution errors: on any failure the function
            # has NOT run and nothing has been recorded. Without Connected
            # configuration this resolves to None and no network I/O exists.
            active_sync_client = (
                sync_client if sync_client is not None else resolve_connected_client()
            )
            if active_sync_client is not None:
                ensure_contract_synced(contract, active_sync_client)

            # 2-3. Redact, canonicalize the redacted structure only, hash.
            redacted = redact_arguments(dict(bound.arguments), sensitive)
            raw_sensitive_values = collect_sensitive_raw_values(dict(bound.arguments), sensitive)
            canonical_input = to_canonical(redacted)
            input_hash = sha256_hex(canonical_json_bytes(canonical_input))
            input_summary = bounded_summary(canonical_input)

            # 4. Signing identity (fail closed before prompting anyone).
            active_identity = identity or LocalSigningIdentity.load_or_create()

            # 5. Approval.
            request = ApprovalRequest(
                action_name=contract.action_name,
                risk=contract.risk,
                approval_mode=contract.approval_mode,
                redacted_input_summary=input_summary,
                input_hash=input_hash,
                contract_hash=contract.contract_hash,
            )
            decision = _evaluate_approval(request, contract, approval_provider)

            # 6. Signed decision event, durably appended BEFORE execution.
            store = _resolve_journal(journal)
            decision_payload_extra = {
                "decision": decision.decision,
                "risk": contract.risk,
                "approval_mode": contract.approval_mode,
                "redacted_input_summary": input_summary,
                "input_hash": input_hash,
            }
            if canonical_metadata is not None:
                decision_payload_extra["metadata"] = canonical_metadata
            decision_event = _append_event(
                store,
                active_identity,
                contract,
                EVENT_TYPE_DECISION,
                decision_payload_extra,
            )

            if not decision.allowed:
                raise ActionDenied(
                    contract.action_name,
                    f"action denied: {contract.action_name} ({decision.reason})",
                )

            # 7. Execute exactly once (this call; Igris adds no retries and
            # no idempotency).
            try:
                result = target(*args, **kwargs)
            except Exception as exc:
                _record_outcome_or_raise(
                    store,
                    active_identity,
                    contract,
                    decision_event,
                    status=STATUS_FAILED,
                    result=None,
                    exception=exc,
                    raw_sensitive_values=raw_sensitive_values,
                )
                raise

            # 8-9. Outcome evidence, then return the untouched result.
            _record_outcome_or_raise(
                store,
                active_identity,
                contract,
                decision_event,
                status=STATUS_SUCCEEDED,
                result=result,
                exception=None,
                raw_sensitive_values=raw_sensitive_values,
            )
            return result

        wrapper.__igris_contract__ = contract  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    if func is not None:
        return decorate(func)
    return decorate


def _prepare_metadata(
    metadata: dict[str, Any] | None,
    sensitive: frozenset[str],
    contract: ActionContract,
) -> Any:
    """Validate, redact, and canonicalize decorator metadata at decoration time."""
    if metadata is None:
        return None
    if not isinstance(metadata, dict) or not all(isinstance(k, str) for k in metadata):
        raise ContractError(
            f"metadata for action {contract.action_name!r} must be a dict with string keys"
        )
    try:
        return to_canonical(redact_value(metadata, sensitive))
    except CanonicalizationError as exc:
        raise ContractError(
            f"metadata for action {contract.action_name!r} is not canonicalizable: {exc}"
        ) from exc


def _evaluate_approval(
    request: ApprovalRequest,
    contract: ActionContract,
    provider: ApprovalProvider | None,
) -> ApprovalDecision:
    if contract.approval_mode == "never":
        active: ApprovalProvider = AutoAllowProvider()
    else:
        active = provider or TerminalApprovalProvider()
    try:
        decision = active.decide(request)
    except IgrisError:
        raise
    except Exception as exc:
        raise ApprovalError(
            f"approval provider failed for action {contract.action_name!r}: "
            f"{type_name(exc)}; failing closed"
        ) from exc
    if decision.decision not in (approval_mod.DECISION_ALLOWED, approval_mod.DECISION_DENIED):
        raise ApprovalError(
            f"approval provider returned invalid decision {decision.decision!r}; failing closed"
        )
    return decision


def _resolve_journal(journal: str | Path | JournalStore | None) -> JournalStore:
    if journal is None:
        return FileJournal(default_journal_path())
    if isinstance(journal, (str, Path)):
        return FileJournal(Path(journal))
    return journal


def _append_event(
    store: JournalStore,
    identity: SigningIdentity,
    contract: ActionContract,
    event_type: str,
    extra_fields: dict[str, Any],
) -> dict[str, Any]:
    def build(previous_hash: str | None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "schema_version": EVENT_SCHEMA_VERSION,
            "event_type": event_type,
            "event_id": new_event_id(),
            "action_id": contract.action_id,
            "action_name": contract.action_name,
            "contract_hash": contract.contract_hash,
            "timestamp_utc": utc_timestamp(),
            "key_id": identity.key_id,
            "previous_event_hash": previous_hash,
        }
        payload.update(extra_fields)
        return finalize_event(payload, identity.sign)

    return store.append_event(build)


def _record_outcome_or_raise(
    store: JournalStore,
    identity: SigningIdentity,
    contract: ActionContract,
    decision_event: dict[str, Any],
    *,
    status: str,
    result: Any,
    exception: Exception | None,
    raw_sensitive_values: list[str],
) -> None:
    """Append the outcome event; on failure raise EvidencePersistenceError.

    The guarded function has ALREADY executed when this runs. Nothing here
    re-invokes it.
    """
    extra: dict[str, Any] = {
        "status": status,
        "decision_event_id": decision_event["event_id"],
    }
    if status == STATUS_SUCCEEDED:
        extra["observed_result_type"] = type_name(result)
        output_hash = _safe_output_hash(result, raw_sensitive_values)
        if output_hash is not None:
            extra["redacted_output_hash"] = output_hash
    else:
        assert exception is not None
        extra["observed_result_type"] = None
        extra["exception_type"] = type_name(exception)
        extra["sanitized_error_summary"] = scrub_text(str(exception), raw_sensitive_values)

    try:
        _append_event(store, identity, contract, EVENT_TYPE_OUTCOME, extra)
    except Exception as journal_exc:
        message = (
            f"action {contract.action_name!r} EXECUTED (function outcome: {status}) "
            "but the outcome event could not be persisted, so outcome evidence is "
            "INCOMPLETE. The external side effect may have occurred. Automatic retry "
            f"is UNSAFE. Evidence failure: {type_name(journal_exc)}. "
            "Igris did not retry the function."
        )
        if exception is not None:
            # Preserve the original function failure as the cause.
            raise ExecutionCompletedEvidenceError(
                message,
                action_id=contract.action_id,
                decision_event_id=decision_event["event_id"],
                function_outcome=status,
            ) from exception
        raise ExecutionCompletedEvidenceError(
            message,
            action_id=contract.action_id,
            decision_event_id=decision_event["event_id"],
            function_outcome=status,
            result=result,
        ) from journal_exc


def _safe_output_hash(result: Any, raw_sensitive_values: list[str]) -> str | None:
    """Hash of the canonical redacted result, or None when not canonicalizable.

    Sensitive-named keys inside the result are redacted before hashing, and a
    result that IS one of the call's raw sensitive values is never hashed
    (hashing a low-entropy secret would let it be confirmed by guessing).
    A NaN-bearing result must not fail a call that already succeeded, so this
    never raises.
    """
    if isinstance(result, str) and result in raw_sensitive_values:
        return None
    try:
        redacted = redact_value(result, SENSITIVE_NAMES)
        return sha256_hex(canonical_json_bytes(to_canonical(redacted)))
    except CanonicalizationError:
        return None
