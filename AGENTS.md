# Repository agent instructions

`docs/product/PRD.md` is the canonical source of product truth.

Before product-facing, architecture, infrastructure, SDK, documentation, or
console work:

1. Read the PRD.
2. State which hosted-alpha user blocker or approved roadmap item the change
   addresses.
3. Stop and request explicit product approval if the task contradicts the PRD.

## Product guardrails

- Public vocabulary is **Action**, **Run**, **Proof**, and exceptional
  **Reconciliation**.
- Do not expose Overture, Runtime, WAL, checkpoints, bindings, or receipts in
  ordinary user-facing onboarding. Those are internal or advanced concepts.
- Do not create new Clock branches.
- Do not add infrastructure capability unless it removes an external-user
  blocker or implements a PRD-approved roadmap item.
- Do not add a new Runtime architecture, Overture redesign, protocol version,
  Evidence v2, robotics, fleet, speculative execution, new language SDK,
  workflow builder, marketplace, or large console without a ratified PRD
  amendment.
- REST remains the canonical managed interface. The Python SDK remains a thin
  convenience layer.
- Do not claim exactly-once external effects or cryptographic proof of
  external-world correctness.

## Execution guardrails

- Preserve authentication, authorization, tenant isolation, idempotency,
  conservative replay, auditability, and secret minimization.
- Application runtimes must not apply database migrations automatically.
- Do not apply production migrations, deploy production, publish packages, or
  rotate credentials without explicit authorization.
- Product readiness claims require current source evidence and relevant runtime
  evidence. Tests or docs alone are not sufficient.
- Keep changes focused. Do not fold frozen-scope cleanup or capability work into
  an alpha-readiness change.
