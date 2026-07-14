# ADR 0007: Workflow composition is excluded from Protocol v1

Status: **Proposed**
Date: 2026-07-14

## Context

Composition adds persistent graphs, scheduling, fan-out, retries,
compensation, partial failure, secrets flow, and cross-Action authorization.
Evidence v1 has only an outcome-to-decision link and cannot express general
causation.

## Decision

Protocol v1 specifies one Action instance lifecycle. Nested calls are
independent instances without a signed parent relationship. DAGs, pipelines,
transactions, compensation, and workflow DSLs require a separate future RFC.

## Consequences

- The single-Action protocol can stabilize without a scheduler.
- Journal adjacency must not be interpreted as composition.
- Future causation fields require Evidence v2.
- Applications remain free to orchestrate Actions outside the protocol.

## Rejected alternative

Adding minimal chaining now is rejected because “minimal” identifiers quickly
become durable workflow and retry semantics that v1 cannot honestly satisfy.
