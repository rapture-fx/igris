#!/usr/bin/env python3
"""Clean-room durable journey sketch (no repository-private imports).

This example shows the supported SDK path:

    wrap → contract sync → action target → exact binding → run → wait → proof

It does not start infrastructure. Set endpoint/api_key (or both
IGRIS_API_URL and IGRIS_API_KEY) and ensure a webhook adapter is reachable.

Install the correct SDK first (never ``pip install igris`` from public PyPI)::

    pip install ./sdk/python
"""

from __future__ import annotations

import os
import sys

from igris import IgrisDurableClient, wrap_tool
from igris.approval import ApprovalDecision


class AlwaysAllow:
    def decide(self, request):
        _ = request
        return ApprovalDecision("allowed", "durable quickstart")


def consequential_transfer(account_id: str, amount_cents: int) -> dict:
    return {
        "account_id": account_id,
        "amount_cents": amount_cents,
        "effect": "recorded",
    }


def main() -> int:
    endpoint = os.environ.get("IGRIS_API_URL", "").strip()
    api_key = os.environ.get("IGRIS_API_KEY", "").strip()
    if not endpoint or not api_key:
        print(
            "Set IGRIS_API_URL and IGRIS_API_KEY, then construct the durable client "
            "explicitly (or call IgrisDurableClient.from_env()). "
            "Embedded wrap_tool stays local until you use IgrisDurableClient.",
            file=sys.stderr,
        )
        return 2

    # Explicit durable client — env alone never remotes wrap_tool.
    client = IgrisDurableClient(endpoint=endpoint, api_key=api_key)

    tool = wrap_tool(
        consequential_transfer,
        action="demo.consequential_transfer",
        risk="critical",
        approval="never",
        approval_provider=AlwaysAllow(),
    )
    contract = tool.__igris_contract__
    sync = client.sync_contract(tool)
    print(f"contract synced: {sync.action_name} hash={sync.contract_hash[:12]}…")

    target_url = os.environ.get(
        "IGRIS_DEMO_TARGET_URL",
        "http://127.0.0.1:18099/v1/demo/transfer",
    )
    target = client.create_action_target(
        name="demo_transfer_adapter",
        target_url=target_url,
        target_type="webhook",
        replay_class="retryable",
        approval_required=False,
        target_metadata={
            "local_auth_header_name": "X-Igris-Adapter-Token",
            "local_auth_secret_env": "IGRIS_DEMO_ADAPTER_TOKEN",
        },
    )
    print(f"target_action_id: {target.id}")

    binding = client.ensure_binding(
        action_name=contract.action_name,
        contract_hash=contract.contract_hash,
        target_action_id=target.id,
        input_mapping={
            "account_id": "account_id",
            "amount_cents": "amount_cents",
        },
    )
    print(f"binding: {binding.id}")

    idem = os.environ.get("IGRIS_DEMO_IDEMPOTENCY_KEY", "demo-transfer-quickstart-001")
    run = client.run(
        contract.action_name,
        input={"account_id": "acct_demo", "amount_cents": 100},
        idempotency_key=idem,
        contract_hash=contract.contract_hash,
    )
    print(f"run_id: {run.run_id}")

    status = run.wait(timeout=float(os.environ.get("IGRIS_DEMO_WAIT_TIMEOUT", "60")))
    print(f"status={status.status} recovery={status.recovery_status} terminal={status.is_terminal}")

    proof = run.proof()
    print(f"proof schema={proof.schema} product_term={proof.product_term}")
    print(f"statuses={proof.statuses}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
