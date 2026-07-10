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
"""

from __future__ import annotations

__version__ = "0.1.0"

from .approval import (
    ApprovalDecision,
    ApprovalProvider,
    ApprovalRequest,
    TerminalApprovalProvider,
)
from .contracts import ActionContract
from .errors import (
    ActionDenied,
    ApprovalError,
    ApprovalUnavailableError,
    CanonicalizationError,
    ContractError,
    EvidencePersistenceError,
    ExecutionCompletedEvidenceError,
    IdentityError,
    IgrisError,
    JournalError,
    SigningError,
    UnsupportedFunctionError,
    VerificationError,
)
from .guard import guard
from .verification import VerificationResult, verify_journal

__all__ = [
    "ActionContract",
    "ActionDenied",
    "ApprovalDecision",
    "ApprovalError",
    "ApprovalProvider",
    "ApprovalRequest",
    "ApprovalUnavailableError",
    "CanonicalizationError",
    "ContractError",
    "EvidencePersistenceError",
    "ExecutionCompletedEvidenceError",
    "IdentityError",
    "IgrisError",
    "JournalError",
    "SigningError",
    "TerminalApprovalProvider",
    "UnsupportedFunctionError",
    "VerificationError",
    "VerificationResult",
    "__version__",
    "guard",
    "verify_journal",
]
