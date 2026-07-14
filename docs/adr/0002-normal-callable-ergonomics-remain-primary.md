# ADR 0002: Normal callable ergonomics remain primary

Status: **Proposed**
Date: 2026-07-14

## Context

Igris adoption begins with existing application and agent-tool callables. A
mandatory lazy invocation object would change control flow and increase
framework integration cost without being required for protocol correctness.

## Decision

Language bindings should preserve ordinary call/await behavior as the primary
surface. They must expose an inspectable static Action descriptor, but must not
require users to construct and later run a lazy Action object by default.

## Consequences

- Sync remains sync and async remains awaitable where the language permits.
- Static declaration and runtime invocation remain conceptually separate.
- Advanced lazy/builder APIs may coexist as optional surfaces.
- Bindings must make post-execution evidence failures explicit even when that
  interrupts ordinary return semantics.

## Rejected alternative

A universal lazy `Action.run()` model is rejected for v1 because it optimizes
for possible future composition and managed execution at the expense of the
current user problem.
