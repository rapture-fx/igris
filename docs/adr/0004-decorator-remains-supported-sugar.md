# ADR 0004: Decorator remains supported sugar

Status: **Proposed**
Date: 2026-07-14

## Context

Decorators are concise and useful for code a developer owns, but they are
Python syntax and cannot define a language-neutral Action.

## Decision

Keep `@igris.guard` as supported Python sugar over the same Action declaration
and execution semantics used by retrofit wrapping. Future bindings may use
their own idioms and are not required to implement decorators.

## Consequences

- Decorator and wrapper outputs must remain conformance-equivalent.
- Documentation should prefer decorators for owned greenfield code and
  wrappers for existing/imported tools.
- Async parity is an SDK roadmap issue, not a protocol change.
- The protocol must never refer to decorator mechanics normatively.

## Rejected alternative

Removing decorators would unnecessarily disrupt current users; making them the
only canonical API would make Python syntax a protocol dependency.
