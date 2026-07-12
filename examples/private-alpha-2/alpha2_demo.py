"""Synthetic alpha.2 demo: one decorated action, wrapped sync tools, one
wrapped async tool.

No payment processor, bank, or external service is called. The return values
only describe what a fictional local support system would have recorded.
"""

import asyncio
import os
from pathlib import Path

from approval_provider import DemoApprovalProvider

import igris

APPROVAL_PROVIDER = DemoApprovalProvider()


# --- 1. Decorated action (unchanged alpha.1 style) -------------------------


@igris.guard(
    action="support.refund.request",
    risk="high",
    approval="required",
    approval_provider=APPROVAL_PROVIDER,
    redact=["support_note"],
)
def request_synthetic_refund(customer_id: str, amount_cents: int, support_note: str) -> dict:
    """Record a fictional refund result locally; never move real money."""
    return {"customer_id": customer_id, "status": "synthetic_refund_recorded"}


# --- 2. Existing callables the demo team "cannot edit" ---------------------


def archive_ticket(ticket_ref: str, resolution_code: str) -> str:
    """A pre-existing synchronous helper; its source is not modified."""
    return f"archived:{ticket_ref}:{resolution_code}"


def tag_account(account_label: str) -> str:
    """Retains an ordinary argument value in evidence on purpose (demo)."""
    return f"tagged:{account_label}"


def close_stale_ticket(ticket_ref: str) -> str:
    """Synthetic failure case: the fictional ticket system is unavailable."""
    raise RuntimeError("synthetic ticket system is unavailable")


async def notify_on_call(channel_ref: str) -> str:
    """A pre-existing async helper; wrap_tool supports it directly."""
    await asyncio.sleep(0)
    return f"notified:{channel_ref}"


WRAPPED_ARCHIVE = igris.wrap_tool(
    archive_ticket,
    action="support.ticket.archive",
    redact=["ticket_ref", "resolution_code"],  # fully redacted evidence
    approval_provider=APPROVAL_PROVIDER,
)
WRAPPED_TAG = igris.wrap_tool(
    tag_account,
    action="support.account.tag",  # account_label stays in evidence
    approval_provider=APPROVAL_PROVIDER,
)
WRAPPED_CLOSE = igris.wrap_tool(
    close_stale_ticket,
    action="support.ticket.close",
    redact=["ticket_ref"],
    approval_provider=APPROVAL_PROVIDER,
)
WRAPPED_NOTIFY = igris.wrap_tool(
    notify_on_call,
    action="support.oncall.notify",
    redact=["channel_ref"],
    approval_provider=APPROVAL_PROVIDER,
)


def journal_path() -> Path:
    home = Path(os.environ.get("IGRIS_HOME", Path.home() / ".igris")).expanduser()
    return home / "journal.jsonl"


def main() -> None:
    print("Igris private-alpha.2 demo (synthetic only; nothing external is called)")

    allowed = request_synthetic_refund(
        "cust_demo_allowed", 4250, support_note="account charged twice"
    )
    print(f"DECORATED ALLOWED: {allowed['status']} for {allowed['customer_id']}")

    try:
        request_synthetic_refund(
            "cust_demo_denied", 75000, support_note="high-value exception request"
        )
    except igris.ActionDenied as exc:
        print(f"DECORATED DENIED: function did not execute ({exc})")
    else:  # pragma: no cover - protects the safety claim in this executable example
        raise AssertionError("the deterministic provider should deny this request")

    print(f"WRAPPED SYNC FULLY REDACTED: {WRAPPED_ARCHIVE('tick_demo_1', 'resolved')}")
    print(f"WRAPPED SYNC RETAINED: {WRAPPED_TAG('vip-demo-account')}")

    try:
        WRAPPED_CLOSE("tick_demo_2")
    except RuntimeError as exc:
        print(f"WRAPPED FAILED: original ran locally and raised RuntimeError ({exc})")
    else:  # pragma: no cover
        raise AssertionError("the synthetic failure case should raise")

    print(f"WRAPPED ASYNC: {asyncio.run(WRAPPED_NOTIFY('chan_demo_oncall'))}")

    print(f"JOURNAL: {journal_path()}")


if __name__ == "__main__":
    main()
