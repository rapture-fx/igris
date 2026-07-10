"""Injecting an approval provider (the hook tests and future Connected mode use).

The provider only ever sees the redacted, bounded input summary — the same
representation that is persisted to the journal.
"""

import igris
from igris.approval import ApprovalDecision, ApprovalRequest


class AllowLowRiskProvider:
    """Approve low-risk actions automatically; deny everything else."""

    def decide(self, request: ApprovalRequest) -> ApprovalDecision:
        if request.risk == "low":
            return ApprovalDecision("allowed", "policy: low risk auto-approved")
        return ApprovalDecision("denied", f"policy: {request.risk} risk requires a human")


@igris.guard(action="report.generate", risk="low", approval_provider=AllowLowRiskProvider())
def generate_report(query: str) -> str:
    return f"report for {query!r}"


@igris.guard(action="records.purge", risk="critical", approval_provider=AllowLowRiskProvider())
def purge_records(table: str) -> None:
    raise AssertionError("never reached: the provider denies critical actions")


if __name__ == "__main__":
    print(generate_report("monthly revenue"))
    try:
        purge_records("customers")
    except igris.ActionDenied as denied:
        print(f"denied as expected: {denied}")
