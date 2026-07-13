"""Synthetic customer-support refund actions guarded by Igris.

No payment processor, bank, or external service is called. The return values
only describe what a fictional local support system would have recorded.
"""

import os
from pathlib import Path

from approval_provider import DemoApprovalProvider

import igris

APPROVAL_PROVIDER = DemoApprovalProvider()


@igris.guard(
    action="support.refund.request",
    risk="high",
    approval="required",
    approval_provider=APPROVAL_PROVIDER,
    redact=["support_note"],
)
def request_synthetic_refund(customer_id: str, amount_cents: int, support_note: str) -> dict:
    """Record a fictional refund result locally; never move real money."""
    if customer_id == "cust_demo_failure":
        raise RuntimeError("synthetic refund ledger is unavailable")
    return {
        "customer_id": customer_id,
        "amount_cents": amount_cents,
        "status": "synthetic_refund_recorded",
    }


def journal_path() -> Path:
    home = Path(os.environ.get("IGRIS_HOME", Path.home() / ".igris")).expanduser()
    return home / "journal.jsonl"


def main() -> None:
    print("Igris private-alpha refund demo (synthetic only; no money is moved)")

    allowed = request_synthetic_refund(
        "cust_demo_allowed", 4250, support_note="account charged twice"
    )
    print(f"ALLOWED: {allowed['status']} for {allowed['customer_id']} ({allowed['amount_cents']}c)")

    try:
        request_synthetic_refund(
            "cust_demo_denied", 75000, support_note="high-value exception request"
        )
    except igris.ActionDenied as exc:
        print(f"DENIED: function did not execute ({exc})")
    else:  # pragma: no cover - protects the safety claim in this executable example
        raise AssertionError("the deterministic provider should deny this request")

    try:
        request_synthetic_refund(
            "cust_demo_failure", 1899, support_note="synthetic ledger outage exercise"
        )
    except RuntimeError as exc:
        print(f"FAILED: function executed locally and raised RuntimeError ({exc})")
    else:  # pragma: no cover
        raise AssertionError("the synthetic failure case should raise")

    print(f"JOURNAL: {journal_path()}")


if __name__ == "__main__":
    main()
