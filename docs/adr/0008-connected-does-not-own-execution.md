# ADR 0008: Connected does not own execution

Status: **Proposed**
Date: 2026-07-14

## Context

Connected contract synchronization and evidence ingestion are implemented, but
the consequential callable still executes in the caller's environment.
Conflating connectivity with execution control would overstate containment,
identity, and side-effect guarantees.

## Decision

Connected is optional coordination and transport. It may register contracts,
coordinate future providers, verify/upload evidence, and bind a key to an
organization scope. It does not become execution provenance and must not assign
Managed provenance to Embedded evidence.

## Consequences

- Embedded remains zero-network by default and locally verifiable.
- Registration grants no execution permission.
- Evidence upload is explicit and does not rewrite journals.
- Managed execution remains a separate future integration with authenticated
  runtime control and stronger claims.

## Rejected alternative

Treating any server-verified evidence as Managed is rejected because signature
verification does not prove who controlled the execution environment.
