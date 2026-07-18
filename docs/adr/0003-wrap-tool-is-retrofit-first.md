# ADR 0003: `wrap_tool` is the retrofit-first adoption surface

Status: **Proposed**
Date: 2026-07-14

## Context

Many tool callables are imported, framework-owned, or otherwise impractical to
edit. Alpha.2 `wrap_tool` supports existing sync and async callables, preserves
metadata/signatures, and produces evidence equivalent to the guard engine.

## Decision

For existing tools, retrofit wrapping is the primary adoption guidance. A
binding may name the API differently, but it should return an ordinary guarded
callable without mutating the original.

## Consequences

- Framework dependencies and source edits are not required.
- Explicit stable action names are required at the retrofit boundary.
- Double wrapping, generators, ambiguous collections, and uninspectable
  callables should fail early.
- The adapter remains SDK API, not a protocol object.

## Rejected alternative

Automatic discovery/monkey-patching is rejected because it obscures which
callables are governed and risks hidden behavior or networking.
