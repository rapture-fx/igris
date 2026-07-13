"""Deterministic local approval for the synthetic alpha.2 demonstration."""

from igris import ApprovalDecision, ApprovalRequest


class DemoApprovalProvider:
    """Apply a visible, deterministic rule to the redacted request summary."""

    def decide(self, request: ApprovalRequest) -> ApprovalDecision:
        if "cust_demo_denied" in request.redacted_input_summary:
            return ApprovalDecision("denied", "demo policy: manual review required")
        return ApprovalDecision("allowed", "demo policy: synthetic request approved")
