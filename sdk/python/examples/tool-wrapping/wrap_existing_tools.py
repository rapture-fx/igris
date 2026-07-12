"""Example: wrapping existing agent tools with Igris guard semantics.

This example uses a synthetic agent tool registry (plain dicts and lists)
with no external framework dependency. It shows:

* wrapping an imported refund-like function without editing its source;
* wrapping an async tool;
* wrapping a list and a mapping of tools;
* a denied action;
* local offline verification.

All data is synthetic. No real payments or external effects are implied.

Run from a terminal (approval is interactive by default; the example
overrides it with a static provider for non-interactive demonstration):

    uv run python examples/tool-wrapping/wrap_existing_tools.py

Then verify the local evidence:

    uv run igris verify
"""

from __future__ import annotations

import asyncio

import igris
from igris.approval import ApprovalDecision, ApprovalRequest


class StaticAllowProvider:
    """Test/demonstration provider that always allows."""

    def decide(self, request: ApprovalRequest) -> ApprovalDecision:
        return ApprovalDecision("allowed", "demo provider")

    # make it have __name__ for wrap_tools if needed
    __name__ = "StaticAllowProvider"


class StaticDenyProvider:
    """Test/demonstration provider that always denies."""

    def decide(self, request: ApprovalRequest) -> ApprovalDecision:
        return ApprovalDecision("denied", "demo provider")

    __name__ = "StaticDenyProvider"


# ---------------------------------------------------------------------------
# Simulated imported tools (we cannot edit their source)
# ---------------------------------------------------------------------------


def process_refund(customer_id: str, amount: int):
    """Process a synthetic refund — no real payment involved."""
    return {"customer_id": customer_id, "amount": amount, "status": "refunded"}


async def fetch_balance_async(account_id: str):
    """Asynchronously fetch a synthetic account balance."""
    return {"account_id": account_id, "balance": 9999}


def purge_cache(keys: list):
    """Delete cached entries — a maintenance action."""
    return {"purged": len(keys)}


# ---------------------------------------------------------------------------
# Wrapping individual tools
# ---------------------------------------------------------------------------

allow = StaticAllowProvider()
deny = StaticDenyProvider()

wrapped_refund = igris.wrap_tool(
    process_refund,
    action="payments.refund",
    risk="critical",
    redact=["customer_id"],
    approval_provider=allow,
)

wrapped_balance = igris.wrap_tool(
    fetch_balance_async,
    action="accounts.balance",
    risk="low",
    approval_provider=allow,
)

wrapped_purge = igris.wrap_tool(
    purge_cache,
    action="maintenance.purge_cache",
    risk="high",
    approval_provider=deny,  # this one will be denied
)


# ---------------------------------------------------------------------------
# Wrapping a collection of tools
# ---------------------------------------------------------------------------

wrapped_list = igris.wrap_tools(
    [process_refund, fetch_balance_async, purge_cache],
    configuration={
        "process_refund": {
            "action": "tools.refund",
            "risk": "critical",
            "redact": ["customer_id"],
            "approval_provider": allow,
        },
        "fetch_balance_async": {
            "action": "tools.balance",
            "risk": "low",
            "approval_provider": allow,
        },
        "purge_cache": {
            "action": "tools.purge",
            "risk": "high",
            "approval_provider": allow,
        },
    },
)

wrapped_mapping = igris.wrap_tools(
    {"refund": process_refund, "balance": fetch_balance_async},
    configuration={
        "refund": {
            "action": "map.refund",
            "risk": "critical",
            "redact": ["customer_id"],
            "approval_provider": allow,
        },
        "balance": {
            "action": "map.balance",
            "risk": "low",
            "approval_provider": allow,
        },
    },
)


# ---------------------------------------------------------------------------
# Demonstration
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Sync tool
    result = wrapped_refund("cus_synthetic", 500)
    print(f"refund: {result}")

    # Async tool
    balance = asyncio.run(wrapped_balance("acc_synthetic"))
    print(f"balance: {balance}")

    # Denied action
    try:
        wrapped_purge(["key1", "key2"])
    except igris.ActionDenied as exc:
        print(f"purge denied: {exc}")

    # Collection (list)
    print(f"list refund: {wrapped_list[0]('cus_list', 100)}")
    list_balance = asyncio.run(wrapped_list[1]("acc_list"))
    print(f"list balance: {list_balance}")

    # Collection (mapping)
    print(f"map refund: {wrapped_mapping['refund']('cus_map', 200)}")
    map_balance = asyncio.run(wrapped_mapping["balance"]("acc_map"))
    print(f"map balance: {map_balance}")

    print("\nSigned decision and outcome events were appended to your journal.")
    print("Verify with: uv run igris verify")
