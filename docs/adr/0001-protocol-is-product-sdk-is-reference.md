# ADR 0001: Protocol is product; SDK is reference implementation

Status: **Proposed**
Date: 2026-07-14

## Context

Alpha.2 ships Python ActionContract/Evidence producers and independent Go
canonicalization/verification. Defining Igris only through Python APIs would
prevent independent bindings and third-party verification.

## Decision

Treat the open protocol, schemas, trust boundaries, lifecycle semantics, and
conformance vectors as the long-term interoperability product. Treat the Python
SDK as the current reference implementation, not the sole definition.

Hosted and enterprise products may add coordination, trust administration,
retention, search, and managed operations around the protocol.

## Consequences

- Normative behavior lives in reviewed RFCs and vectors.
- Implementations conform by outputs/semantics, not shared code.
- Existing schema `1` bytes remain authoritative for historical verification.
- Product APIs may evolve independently from protocol versions.
- This proposal does not claim protocol stability or external-standard status.

## Rejected alternative

Making Python source the permanent specification would encode Python runtime
concepts as protocol and make independent verification subordinate to one SDK.
