"""Igris — a drop-in action layer for consequential AI-agent actions.

Guard a function; keep your agent, your code, and your workflow::

    import igris

    @igris.guard(action="customer.refund", risk="critical")
    def refund_customer(customer_id: str, amount: int):
        return payment_provider.refund(customer_id=customer_id, amount=amount)

The code declaration is the action registration. Before the function runs,
Igris records a signed decision event; after it runs, a signed outcome event.
The journal is hash-chained and verifiable offline with ``igris verify``.
Embedded Igris requires no account, no backend, and makes no network calls.

For managed durable Action → Run → Proof, construct :class:`~igris.Igris`
explicitly (``Igris.from_env()``). Environment variables alone never make
``wrap_tool`` remote. :class:`~igris.IgrisDurableClient` remains available for
advanced compatibility usage.
"""

from __future__ import annotations

__version__ = "0.1.0a2"

from .approval import (
    ApprovalDecision,
    ApprovalProvider,
    ApprovalRequest,
    TerminalApprovalProvider,
)
from .contracts import ActionContract
from .durable import (
    ActionTarget,
    ContractBinding,
    DurableRun,
    DurableRunStatus,
    EvidenceLinkResult,
    Igris,
    IgrisDurableClient,
    IgrisRunProof,
)
from .errors import (
    ActionDenied,
    ActionNotRegistered,
    ApprovalError,
    ApprovalUnavailableError,
    AuthenticationError,
    AuthorizationDenied,
    BindingConflictError,
    CanonicalizationError,
    ConnectedConfigurationError,
    ContractError,
    ContractMismatchError,
    ContractSyncConflictError,
    ContractSyncError,
    DurableConfigurationError,
    DurableError,
    DurableTimeoutError,
    DurableTransportError,
    EvidenceNotLinkableError,
    EvidencePersistenceError,
    EvidencePrivacyInspectionError,
    EvidencePrivacyPreflightError,
    EvidenceSyncAuthenticationError,
    EvidenceSyncConfigurationError,
    EvidenceSyncConflictError,
    EvidenceSyncError,
    EvidenceSyncServerError,
    EvidenceSyncTransportError,
    EvidenceSyncValidationError,
    ExecutionCompletedEvidenceError,
    IdempotencyConflictError,
    IdentityError,
    IgrisError,
    JournalError,
    ProofUnavailableError,
    ReconciliationRequiredError,
    RunNotFoundError,
    SigningError,
    ToolWrapError,
    UnboundActionError,
    UnsupportedFunctionError,
    VerificationError,
)
from .evidence_privacy import EvidencePrivacyReport, PrivacyClassification, inspect_journal
from .guard import guard
from .verification import VerificationResult, verify_journal
from .wrap_tool import wrap_tool, wrap_tools

__all__ = [
    "ActionContract",
    "ActionDenied",
    "ActionNotRegistered",
    "ActionTarget",
    "ApprovalDecision",
    "ApprovalError",
    "ApprovalProvider",
    "ApprovalRequest",
    "ApprovalUnavailableError",
    "AuthenticationError",
    "AuthorizationDenied",
    "BindingConflictError",
    "CanonicalizationError",
    "ConnectedConfigurationError",
    "ContractBinding",
    "ContractError",
    "ContractMismatchError",
    "ContractSyncConflictError",
    "ContractSyncError",
    "DurableConfigurationError",
    "DurableError",
    "DurableRun",
    "DurableRunStatus",
    "DurableTimeoutError",
    "DurableTransportError",
    "EvidenceLinkResult",
    "EvidenceNotLinkableError",
    "EvidencePersistenceError",
    "EvidencePrivacyInspectionError",
    "EvidencePrivacyPreflightError",
    "EvidencePrivacyReport",
    "EvidenceSyncAuthenticationError",
    "EvidenceSyncConfigurationError",
    "EvidenceSyncConflictError",
    "EvidenceSyncError",
    "EvidenceSyncServerError",
    "EvidenceSyncTransportError",
    "EvidenceSyncValidationError",
    "ExecutionCompletedEvidenceError",
    "IdempotencyConflictError",
    "IdentityError",
    "Igris",
    "IgrisDurableClient",
    "IgrisError",
    "IgrisRunProof",
    "JournalError",
    "PrivacyClassification",
    "ProofUnavailableError",
    "ReconciliationRequiredError",
    "RunNotFoundError",
    "SigningError",
    "TerminalApprovalProvider",
    "ToolWrapError",
    "UnboundActionError",
    "UnsupportedFunctionError",
    "VerificationError",
    "VerificationResult",
    "__version__",
    "guard",
    "inspect_journal",
    "verify_journal",
    "wrap_tool",
    "wrap_tools",
]
