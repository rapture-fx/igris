#!/usr/bin/env python3
"""Clean-room managed journey: Igris.from_env → run → wait → proof.

One-time Action setup (sync / target / bind) is shown once, then the ordinary
path uses Action name + business idempotency key only.

Does not start infrastructure. Set IGRIS_API_URL + IGRIS_API_KEY and ensure a
loopback webhook adapter is reachable.

    pip install ./sdk/python
"""

from __future__ import annotations

import os
import sys

from igris import Igris, wrap_tool
from igris.approval import ApprovalDecision


class AlwaysAllow:
    def decide(self, request):
        _ = request
        return ApprovalDecision("allowed", "durable quickstart")


def deploy_staging(service: str, commit: str) -> dict:
    return {"service": service, "commit": commit, "effect": "deployed"}


def main() -> int:
    if (
        not os.environ.get("IGRIS_API_URL", "").strip()
        or not os.environ.get("IGRIS_API_KEY", "").strip()
    ):
        print(
            "Set IGRIS_API_URL and IGRIS_API_KEY, then call Igris.from_env(). "
            "Embedded wrap_tool stays local until you use managed Igris.",
            file=sys.stderr,
        )
        return 2

    igris = Igris.from_env()

    tool = wrap_tool(
        deploy_staging,
        action="deploy.staging",
        risk="critical",
        approval="never",
        approval_provider=AlwaysAllow(),
    )

    # --- one-time setup (skip when the Action is already configured) ---
    target_url = os.environ.get(
        "IGRIS_DEMO_TARGET_URL",
        "http://127.0.0.1:18099/v1/deploy/staging",
    )
    target = igris.create_action_target(
        name="deploy_staging_adapter",
        target_url=target_url,
        target_type="webhook",
        replay_class="retryable",
        approval_required=False,
        target_metadata={
            "local_auth_header_name": "X-Igris-Adapter-Token",
            "local_auth_secret_env": "IGRIS_DEMO_ADAPTER_TOKEN",
        },
    )
    binding = igris.configure_action(
        tool,
        target_action_id=target.id,
        input_mapping={"service": "service", "commit": "commit"},
    )
    print(f"configured {binding.action_name} binding={binding.id}")

    # --- ordinary Action → Run → Proof ---
    idem = os.environ.get("IGRIS_DEMO_IDEMPOTENCY_KEY", "deploy:api:quickstart-001")
    run = igris.run(
        "deploy.staging",
        input={"service": "api", "commit": "abc123"},
        idempotency_key=idem,
    )
    print(f"run_id: {run.run_id}")

    status = run.wait(timeout=float(os.environ.get("IGRIS_DEMO_WAIT_TIMEOUT", "60")))
    print(f"status={status.status} terminal={status.is_terminal}")

    proof = run.proof()
    print(f"proof schema={proof.schema} statuses={proof.statuses}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
