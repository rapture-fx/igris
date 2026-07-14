# ADR 0005: Evidence is narrower than observability

Status: **Proposed**
Date: 2026-07-14

## Context

Logs, traces, metrics, prompts, model output, and debugging context are useful
but high-volume, privacy-sensitive, and often mutable. Evidence v1 makes a
narrow signed decision/outcome claim.

## Decision

Define protocol evidence as typed, bounded assertions needed to verify an
Action lifecycle under stated trust limits. Do not turn Evidence into a general
observability envelope.

## Consequences

- Correlation metadata may exist in observability without becoming signed
  causation.
- Evidence retention and access can receive stricter controls.
- Missing logs do not invalidate evidence; valid evidence does not provide full
  debugging context.
- New evidence fields require claim, privacy, size, and compatibility review.

## Rejected alternative

Signing arbitrary logs/traces is rejected for v1 because it expands leakage,
canonicalization, retention, and compatibility surface without strengthening
the core claim proportionally.
