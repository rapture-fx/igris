# ADR 0006: Protocol conformance precedes Rust extraction

Status: **Proposed**
Date: 2026-07-14

## Context

A native shared core could reduce drift, but it also adds FFI/WASM packaging,
memory, error-mapping, platform, and release complexity. Today Python produces
and Go independently verifies the same fixtures; no multi-SDK drift evidence
justifies a shared engine.

## Decision

Build language-neutral RFCs, schemas, and test vectors first. Consider a shared
Rust core only after Protocol v1 is stable, at least two independent SDKs
exist, conformance drift is demonstrated, and a specific performance, security,
or portability requirement is measured. Prefer a narrow core over an execution
engine.

## Consequences

- Initial interoperability is enforced by conformance, not shared code.
- Rust remains a future evidence-based option, not selected architecture.
- Independent implementations expose specification ambiguity earlier.

## Rejected alternative

Starting with a Rust/WASM/sidecar execution engine is rejected as premature and
would couple SDK ergonomics to infrastructure before the protocol stabilizes.
